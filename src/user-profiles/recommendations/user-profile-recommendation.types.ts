export enum MatchingReason {
  PROFILE = 'profile',
  NEEDS = 'needs',
  ACTIVITY = 'activity',
  LOCATION_COMPATIBILITY = 'locationCompatibility',
}

export interface UserProfileMatchingResult {
  userId: string;
  profileScore: number;
  needsScore: number;
  activityScore: number;
  locationCompatibilityScore: number;
  finalScore: number;
  dominantReason: MatchingReason;
}
