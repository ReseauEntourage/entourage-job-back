import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import moment from 'moment';
import { QueryTypes } from 'sequelize';
import { generatePublicProfileDto } from '../dto/public-profile.dto';
import { UserProfile } from '../models';
import { UserProfileRecommendation } from '../models/user-profile-recommendation.model';
import { UserProfilesService } from '../user-profiles.service';
import { EMBEDDING_CONFIG } from 'src/embeddings/embedding.config';
import { User } from 'src/users/models';
import { OnboardingStatus, UserRole, UserRoles } from 'src/users/users.types';
import { RecommendationsDto } from './dto/recommendations.dto';
import {
  ACTIVITY_SCORING_CONFIG,
  LOCATION_COMPATIBILITY_CONFIG,
  SCORING_WEIGHTS,
} from './scoring.config';
import { UserProfileRecommendationBase } from './user-profile-recommendation-base';
import {
  MatchingReason,
  UserProfileMatchingResult,
  UserProfileScoringResult,
} from './user-profile-recommendation.types';

// Number of candidates pre-selected by ANN before applying full scoring.
// Higher = more recall but slower; lower = faster but may miss good candidates.
const ANN_POOL_SIZE = 200;

// Size of the initial recommendation pool stored on first compute.
export const INITIAL_POOL_SIZE = 50;

// Size of each subsequent append batch when the pool nears exhaustion.
export const APPEND_BATCH_SIZE = 50;

@Injectable()
export class UserProfileRecommendationsService extends UserProfileRecommendationBase {
  constructor(
    @InjectModel(UserProfileRecommendation)
    userProfileRecommandationModel: typeof UserProfileRecommendation,
    @Inject(forwardRef(() => UserProfilesService))
    userProfilesService: UserProfilesService
  ) {
    super(userProfileRecommandationModel, userProfilesService);
  }

  async findBySimilarity(params: {
    userId: string;
    rolesToFind: UserRole[];
    configVersionProfile: string;
    configVersionNeeds: string;
    weightProfile: number;
    weightNeeds: number;
    weightActivity: number;
    weightLocationCompatibility: number;
    poolSize: number;
    excludeUserIds?: string[];
    filterByAvailability?: boolean;
    annPoolSize?: number;
  }): Promise<UserProfileScoringResult[]> {
    const {
      userId,
      rolesToFind,
      configVersionProfile,
      configVersionNeeds,
      weightProfile,
      weightNeeds,
      weightActivity,
      weightLocationCompatibility,
      poolSize,
      excludeUserIds = [],
      filterByAvailability = undefined,
      annPoolSize = ANN_POOL_SIZE,
    } = params;

    // Fetch the current user's raw vectors first so the main query can use
    // ORDER BY <=> with a literal vector and benefit from the HNSW index.
    const { profileVector, needsVector } = await this.fetchCurrentUserVectors(
      userId,
      configVersionProfile,
      configVersionNeeds
    );

    if (!profileVector && !needsVector) return [];

    const sql = this.buildSimilarityQuery(
      rolesToFind,
      profileVector,
      needsVector,
      excludeUserIds,
      filterByAvailability
    );

    return this.userProfileRecommandationModel.sequelize.query<UserProfileScoringResult>(
      sql,
      {
        type: QueryTypes.SELECT,
        replacements: {
          onboardingStatusCompleted: OnboardingStatus.COMPLETED,
          userId,
          configVersionProfile,
          configVersionNeeds,
          weightProfile,
          weightNeeds,
          weightActivity,
          weightLocationCompatibility,
          poolSize,
          annPoolSize,
        },
      }
    );
  }

