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
      businessSectors: expect.arrayContaining(
        user.userProfile.businessSectors.map(({ name }) =>
          expect.objectContaining({
            name,
          })
        )
      ),
      occupations: expect.arrayContaining(
        user.userProfile.occupations.map(({ name }) =>
          expect.objectContaining({
            name,
          })
        )
      ),
      userProfileNudges: expect.arrayContaining(
        user.userProfile.userProfileNudges.map(({ id }) =>
          expect.objectContaining({
            id,
          })
        )
      ),
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
