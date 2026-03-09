import { Injectable } from '@nestjs/common';
import { UserProfileRecommendation } from '../models/user-profile-recommendation.model';
import { UserProfileRecommendationBase } from './user-profile-recommendation-base';

@Injectable()
export class UserProfileRecommendationsService extends UserProfileRecommendationBase {
  async updateRecommendationsByUserId(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    userId: string
  ): Promise<UserProfileRecommendation[]> {
    return [];
  }
}
