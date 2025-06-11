import path from 'path';
import { Injectable } from '@nestjs/common';
import { UserProfile } from 'src/user-profiles/models';
import { UserProfilesService } from 'src/user-profiles/user-profiles.service';
import { User } from 'src/users/models';

@Injectable()
export class UserProfilesHelper {
  constructor(private userProfilesService: UserProfilesService) {}

  async findOneProfileByUserId(userId: string) {
    return this.userProfilesService.findOneByUserId(userId);
  }

  async findOneProfile(profileId: string) {
    return this.userProfilesService.findOne(profileId);
  }

  getTestImagePath() {
    return path.join(process.cwd(), '/tests/test-data/image-test.jpg');
  }

  mapUserProfileFromUser(user: User): Partial<UserProfile & User> {
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      description: user.userProfile.description,
      introduction: user.userProfile.introduction,
      currentJob: user.userProfile.currentJob,
      department: user.userProfile.department,
      isAvailable: user.userProfile.isAvailable,
      lastReceivedMessage: null,
      lastSentMessage: null,
      sectorOccupations: expect.arrayContaining(
        user.userProfile.sectorOccupations.map((sectorOccupation) => ({
          id: sectorOccupation.id,
          businessSector: expect.objectContaining({
            id: sectorOccupation.businessSector.id,
          }),
          occupation: sectorOccupation.occupation
            ? expect.objectContaining({
                name: sectorOccupation.occupation.name,
              })
            : null,
          order: sectorOccupation.order,
        }))
      ),
      nudges: user.userProfile.nudges,
    } as Partial<UserProfile & User>;
  }

  async createUserProfileRecommendations(
    userId: string,
    usersToRecommendIds: string[]
  ) {
    return this.userProfilesService.createRecommendations(
      userId,
      usersToRecommendIds
    );
  }
}
