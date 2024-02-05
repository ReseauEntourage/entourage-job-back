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
      currentJob: user.userProfile.currentJob,
      department: user.userProfile.department,
      lastReceivedMessage: null,
      lastSentMessage: null,
      networkBusinessLines: expect.arrayContaining(
        user.userProfile.networkBusinessLines.map(({ name }) =>
          expect.objectContaining({
            name,
          })
        )
      ),
      searchBusinessLines: expect.arrayContaining(
        user.userProfile.searchBusinessLines.map(({ name }) =>
          expect.objectContaining({
            name,
          })
        )
      ),
      searchAmbitions: expect.arrayContaining(
        user.userProfile.searchAmbitions.map(({ name }) =>
          expect.objectContaining({
            name,
          })
        )
      ),
      helpNeeds: expect.arrayContaining(
        user.userProfile.helpNeeds.map(({ name }) =>
          expect.objectContaining({
            name,
          })
        )
      ),
      helpOffers: expect.arrayContaining(
        user.userProfile.helpOffers.map(({ name }) =>
          expect.objectContaining({
            name,
          })
        )
      ),
    } as Partial<UserProfile & User>;
  }
}
