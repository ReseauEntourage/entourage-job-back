import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { UserProfile } from 'src/user-profiles/models';

@Injectable()
export class UserProfileDeletionService {
  constructor(
    @InjectModel(UserProfile)
    private userProfileModel: typeof UserProfile
  ) {}

  async removeByUserId(userId: string) {
    return this.userProfileModel.destroy({
      where: { userId },
      individualHooks: true,
    });
  }

  // Bypasses updateByUserId on purpose: the profile row is about to be
  // destroyed by removeByUserId, so going through the regular update path
  // would queue an embedding regeneration that fails once the user/profile
  // no longer exist.
  async clearProfileFieldsForDeletion(userId: string): Promise<void> {
    await this.userProfileModel.update(
      { currentJob: null, description: null },
      { where: { userId }, individualHooks: true }
    );
  }
}
