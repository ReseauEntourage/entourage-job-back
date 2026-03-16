export enum MatchingReason {
  PROFILE = 'profile',
  NEEDS = 'needs',
  ACTIVITY = 'activity',
  LOCATION_COMPATIBILITY = 'locationCompatibility',
}

export type UserProfileScoringResult = {
  userId: string;
  profileScore: number;
  needsScore: number;
  activityScore: number;
  locationCompatibilityScore: number;
  finalScore: number;
};

export interface UserProfileMatchingResult extends UserProfileScoringResult {
  dominantReason: MatchingReason;
}
