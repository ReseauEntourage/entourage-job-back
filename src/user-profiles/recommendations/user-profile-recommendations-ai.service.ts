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
import { UserRole, UserRoles } from 'src/users/users.types';
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
    } = params;

    const sql = this.buildSimilarityQuery(rolesToFind);

    return this.userProfileRecommandationModel.sequelize.query<UserProfileScoringResult>(
      sql,
      {
        type: QueryTypes.SELECT,
        replacements: {
          userId,
          configVersionProfile,
          configVersionNeeds,
          weightProfile,
          weightNeeds,
          weightActivity,
          weightLocationCompatibility,
          poolSize,
        },
      }
    );
  }

  /**
   * Builds the complete SQL query for similarity search
   */
  private buildSimilarityQuery(rolesToFind: UserRole[]): string {
    const rolesPlaceholder = rolesToFind.map((r) => `'${r}'`).join(', ');

    return `
      WITH ${this.buildCurrentUserEmbeddingsCTE()},
      ${this.buildUserScoresCTE(rolesPlaceholder)}
      ${this.buildFinalSelect()}
    `;
  }

  /**
   * CTE to retrieve the current user's embeddings
   */
  private buildCurrentUserEmbeddingsCTE(): string {
    return `current_user_embeddings AS (
      SELECT embedding, type
      FROM "UserProfileEmbeddings"
      WHERE "userProfileId" = (
        SELECT id FROM "UserProfiles" WHERE "userId" = :userId
      )
        AND (
          (type = 'profile' AND "configVersion" = :configVersionProfile)
          OR (type = 'needs' AND "configVersion" = :configVersionNeeds)
        )
    )`;
  }

  /**
   * CTE to retrieve the current user's profile data
   * (event preferences and geographic zone)
   */
  private buildCurrentUserProfileDataCTE(): string {
    return `CROSS JOIN (
      SELECT
        up_current."allowPhysicalEvents" AS current_allow_physical,
        up_current."allowRemoteEvents" AS current_allow_remote,
        u_current.zone AS current_zone
      FROM "UserProfiles" up_current
      JOIN "Users" u_current ON up_current."userId" = u_current.id
      WHERE up_current."userId" = :userId
    ) current_user_data`;
  }

  /**
   * CTE to calculate all candidate user scores
   */
  private buildUserScoresCTE(rolesPlaceholder: string): string {
    return `user_scores AS (
      SELECT
        u.id AS "userId",
        ${this.buildProfileScoreFormula()},
        ${this.buildNeedsScoreFormula()},
        ${this.buildActivityScoreFormula()},
        ${this.buildLocationCompatibilityScoreFormula()}
      FROM "UserProfileEmbeddings" upe
      JOIN "UserProfiles" up ON upe."userProfileId" = up.id
      JOIN "Users" u         ON up."userId" = u.id
      CROSS JOIN current_user_embeddings cue
      ${this.buildCurrentUserProfileDataCTE()}
      ${this.buildActivitySubquery()}
      WHERE up."isAvailable"          = true
        AND up."optInRecommendations" = true
        AND u."deletedAt"             IS NULL
        AND u.id                      != :userId
        AND u.role                    IN (${rolesPlaceholder})
        AND (
          (upe.type = 'profile' AND upe."configVersion" = :configVersionProfile)
          OR (upe.type = 'needs' AND upe."configVersion" = :configVersionNeeds)
        )
        -- Geographic filter: only allow different zones if both users accept remote events
        AND (
          (current_user_data.current_allow_remote = true AND up."allowRemoteEvents" = true)
          OR u.zone = current_user_data.current_zone
        )
        -- Exclude users that have already been contacted by current user
        AND u.id NOT IN (
          SELECT cp_other."userId"
          FROM "Conversations" c
          JOIN "ConversationParticipants" cp_current ON cp_current."conversationId" = c.id
          JOIN "ConversationParticipants" cp_other ON cp_other."conversationId" = c.id
          WHERE cp_current."userId" = :userId
            AND cp_other."userId" != :userId
        )
      GROUP BY
        u.id, u.zone, u."lastConnection",
        up."hasPicture", up."hasExternalCv", up."linkedinUrl", up.description, up.introduction,
        up."allowPhysicalEvents", up."allowRemoteEvents",
        current_user_data.current_allow_physical, current_user_data.current_allow_remote, current_user_data.current_zone,
        activity.response_rate, activity.avg_response_hours, activity.active_conversations_count
    )`;
  }

  /**
   * Formula for calculating profile similarity score
   */
  private buildProfileScoreFormula(): string {
    return `(
      MAX(CASE
        WHEN upe.type = 'profile' AND cue.type = 'profile'
        THEN 1 - (upe.embedding <=> cue.embedding)
        ELSE 0
      END) 
    ) AS profile_score`;
  }

  /**
   * Formula for calculating needs similarity score
   */
  private buildNeedsScoreFormula(): string {
    return `MAX(CASE
      WHEN upe.type = 'needs' AND cue.type = 'needs'
      THEN 1 - (upe.embedding <=> cue.embedding)
      ELSE 0
    END) AS needs_score`;
  }

  /**
   * Formula for calculating activity score
   * Based on: response rate, response time, last connection, workload
   * Uses ACTIVITY_SCORING_CONFIG configuration for all parameters
   */
  private buildActivityScoreFormula(): string {
    const config = ACTIVITY_SCORING_CONFIG;
    const weights = config.weights;

    // Generate CASE WHEN conditions for response time
    const responseTimeCases = config.responseTime.breakpoints
      .map((bp, idx, arr) => {
        if (idx === arr.length - 1) {
          return `        ELSE ${bp.score}`;
        }
        return `        WHEN activity.avg_response_hours <= ${bp.maxHours}  THEN ${bp.score}`;
      })
      .join('\n');

    // Generate CASE WHEN conditions for last connection
    const lastConnectionCases = config.lastConnection.breakpoints
      .map((bp, idx, arr) => {
        if (idx === arr.length - 1) {
          return `        ELSE ${bp.score}`;
        }
        return `        WHEN EXTRACT(DAY FROM NOW() - u."lastConnection") <= ${bp.maxDays}   THEN ${bp.score}`;
      })
      .join('\n');

    // Generate CASE WHEN conditions for workload
    const workloadCases = config.workload.breakpoints
      .map((bp, idx, arr) => {
        if (idx === arr.length - 1) {
          return `        ELSE ${bp.score}`;
        }
        return `        WHEN COALESCE(activity.active_conversations_count, 0) <= ${bp.maxConversations} THEN ${bp.score}`;
      })
      .join('\n');

    // Final weighted formula:
    // - Response rate (weights.responseRate): favors users who respond frequently
    // - Response time (weights.responseTime): favors quick responses
    // - Last connection (weights.lastConnection): favors recently active users
    // - Workload factor (weights.workload): penalizes already heavily solicited users
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
   * Formula for calculating location compatibility score
   * Simply rewards users in the same geographic zone
   * Note: Geographic incompatibilities are already filtered by the WHERE clause
   */
  private buildLocationCompatibilityScoreFormula(): string {
    const config = LOCATION_COMPATIBILITY_CONFIG;

    return `CASE
      WHEN u.zone = current_user_data.current_zone THEN ${config.sameZone}
      ELSE ${config.differentZone}
    END::float AS location_compatibility_score`;
  }

  /**
   * Subquery to calculate user activity statistics
   * (response rate, average response time, last connection, active conversations count)
   * Goal is to balance workload to avoid overloading the most responsive users
   * Uses ACTIVITY_SCORING_CONFIG.timeWindowDays for the time window
   * Excludes conversations with Admin users (welcome messages, etc.)
   */
  private buildActivitySubquery(): string {
    const timeWindowDays = ACTIVITY_SCORING_CONFIG.timeWindowDays;

    return `LEFT JOIN (
      SELECT
        cp_receiver.\"userId\" AS user_id,
        COUNT(CASE WHEN response.id IS NOT NULL THEN 1 END)::float
          / NULLIF(COUNT(DISTINCT c.id), 0) AS response_rate,
        AVG(
          EXTRACT(EPOCH FROM (response.\"createdAt\" - first_msg.\"createdAt\")) / 3600
        ) AS avg_response_hours,
        COUNT(DISTINCT CASE 
          WHEN EXISTS (
            SELECT 1 FROM \"Messages\" m_recent
            WHERE m_recent.\"conversationId\" = c.id
              AND m_recent.\"createdAt\" >= NOW() - INTERVAL '${timeWindowDays} days'
          ) THEN c.id 
          ELSE NULL 
        END) AS active_conversations_count
      FROM \"Conversations\" c
      JOIN \"ConversationParticipants\" cp_receiver ON cp_receiver.\"conversationId\" = c.id
      JOIN \"ConversationParticipants\" cp_other ON cp_other.\"conversationId\" = c.id
        AND cp_other.\"userId\" != cp_receiver.\"userId\"
      JOIN \"Users\" u_other ON u_other.id = cp_other.\"userId\"
      JOIN LATERAL (
        SELECT m.\"createdAt\", m.id
        FROM \"Messages\" m
        JOIN \"ConversationParticipants\" cp ON cp.\"conversationId\" = c.id
        WHERE m.\"conversationId\" = c.id
          AND cp.\"userId\" != cp_receiver.\"userId\"
        ORDER BY m.\"createdAt\" ASC
        LIMIT 1
      ) first_msg ON true
      LEFT JOIN LATERAL (
        SELECT m.\"createdAt\", m.id
        FROM \"Messages\" m
        WHERE m.\"conversationId\" = c.id
          AND m.\"authorId\" = cp_receiver.\"userId\"
          AND m.\"createdAt\" > first_msg.\"createdAt\"
        ORDER BY m.\"createdAt\" ASC
        LIMIT 1
      ) response ON true
      WHERE c.\"createdAt\" >= NOW() - INTERVAL '${timeWindowDays} days'
        AND u_other.role != 'Admin'
      GROUP BY cp_receiver.\"userId\"
    ) activity ON activity.user_id = u.id`;
  }

  /**
   * Final query that selects and combines all scores
   */
  private buildFinalSelect(): string {
    return `SELECT
      "userId",
      profile_score             AS "profileScore",
      needs_score                AS "needsScore",
      activity_score            AS "activityScore",
      location_compatibility_score AS "locationCompatibilityScore",
      ${this.buildFinalScoreFormula()}
    FROM user_scores
    WHERE profile_score > 0 OR needs_score > 0
    ORDER BY "finalScore" DESC
    LIMIT :poolSize`;
  }

  /**
   * Formula for calculating the final weighted score
   */
  private buildFinalScoreFormula(): string {
    return `(
      profile_score             * :weightProfile             +
      needs_score                * :weightNeeds                +
      activity_score            * :weightActivity            +
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
  private computeRelativeReasons(
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
   * Generates recommendations for a user using vector embeddings
   * This method uses cosine similarity to find the most similar profiles
   * @param userId The user ID for which to generate recommendations
   * @returns The recommendations created for the user
   */
  async updateRecommendationsByUserId(
    userId: string,
    poolSize = 3
  ): Promise<UserProfileRecommendation[]> {
    // Retrieve user and profile data
    const user = await this.userProfilesService.findOneUser(userId);

    // Compute mirror roles to find (coaches for candidates, candidates for coaches)
    const rolesToFind: UserRole[] =
      user.role === UserRoles.CANDIDATE
        ? [UserRoles.COACH]
        : [UserRoles.CANDIDATE];

    // Compute similarity scores for potential matches
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
    });

    // Assign reasons based on relative comparison between recommendations
    const matchingResults = this.computeRelativeReasons(scoringResults);

    // Store top recommendations in the database
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
    const oneWeekAgo = moment().subtract(1, 'week');

    const currentRecommendedProfiles = await this.findRecommendationsByUserId(
      user.id
    );

    const oneOfCurrentRecommendedProfilesIsNotAvailable =
      currentRecommendedProfiles.some((recommendedProfile) => {
        return !recommendedProfile?.recUser?.userProfile?.isAvailable;
      });

    if (
      !userProfile.lastRecommendationsDate ||
      moment(userProfile.lastRecommendationsDate).isBefore(oneWeekAgo) ||
      currentRecommendedProfiles.length < poolSize ||
      oneOfCurrentRecommendedProfilesIsNotAvailable
    ) {
      await this.removeRecommendationsByUserId(user.id);
      await this.updateRecommendationsByUserId(user.id, poolSize);
      await this.userProfilesService.updateByUserId(user.id, {
        lastRecommendationsDate: moment().toDate(),
      });
    }

    const recommendedProfiles = await this.findRecommendationsByUserId(user.id);

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
