import { Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { QueryTypes } from 'sequelize';
import { UserProfileRecommendation } from '../models/user-profile-recommendation.model';
import { UserProfilesService } from '../user-profiles.service';
import { EMBEDDING_CONFIG } from 'src/embeddings/embedding.config';
import { UserRole, UserRoles } from 'src/users/users.types';
import {
  ACTIVITY_SCORING_CONFIG,
  LOCATION_COMPATIBILITY_CONFIG,
  QUALITY_SCORING_CONFIG,
  SCORING_WEIGHTS,
} from './scoring.config';
import { UserProfileRecommendationBase } from './user-profile-recommendation-base';
import { UserProfileMatchingResult } from './user-profile-recommendation.types';

@Injectable()
export class UserProfileRecommendationsService extends UserProfileRecommendationBase {
  constructor(
    @InjectModel(UserProfileRecommendation)
    userProfileRecommandationModel: typeof UserProfileRecommendation,
    @Inject(UserProfilesService)
    userProfilesService: UserProfilesService
  ) {
    super(userProfileRecommandationModel, userProfilesService);
  }

  async findBySimilarity(params: {
    userId: string;
    rolesToFind: UserRole[];
    configVersion: string;
    weightProfile: number;
    weightNeeds: number;
    weightActivity: number;
    weightLocationCompatibility: number;
    poolSize: number;
  }): Promise<UserProfileMatchingResult[]> {
    const {
      userId,
      rolesToFind,
      configVersion,
      weightProfile,
      weightNeeds,
      weightActivity,
      weightLocationCompatibility,
      poolSize,
    } = params;

    const sql = this.buildSimilarityQuery(rolesToFind);

    return this.userProfileRecommandationModel.sequelize.query<UserProfileMatchingResult>(
      sql,
      {
        type: QueryTypes.SELECT,
        replacements: {
          userId,
          configVersion,
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
        AND upe."configVersion"       = :configVersion
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
  /**
   * Formula for calculating profile similarity score
   * The profile score is weighted by the quality score to favor complete profiles
   * while not completely excluding users with incomplete profiles
   */
  private buildProfileScoreFormula(): string {
    const qualityFormula = this.buildQualityScoreFormula();
    return `(
      MAX(CASE
        WHEN upe.type = 'profile' AND cue.type = 'profile'
        THEN 1 - (upe.embedding <=> cue.embedding)
        ELSE 0
      END) * ${qualityFormula}
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
   * Formula for calculating quality score
   * This score is used to weight the profile score
   */
  private buildQualityScoreFormula(): string {
    const criteria = QUALITY_SCORING_CONFIG.criteria;
    const totalCriteria = criteria.length;

    const criteriaChecks = criteria
      .map((criterion) => {
        // Handle NULL or boolean cases based on criterion type
        if (criterion.startsWith('has')) {
          return `CASE WHEN up."${criterion}" = true THEN 1 ELSE 0 END`;
        } else {
          return `CASE WHEN up."${criterion}" IS NOT NULL THEN 1 ELSE 0 END`;
        }
      })
      .join(' +\n       ');

    return `(
      (${criteriaChecks})
      ::float / ${totalCriteria}
    )`;
  }

  /**
   * Formula for calculating location compatibility score
   * Based on matching event preferences (physical/remote) and geographic proximity
   * Uses LOCATION_COMPATIBILITY_CONFIG configuration for all parameters
   */
  private buildLocationCompatibilityScoreFormula(): string {
    const config = LOCATION_COMPATIBILITY_CONFIG;
    const weights = config.weights;

    // location preferences component: rewards users with matching event type preferences
    // - Both accept physical events
    // - Both accept remote events
    // Geographic proximity component: rewards users in the same zone when both accept physical events
    return `COALESCE((
      -- Location preferences compatibility (${weights.eventPreferences * 100}%)
      CASE
        WHEN (up."allowPhysicalEvents" = current_user_data.current_allow_physical
              AND up."allowPhysicalEvents" = true)
         AND (up."allowRemoteEvents" = current_user_data.current_allow_remote
              AND up."allowRemoteEvents" = true)
        THEN ${config.eventPreferences.bothPhysical}
        WHEN up."allowPhysicalEvents" = current_user_data.current_allow_physical
             AND up."allowPhysicalEvents" = true
        THEN ${config.eventPreferences.bothPhysical}
        WHEN up."allowRemoteEvents" = current_user_data.current_allow_remote
             AND up."allowRemoteEvents" = true
        THEN ${config.eventPreferences.bothRemote}
        WHEN (up."allowPhysicalEvents" = true AND current_user_data.current_allow_remote = true)
          OR (up."allowRemoteEvents" = true AND current_user_data.current_allow_physical = true)
        THEN ${config.eventPreferences.oneMatch}
        ELSE ${config.eventPreferences.noMatch}
      END * ${weights.eventPreferences}
      +
      CASE
        WHEN up."allowPhysicalEvents" = true
         AND current_user_data.current_allow_physical = true
         AND u.zone = current_user_data.current_zone
        THEN ${config.geographicProximity.sameZone}
        WHEN up."allowPhysicalEvents" = true
         AND current_user_data.current_allow_physical = true
         AND u.zone != current_user_data.current_zone
        THEN ${config.geographicProximity.differentZone}
        ELSE ${config.geographicProximity.notApplicable}
      END * ${weights.geographicProximity}
    ), 0.0)::float AS location_compatibility_score`;
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
      ${this.buildFinalScoreFormula()},
      ${this.buildDominantReasonFormula()}
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
   * Formula to determine the dominant reason for the score
   */
  private buildDominantReasonFormula(): string {
    return `CASE
      WHEN profile_score  * :weightProfile  >= needs_score     * :weightNeeds
       AND profile_score  * :weightProfile  >= activity_score * :weightActivity
       AND profile_score  * :weightProfile  >= location_compatibility_score * :weightLocationCompatibility
      THEN 'profile'
      WHEN needs_score     * :weightNeeds     >= activity_score * :weightActivity
       AND needs_score     * :weightNeeds     >= location_compatibility_score * :weightLocationCompatibility
      THEN 'needs'
      WHEN activity_score * :weightActivity >= location_compatibility_score * :weightLocationCompatibility
      THEN 'activity'
      ELSE 'locationCompatibility'
    END AS "dominantReason"`;
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
    const matchingResults = await this.findBySimilarity({
      userId,
      rolesToFind: rolesToFind,
      configVersion: EMBEDDING_CONFIG.profile.version,
      weightProfile: SCORING_WEIGHTS.profile,
      weightNeeds: SCORING_WEIGHTS.needs,
      weightActivity: SCORING_WEIGHTS.activity,
      weightLocationCompatibility: SCORING_WEIGHTS.locationCompatibility,
      poolSize,
    });

    // Store top recommendations in the database
    return this.createRecommendationsFromUserProfileMatchingResult(
      userId,
      matchingResults
    );
  }
}