  /**
   * Fetches the current user's profile and needs embedding vectors.
   * Returns them as pgvector literal strings (e.g. "[0.1,0.2,...]") ready
   * for direct interpolation into ORDER BY <=> expressions.
   */
  private async fetchCurrentUserVectors(
    userId: string,
    configVersionProfile: string,
    configVersionNeeds: string
  ): Promise<{ profileVector: string | null; needsVector: string | null }> {
    const rows = await this.userProfileRecommandationModel.sequelize.query<{
      type: string;
      embedding: string;
    }>(
      `SELECT type, embedding::text AS embedding
       FROM "UserProfileEmbeddings"
       WHERE "userProfileId" = (SELECT id FROM "UserProfiles" WHERE "userId" = :userId)
         AND (
           (type = 'profile' AND "configVersion" = :configVersionProfile)
           OR (type = 'needs'   AND "configVersion" = :configVersionNeeds)
         )`,
      {
        type: QueryTypes.SELECT,
        replacements: { userId, configVersionProfile, configVersionNeeds },
      }
    );

    return {
      profileVector: rows.find((r) => r.type === 'profile')?.embedding ?? null,
      needsVector: rows.find((r) => r.type === 'needs')?.embedding ?? null,
    };
  }

  /**
   * Builds the complete SQL query for similarity search.
   * Vectors are interpolated as literals so ORDER BY <=> can use the HNSW index.
   */
  private buildSimilarityQuery(
    rolesToFind: UserRole[],
    profileVector: string | null,
    needsVector: string | null,
    excludeUserIds: string[] = [],
    filterByAvailability?: boolean
  ): string {
    const rolesPlaceholder = rolesToFind.map((r) => `'${r}'`).join(', ');
    // Safe to interpolate: values are UUIDs coming from our own DB
    const excludeClause =
      excludeUserIds.length > 0
        ? `AND u.id NOT IN (${excludeUserIds
            .map((id) => `'${id}'`)
            .join(', ')})`
        : '';

    return `
      WITH
      ${this.buildTopByProfileCTE(
        rolesPlaceholder,
        profileVector,
        excludeClause,
        filterByAvailability
      )},
      ${this.buildTopByNeedsCTE(
        rolesPlaceholder,
        needsVector,
        excludeClause,
        filterByAvailability
      )},
      ${this.buildCandidatePoolCTE()},
      ${this.buildUserScoresCTE()}
      ${this.buildFinalSelect()}
    `;
  }

  /**
   * CTE: top ANN candidates by profile embedding similarity.
   * Uses ORDER BY <=> LIMIT to trigger the HNSW index.
   * Returns an empty set when the current user has no profile vector.
   */
  private buildTopByProfileCTE(
    rolesPlaceholder: string,
    profileVector: string | null,
    excludeClause: string,
    filterByAvailability?: boolean
  ): string {
    if (!profileVector) {
      return `top_by_profile AS (
        SELECT NULL::uuid AS "userId", 0::float AS profile_score WHERE false
      )`;
    }

    const vec = `'${profileVector}'::vector`;
    const availabilityClause =
      filterByAvailability === true
        ? `AND up."isAvailable" = true`
        : filterByAvailability === false
        ? `AND up."isAvailable" = false`
        : '';

    return `top_by_profile AS (
      SELECT up."userId", 1 - (upe.embedding <=> ${vec}) AS profile_score
      FROM "UserProfileEmbeddings" upe
      JOIN "UserProfiles" up ON up.id = upe."userProfileId"
      JOIN "Users" u          ON u.id  = up."userId"
      WHERE upe.type = 'profile'
        AND upe."configVersion"   = :configVersionProfile
        ${availabilityClause}
        AND u."deletedAt"         IS NULL
        AND u.id                  != :userId
        AND u.role                IN (${rolesPlaceholder})
        AND u."onboardingStatus"  = :onboardingStatusCompleted
        ${excludeClause}
      ORDER BY upe.embedding <=> ${vec}
      LIMIT :annPoolSize
    )`;
  }

  /**
   * CTE: top ANN candidates by needs embedding similarity.
   * Uses ORDER BY <=> LIMIT to trigger the HNSW index.
   * Returns an empty set when the current user has no needs vector.
   */
  private buildTopByNeedsCTE(
    rolesPlaceholder: string,
    needsVector: string | null,
    excludeClause: string,
    filterByAvailability?: boolean
  ): string {
    if (!needsVector) {
      return `top_by_needs AS (
        SELECT NULL::uuid AS "userId", 0::float AS needs_score WHERE false
      )`;
    }

    const vec = `'${needsVector}'::vector`;
    const availabilityClause =
      filterByAvailability === true
        ? `AND up."isAvailable" = true`
        : filterByAvailability === false
        ? `AND up."isAvailable" = false`
        : '';

    return `top_by_needs AS (
      SELECT up."userId", 1 - (upe.embedding <=> ${vec}) AS needs_score
      FROM "UserProfileEmbeddings" upe
      JOIN "UserProfiles" up ON up.id = upe."userProfileId"
      JOIN "Users" u          ON u.id  = up."userId"
      WHERE upe.type = 'needs'
        AND upe."configVersion"   = :configVersionNeeds
        ${availabilityClause}
        AND u."deletedAt"         IS NULL
        AND u.id                  != :userId
        AND u.role                IN (${rolesPlaceholder})
        AND u."onboardingStatus"  = :onboardingStatusCompleted
        ${excludeClause}
      ORDER BY upe.embedding <=> ${vec}
      LIMIT :annPoolSize
    )`;
  }

