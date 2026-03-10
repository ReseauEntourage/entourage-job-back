import { InjectModel } from '@nestjs/sequelize';
import moment from 'moment';
import 'moment/locale/fr';

import {
  generatePublicProfileDto,
  PublicProfileDto,
} from '../dto/public-profile.dto';
import { UserProfile } from 'src/user-profiles/models';
import { UserProfileRecommendation } from 'src/user-profiles/models/user-profile-recommendation.model';
import {
  UserProfilesAttributes,
  UserProfilesUserAttributes,
} from 'src/user-profiles/models/user-profile.attributes';
import { getUserProfileInclude } from 'src/user-profiles/models/user-profile.include';
import { UserProfilesService } from 'src/user-profiles/user-profiles.service';
import { User } from 'src/users/models';
import { getUserProfileRecommendationOrder } from 'src/users/models/user.include';
import { UserProfileMatchingResult } from './user-profile-recommendation.types';

/**
 * This abstract class defines the structure for user profile recommendation services.
 * It includes methods for removing, finding, and creating recommendations, as well as a method to retrieve or compute recommendations for a given user ID.
 * The actual logic for updating recommendations based on user ID is left abstract and should be implemented by any class that extends this abstract class.
 */
export abstract class UserProfileRecommendationBase {
  constructor(
    @InjectModel(UserProfileRecommendation)
    protected userProfileRecommandationModel: typeof UserProfileRecommendation,
    protected userProfilesService: UserProfilesService
  ) {}

  async removeRecommendationsByUserId(userId: string) {
    return this.userProfileRecommandationModel.destroy({
      where: { UserId: userId },
      individualHooks: true,
    });
  }

  async findRecommendationsByUserId(
    userId: string
  ): Promise<UserProfileRecommendation[]> {
    return this.userProfileRecommandationModel.findAll({
      where: { UserId: userId },
      order: getUserProfileRecommendationOrder(),
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
        ],
      },
    });
  }

  async createRecommendations(userId: string, usersToRecommendIds: string[]) {
    return this.userProfileRecommandationModel.bulkCreate(
      usersToRecommendIds.map(
        (userToRecommendId) => {
          return {
            UserId: userId,
            recommendedUserId: userToRecommendId,
          };
        },
        {
          hooks: true,
          individualHooks: true,
        }
      )
    );
  }

  async createRecommendationsFromUserProfileMatchingResult(
    userId: string,
    matchingResults: UserProfileMatchingResult[]
  ) {
    return this.userProfileRecommandationModel.bulkCreate(
      matchingResults.map(
        (matchingResult) => {
          return {
            UserId: userId,
            recommendedUserId: matchingResult.userId,
            reason: matchingResult.dominantReason,
          };
        },
        {
          hooks: true,
          individualHooks: true,
        }
      )
    );
  }

  async retrieveOrComputeRecommendationsForUserId(
    user: User,
    userProfile: UserProfile,
    poolSize = 3
  ): Promise<PublicProfileDto[]> {
    const oneWeekAgo = moment().subtract(1, 'week');

    const currentRecommendedProfiles = await this.findRecommendationsByUserId(
      user.id
    );

    const oneOfCurrentRecommendedProfilesIsNotAvailable =
      currentRecommendedProfiles.some((recommendedProfile) => {
        return !recommendedProfile?.recUser?.userProfile?.isAvailable;
      });

    if (
      !userProfile.lastRecommendationsDate ||
      moment(userProfile.lastRecommendationsDate).isBefore(oneWeekAgo) ||
      currentRecommendedProfiles.length < poolSize ||
      oneOfCurrentRecommendedProfilesIsNotAvailable
    ) {
      await this.removeRecommendationsByUserId(user.id);
      await this.updateRecommendationsByUserId(user.id, poolSize);
      await this.userProfilesService.updateByUserId(user.id, {
        lastRecommendationsDate: moment().toDate(),
      });
    }

    const recommendedProfiles = await this.findRecommendationsByUserId(user.id);

    return Promise.all(
      recommendedProfiles.map((recoProfile) =>
        generatePublicProfileDto(
          recoProfile.recUser,
          recoProfile.recUser.userProfile,
          null
        )
      )
    );
  }

  abstract updateRecommendationsByUserId(
    userId: string,
    poolSize?: number
  ): Promise<UserProfileRecommendation[]>;
}
