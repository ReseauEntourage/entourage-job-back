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