  /**
   * CTE: merges both ANN pools into a single candidate pool (~200 entries).
   * A FULL OUTER JOIN ensures candidates that appear in only one pool are kept.
   */
  private buildCandidatePoolCTE(): string {
    return `candidate_pool AS (
      SELECT
        COALESCE(p."userId", n."userId") AS "userId",
        COALESCE(p.profile_score, 0)     AS profile_score,
        COALESCE(n.needs_score, 0)       AS needs_score
      FROM top_by_profile p
      FULL OUTER JOIN top_by_needs n ON n."userId" = p."userId"
    )`;
  }

  /**
   * CTE: computes all scores for the candidates in candidate_pool.
   * The activity subquery is restricted to this pool to avoid scanning
   * conversation data for the entire user base.
   */
  private buildUserScoresCTE(): string {
    return `user_scores AS (
      SELECT
        cand."userId",
        cand.profile_score,
        cand.needs_score,
        ${this.buildActivityScoreFormula()},
        ${this.buildLocationCompatibilityScoreFormula()}
      FROM candidate_pool cand
      JOIN "UserProfiles" up ON up."userId" = cand."userId"
      JOIN "Users" u         ON u.id        = cand."userId"
      ${this.buildCurrentUserProfileDataCTE()}
      ${this.buildActivitySubquery()}
      WHERE (
        (current_user_data.current_allow_remote = true AND up."allowRemoteEvents" = true)
        OR u.zone = current_user_data.current_zone
      )
      AND NOT EXISTS (
        SELECT 1
        FROM "ConversationParticipants" cp_cur
        JOIN "ConversationParticipants" cp_oth
          ON cp_oth."conversationId" = cp_cur."conversationId"
         AND cp_oth."userId"         = cand."userId"
        WHERE cp_cur."userId" = :userId
      )
    )`;
  }

  /**
   * Inlined subquery that provides the current user's event preferences and zone.
   */
  private buildCurrentUserProfileDataCTE(): string {
    return `CROSS JOIN (
      SELECT
        up_current."allowPhysicalEvents" AS current_allow_physical,
        up_current."allowRemoteEvents"   AS current_allow_remote,
        u_current.zone                   AS current_zone
      FROM "UserProfiles" up_current
      JOIN "Users" u_current ON up_current."userId" = u_current.id
      WHERE up_current."userId" = :userId
    ) current_user_data`;
  }

  /**
   * Formula for calculating activity score.
   * Based on: response rate, response time, last connection, workload.
   */
  private buildActivityScoreFormula(): string {
    const config = ACTIVITY_SCORING_CONFIG;
    const weights = config.weights;

    const responseTimeCases = config.responseTime.breakpoints
      .map((bp, idx, arr) => {
        if (idx === arr.length - 1) {
          return `        ELSE ${bp.score}`;
        }
        return `        WHEN activity.avg_response_hours <= ${bp.maxHours}  THEN ${bp.score}`;
      })
      .join('\n');

    const lastConnectionCases = config.lastConnection.breakpoints
      .map((bp, idx, arr) => {
        if (idx === arr.length - 1) {
          return `        ELSE ${bp.score}`;
        }
        return `        WHEN EXTRACT(DAY FROM NOW() - u."lastConnection") <= ${bp.maxDays}   THEN ${bp.score}`;
      })
      .join('\n');

    const workloadCases = config.workload.breakpoints
      .map((bp, idx, arr) => {
        if (idx === arr.length - 1) {
          return `        ELSE ${bp.score}`;
        }
        return `        WHEN COALESCE(activity.active_conversations_count, 0) <= ${bp.maxConversations} THEN ${bp.score}`;
      })
      .join('\n');

    return `LEAST(1.0, GREATEST(0.0,
      COALESCE(activity.response_rate, ${config.responseRate.defaultValue}) * ${weights.responseRate} +
      CASE
        WHEN activity.avg_response_hours IS NULL THEN ${config.responseTime.defaultScore}
${responseTimeCases}
      END * ${weights.responseTime} +
      CASE
        WHEN EXTRACT(DAY FROM NOW() - u."lastConnection") IS NULL THEN ${config.lastConnection.defaultScore}
${lastConnectionCases}
      END * ${weights.lastConnection} +
      CASE
${workloadCases}
      END * ${weights.workload}
    )) AS activity_score`;
  }

