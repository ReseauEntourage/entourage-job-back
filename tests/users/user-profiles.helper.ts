import path from 'path';
import { Injectable } from '@nestjs/common';
import { UserProfilesService } from 'src/user-profiles/user-profiles.service';

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
}
