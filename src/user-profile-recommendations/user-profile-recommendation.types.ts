export enum MatchingReason {
  ACTIVITY = 'activity',
  LOCATION_COMPATIBILITY = 'locationCompatibility',
  NEEDS = 'needs',
  PROFILE = 'profile',
}

export type UserProfileScoringResult = {
  activityScore: number;
  finalScore: number;
  locationCompatibilityScore: number;
  needsScore: number;
  profileScore: number;
  userId: string;
};

export interface UserProfileMatchingResult extends UserProfileScoringResult {
  dominantReason: MatchingReason;
}