  /**
   * Formula for calculating location compatibility score.
   */
  private buildLocationCompatibilityScoreFormula(): string {
    const config = LOCATION_COMPATIBILITY_CONFIG;

    return `CASE
      WHEN u.zone = current_user_data.current_zone THEN ${config.sameZone}
      ELSE ${config.differentZone}
    END::float AS location_compatibility_score`;
  }

  /**
   * Subquery to calculate user activity statistics restricted to candidate_pool,
   * avoiding a full scan of all conversations.
   *
   * active_conversations_count uses COUNT(DISTINCT c.id) directly: since the
   * outer WHERE already filters conversations created within the time window,
   * any such conversation necessarily has messages within that same window.
   */
  private buildActivitySubquery(): string {
    const timeWindowDays = ACTIVITY_SCORING_CONFIG.timeWindowDays;

    return `LEFT JOIN (
      SELECT
        cp_receiver."userId" AS user_id,
        COUNT(CASE WHEN response.id IS NOT NULL THEN 1 END)::float
          / NULLIF(COUNT(DISTINCT c.id), 0) AS response_rate,
        AVG(
          EXTRACT(EPOCH FROM (response."createdAt" - first_msg."createdAt")) / 3600
        ) AS avg_response_hours,
        COUNT(DISTINCT c.id) AS active_conversations_count
      FROM "Conversations" c
      JOIN "ConversationParticipants" cp_receiver
        ON cp_receiver."conversationId" = c.id
        AND cp_receiver."userId" IN (SELECT "userId" FROM candidate_pool)
      JOIN "ConversationParticipants" cp_other
        ON cp_other."conversationId" = c.id
       AND cp_other."userId" != cp_receiver."userId"
      JOIN "Users" u_other ON u_other.id = cp_other."userId"
      JOIN LATERAL (
        SELECT m."createdAt", m.id
        FROM "Messages" m
        JOIN "ConversationParticipants" cp
          ON cp."conversationId" = c.id
         AND cp."userId" != cp_receiver."userId"
        WHERE m."conversationId" = c.id
        ORDER BY m."createdAt" ASC
        LIMIT 1
      ) first_msg ON true
      LEFT JOIN LATERAL (
        SELECT m."createdAt", m.id
        FROM "Messages" m
        WHERE m."conversationId" = c.id
          AND m."authorId"       = cp_receiver."userId"
          AND m."createdAt"      > first_msg."createdAt"
        ORDER BY m."createdAt" ASC
        LIMIT 1
      ) response ON true
      WHERE c."createdAt" >= NOW() - INTERVAL '${timeWindowDays} days'
        AND u_other.role != 'Admin'
      GROUP BY cp_receiver."userId"
    ) activity ON activity.user_id = cand."userId"`;
  }

  /**
   * Final select that combines all scores into a weighted final score.
   */
  private buildFinalSelect(): string {
    return `SELECT
      "userId",
      profile_score             AS "profileScore",
      needs_score               AS "needsScore",
      activity_score            AS "activityScore",
      location_compatibility_score AS "locationCompatibilityScore",
      ${this.buildFinalScoreFormula()}
    FROM user_scores
    WHERE profile_score > 0 OR needs_score > 0
    ORDER BY "finalScore" DESC
    LIMIT :poolSize`;
  }

