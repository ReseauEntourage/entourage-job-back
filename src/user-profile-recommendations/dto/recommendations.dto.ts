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
 * `embeddingPending` is true when the user's embedding is being regenerated —
 * in that case recommendations are empty and the front should wait for EMBEDDING_READY.
 */
export type RecommendationsPageDto = {
  embeddingPending: boolean;
  nextCursor: number | null;
  recommendations: RecommendationDto[];
};
