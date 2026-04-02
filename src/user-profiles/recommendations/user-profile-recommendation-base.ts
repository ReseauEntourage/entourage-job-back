import { forwardRef, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';

import { UserAchievement } from 'src/gamification/models';
import { userAchievementAttributes } from 'src/gamification/models/user-achievement/user-achievement.helper';
import { UserProfile } from 'src/user-profiles/models';
import { UserProfileRecommendation } from 'src/user-profiles/models/user-profile-recommendation.model';
import {
  UserProfilesAttributes,
  UserProfilesUserAttributes,
} from 'src/user-profiles/models/user-profile.attributes';
import { getUserProfileInclude } from 'src/user-profiles/models/user-profile.include';
import { UserProfilesService } from 'src/user-profiles/user-profiles.service';
import { User } from 'src/users/models';
import { UserProfileMatchingResult } from './user-profile-recommendation.types';

export abstract class UserProfileRecommendationBase {
  constructor(
    @InjectModel(UserProfileRecommendation)
    protected userProfileRecommandationModel: typeof UserProfileRecommendation,
    @Inject(forwardRef(() => UserProfilesService))
    protected userProfilesService: UserProfilesService
  ) {}

  /**
   * Deletes all stored recommendations for a user.
   * @param userId The ID of the user for whom to delete recommendations.
   * @returns A promise that resolves when the operation is complete.
   */
  async removeRecommendationsByUserId(userId: string) {
    return this.userProfileRecommandationModel.destroy({
      where: { UserId: userId },
      individualHooks: true,
    });
  }

  /**
   * Finds stored recommendations for a user.
   * Without options: returns all recommendations ordered by rank (backward compat).
   * With cursor/limit: returns a page starting after `cursor` rank.
   */
  async findRecommendationsByUserId(
    userId: string,
    options?: { limit?: number; cursor?: number }
  ): Promise<UserProfileRecommendation[]> {
    const where: Record<string, unknown> = { UserId: userId };

    if (options?.cursor !== undefined) {
      where.rank = { [Op.gt]: options.cursor };
    }

    return this.userProfileRecommandationModel.findAll({
      where,
      order: [['rank', 'ASC']],
      ...(options?.limit !== undefined ? { limit: options.limit } : {}),
      include: {
        model: User,
        as: 'recUser',
        attributes: UserProfilesUserAttributes,
        include: [
          {
            model: UserProfile,
            as: 'userProfile',
            attributes: UserProfilesAttributes,
            include: getUserProfileInclude(),
          },
          {
            model: UserAchievement,
            as: 'achievements',
            attributes: userAchievementAttributes,
            where: { active: true },
            required: false,
          },
        ],
      },
    });
  }

  /**
   * Returns the total number of stored recommendations for a user.
   * Used to decide when to trigger a background refill.
   */
  async countRecommendationsByUserId(userId: string): Promise<number> {
    return this.userProfileRecommandationModel.count({
      where: { UserId: userId },
    });
  }

  /**
   * Lightweight fetch of stored recommendation metadata (no profile joins).
   * Used to build the excludeUserIds list for incremental appends.
   */
  async getStoredRecommendationsMeta(
    userId: string
  ): Promise<{ recommendedUserId: string; rank: number | null }[]> {
    return this.userProfileRecommandationModel.findAll({
      where: { UserId: userId },
      attributes: ['recommendedUserId', 'rank'],
      raw: true,
    }) as unknown as { recommendedUserId: string; rank: number | null }[];
  }

  /**
   * Persists a batch of recommendations given a list of user IDs to recommend.
   *
   * @param userId The ID of the user for whom to create recommendations.
   * @param usersToRecommendIds The list of user IDs to recommend.
   * @returns A promise that resolves when the operation is complete.
   */
  async createRecommendations(userId: string, usersToRecommendIds: string[]) {
    return this.userProfileRecommandationModel.bulkCreate(
      usersToRecommendIds.map((userToRecommendId) => {
        return {
          UserId: userId,
          recommendedUserId: userToRecommendId,
        };
      }),
      {
        hooks: true,
        individualHooks: true,
      }
    );
  }

  /**
   * Persists a batch of matching results as recommendations.
   * `startRank` allows appending subsequent batches after an existing pool
   * (e.g. startRank = 51 to append ranks 51–100 after an initial pool of 50).
   */
  async createRecommendationsFromUserProfileMatchingResult(
    userId: string,
    matchingResults: UserProfileMatchingResult[],
    startRank = 1
  ) {
    return this.userProfileRecommandationModel.bulkCreate(
      matchingResults.map((matchingResult, index) => {
        return {
          UserId: userId,
          recommendedUserId: matchingResult.userId,
          reason: matchingResult.dominantReason,
          profileScore: matchingResult.profileScore,
          needsScore: matchingResult.needsScore,
          activityScore: matchingResult.activityScore,
          locationCompatibilityScore: matchingResult.locationCompatibilityScore,
          finalScore: matchingResult.finalScore,
          rank: startRank + index,
        };
      }),
      {
        hooks: true,
        individualHooks: true,
      }
    );
  }

  abstract updateRecommendationsByUserId(
    userId: string,
    poolSize?: number
  ): Promise<UserProfileRecommendation[]>;
}