  /**
   * Formula for calculating the final weighted score.
   */
  private buildFinalScoreFormula(): string {
    return `(
      profile_score                * :weightProfile             +
      needs_score                  * :weightNeeds               +
      activity_score               * :weightActivity            +
      location_compatibility_score * :weightLocationCompatibility
    ) AS "finalScore"`;
  }

  /**
   * Computes the dominant reason for each recommendation based on relative comparison.
   *
   * With multiple results: uses min-max normalization across all recommendations
   * to determine on which criterion each candidate stands out the most relative
   * to the other recommendations. locationCompatibility is excluded as it is a
   * binary value that does not meaningfully differentiate candidates.
   *
   * With a single result: falls back to the absolute system (highest weighted score).
   */
  protected computeRelativeReasons(
    scoringResults: UserProfileScoringResult[]
  ): UserProfileMatchingResult[] {
    if (scoringResults.length === 0) return [];

    const criteria = [
      {
        key: 'profileScore' as const,
        reason: MatchingReason.PROFILE,
        weight: SCORING_WEIGHTS.profile,
      },
      {
        key: 'needsScore' as const,
        reason: MatchingReason.NEEDS,
        weight: SCORING_WEIGHTS.needs,
      },
      {
        key: 'activityScore' as const,
        reason: MatchingReason.ACTIVITY,
        weight: SCORING_WEIGHTS.activity,
      },
    ];

    if (scoringResults.length === 1) {
      const result = scoringResults[0];
      const dominantReason = criteria.reduce(
        (best, c) => {
          const weightedScore = result[c.key] * c.weight;
          return weightedScore > best.score
            ? { reason: c.reason, score: weightedScore }
            : best;
        },
        { reason: MatchingReason.PROFILE, score: -Infinity }
      ).reason;
      return [{ ...result, dominantReason }];
    }

    const ranges = criteria.map(({ key }) => {
      const scores = scoringResults.map((r) => r[key]);
      const min = Math.min(...scores);
      const max = Math.max(...scores);
      return { min, range: max - min };
    });

    return scoringResults.map((result) => {
      const dominantReason = criteria.reduce(
        (best, c, i) => {
          const { min, range } = ranges[i];
          const relativeScore =
            range > 0 ? ((result[c.key] - min) / range) * c.weight : 0;
          return relativeScore > best.score
            ? { reason: c.reason, score: relativeScore }
            : best;
        },
        { reason: MatchingReason.PROFILE, score: -Infinity }
      ).reason;
      return { ...result, dominantReason };
    });
  }

  /**
   * Ensures a fresh recommendation pool exists for the user.
   * Triggers a full recompute when the pool is stale, empty, or contains
   * legacy records (no rank / no finalScore).
   */
  async ensureFreshPool(user: User, userProfile: UserProfile): Promise<void> {
    const oneWeekAgo = moment().subtract(1, 'week');

    const currentRecos = await this.findRecommendationsByUserId(user.id);

    const recIsUnavailable = currentRecos.some(
      (r) => !r?.recUser?.userProfile?.isAvailable
    );
    const recIsLegacy = currentRecos.some(
      (r) => r.finalScore === null || r.rank === null
    );

    /**
     * Conditions for refreshing the pool:
     * - No previous recommendations date (first time)
     * - Last recommendations are older than 1 week
     * - No recommendations currently stored
     * - At least one recommended profile is no longer available
     * - At least one recommended profile is now deleted
     * - At least one recommendation is from the legacy system (finalScore is null or rank is null)
     */
    const needsRefresh =
      !userProfile.lastRecommendationsDate ||
      moment(userProfile.lastRecommendationsDate).isBefore(oneWeekAgo) ||
      currentRecos.length === 0 ||
      recIsUnavailable ||
      recIsLegacy;

    /**
     * If any of the above conditions are met, we refresh the pool by deleting existing recommendations and computing a new set. We also update the lastRecommendationsDate to now.
     * This ensures that users always see up-to-date and relevant recommendations when they access their pool.
     * The check for availability and legacy records ensures that we don't show users recommendations that are no longer valid or from an outdated system, which could lead to a poor user experience.
     */
    if (needsRefresh) {
      await this.removeRecommendationsByUserId(user.id);
      await this.updateRecommendationsByUserId(user.id, INITIAL_POOL_SIZE);
      await this.userProfilesService.updateByUserId(user.id, {
        lastRecommendationsDate: moment().toDate(),
      });
    }
  }

