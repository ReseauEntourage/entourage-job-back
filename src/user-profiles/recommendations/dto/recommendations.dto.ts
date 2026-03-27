import { PublicProfileDto } from 'src/user-profiles/dto/public-profile.dto';
import { UserProfileRecommendation } from 'src/user-profiles/models/user-profile-recommendation.model';

export type RecommendationDto = Pick<
  UserProfileRecommendation,
  | 'id'
  | 'reason'
  | 'profileScore'
  | 'needsScore'
  | 'activityScore'
  | 'locationCompatibilityScore'
  | 'finalScore'
> & {
  publicProfile: PublicProfileDto;
};

export type RecommendationsDto = RecommendationDto[];

/**
 * Paginated response for infinite scroll.
 * `nextCursor` is the rank value to pass as `cursor` in the next request.
 * `null` means there are no more results currently stored.
 */
export type RecommendationsPageDto = {
  recommendations: RecommendationDto[];
  nextCursor: number | null;
};
