/**
 * Weights for the different scoring criteria used in user profile recommendations.
 * These weights determine the importance of each criterion in the overall recommendation score.
 * The criteria include:
 * - profile: similarity of professional background (cosine similarity of embeddings)
 * - needs: specialization in the user's main need (cosine similarity of embeddings)
 * - activity: current responsiveness and availability
 * - locationCompatibility: geographic proximity (filtered by event preferences)
 */
export const SCORING_WEIGHTS = {
  // Weights for each scoring criterion (total should ideally sum to 1.0)
  profile: 40 / 100,
  needs: 20 / 100,
  activity: 30 / 100,
  locationCompatibility: 10 / 100,
} as const;

/**
 * Configuration for activity score calculation.
 * The activity score is composed of 4 sub-scores with their respective weights.
 */
export const ACTIVITY_SCORING_CONFIG = {
  // Weight of each activity score component (total = 1.0)
  weights: {
    responseRate: 0.5, // Message response rate
    responseTime: 0.2, // Response speed
    lastConnection: 0.1, // Freshness of last connection
    workload: 0.2, // Current workload (number of conversations)
  },

  // Response rate configuration
  responseRate: {
    defaultValue: 0.5, // Default value if no data
  },

  // Response time configuration (in hours)
  responseTime: {
    defaultScore: 0.5, // Default score if no data
    breakpoints: [
      { maxHours: 24, score: 1.0 }, // Response in less than 24h
      { maxHours: 72, score: 0.7 }, // Response in less than 72h
      { maxHours: 120, score: 0.4 }, // Response in less than 120h (5 days)
      { maxHours: Infinity, score: 0.1 }, // Beyond
    ],
  },

  // Last connection configuration (in days)
  lastConnection: {
    defaultScore: 0.3, // Default score if no data
    breakpoints: [
      { maxDays: 1, score: 1.0 }, // Connected less than 24 hours ago
      { maxDays: 7, score: 0.7 }, // Connected this week
      { maxDays: 30, score: 0.3 }, // Connected this month
      { maxDays: Infinity, score: 0.1 }, // Beyond
    ],
  },

  // Workload configuration (number of active conversations)
  workload: {
    breakpoints: [
      { maxConversations: 0, score: 1.0 }, // No active conversation
      { maxConversations: 3, score: 0.9 }, // 1-3 conversations
      { maxConversations: 5, score: 0.7 }, // 4-5 conversations
      { maxConversations: 8, score: 0.4 }, // 6-8 conversations
      { maxConversations: Infinity, score: 0.2 }, // 9+ conversations
    ],
  },

  // Time window for activity statistics calculation (in days)
  timeWindowDays: 30,
} as const;

/**
 * Configuration for location compatibility score calculation.
 * This score simply rewards users in the same geographic zone.
 * Note: Geographic incompatibilities are already handled by the WHERE filter.
 */
export const LOCATION_COMPATIBILITY_CONFIG = {
  sameZone: 1.0, // Users are in the same geographic zone
  differentZone: 0.5, // Users are in different zones (but compatible via remote)
} as const;