  /**
   * Appends the next batch of recommendations for a user, excluding those
   * already stored. Meant to be called in the background when the user
   * nears the end of their current pool (infinite scroll refill).
   */
  async appendRecommendationsForUserId(
    userId: string,
    batchSize: number
  ): Promise<void> {
    const stored = await this.getStoredRecommendationsMeta(userId);
    if (stored.length === 0) return;

    const excludeUserIds = stored.map((r) => r.recommendedUserId);
    const maxRank = Math.max(...stored.map((r) => r.rank ?? 0));

    const user = await this.userProfilesService.findOneUser(userId);
    const rolesToFind: UserRole[] =
      user.role === UserRoles.CANDIDATE
        ? [UserRoles.COACH]
        : [UserRoles.CANDIDATE];

    const scoringResults = await this.findBySimilarity({
      userId,
      rolesToFind,
      configVersionProfile: EMBEDDING_CONFIG.profile.version,
      configVersionNeeds: EMBEDDING_CONFIG.needs.version,
      weightProfile: SCORING_WEIGHTS.profile,
      weightNeeds: SCORING_WEIGHTS.needs,
      weightActivity: SCORING_WEIGHTS.activity,
      weightLocationCompatibility: SCORING_WEIGHTS.locationCompatibility,
      poolSize: batchSize,
      excludeUserIds,
      filterByAvailability: true,
    });

    if (scoringResults.length === 0) return;

    const matchingResults = this.computeRelativeReasons(scoringResults);
    await this.createRecommendationsFromUserProfileMatchingResult(
      userId,
      matchingResults,
      maxRank + 1
    );
  }

  /**
   * Generates recommendations for a user using vector embeddings.
   * This method uses cosine similarity to find the most similar profiles.
   * @param userId The user ID for which to generate recommendations
   * @returns The recommendations created for the user
   */
  async updateRecommendationsByUserId(
    userId: string,
    poolSize = 3
  ): Promise<UserProfileRecommendation[]> {
    const user = await this.userProfilesService.findOneUser(userId);

    const rolesToFind: UserRole[] =
      user.role === UserRoles.CANDIDATE
        ? [UserRoles.COACH]
        : [UserRoles.CANDIDATE];

    const scoringResults = await this.findBySimilarity({
      userId,
      rolesToFind: rolesToFind,
      configVersionProfile: EMBEDDING_CONFIG.profile.version,
      configVersionNeeds: EMBEDDING_CONFIG.needs.version,
      weightProfile: SCORING_WEIGHTS.profile,
      weightNeeds: SCORING_WEIGHTS.needs,
      weightActivity: SCORING_WEIGHTS.activity,
      weightLocationCompatibility: SCORING_WEIGHTS.locationCompatibility,
      poolSize,
      filterByAvailability: true,
    });

    const matchingResults = this.computeRelativeReasons(scoringResults);

    return this.createRecommendationsFromUserProfileMatchingResult(
      userId,
      matchingResults
    );
  }

  async retrieveOrComputeRecommendationsForUserIdIA(
    user: User,
    userProfile: UserProfile,
    poolSize = 3
  ): Promise<RecommendationsDto> {
    await this.ensureFreshPool(user, userProfile);

    const recommendedProfiles = await this.findRecommendationsByUserId(
      user.id,
      { limit: poolSize }
    );

    return Promise.all(
      recommendedProfiles.map((recoProfile) => {
        const publicProfile = generatePublicProfileDto(
          recoProfile.recUser,
          recoProfile.recUser.userProfile,
          null
        );
        if (!publicProfile) {
          throw new Error(
            `Failed to generate public profile for user ${recoProfile.recUser.id}`
          );
        }
        return {
          id: recoProfile.id,
          publicProfile,
          reason: recoProfile.reason,
          profileScore: recoProfile.profileScore,
          needsScore: recoProfile.needsScore,
          activityScore: recoProfile.activityScore,
          locationCompatibilityScore: recoProfile.locationCompatibilityScore,
          finalScore: recoProfile.finalScore,
        };
      })
    );
  }
}
