import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { UpdateUserProfileDto } from './dto';
import { UserProfile, UserProfileInclude } from './models';

@Injectable()
export class UserProfilesService {
  constructor(
    @InjectModel(UserProfile)
    private userProfileModel: typeof UserProfile
  ) {}

  async findOne(id: string) {
    return this.userProfileModel.findByPk(id, {
      include: UserProfileInclude,
    });
  }

  async findOneByUserId(userId: string) {
    return this.userProfileModel.findOne({
      where: { UserId: userId },
      include: UserProfileInclude,
    });
  }

  async updateByUserId(
    userId: string,
    updateUserProfileDto: UpdateUserProfileDto
  ) {
    // TODO manage fields depending on role
    await this.userProfileModel.update(updateUserProfileDto, {
      where: { UserId: userId },
      individualHooks: true,
    });

    const updatedUser = await this.findOneByUserId(userId);

    if (!updatedUser) {
      return null;
    }

    return updatedUser.toJSON();
  }

  async removeByUserId(userId: string) {
    return this.userProfileModel.destroy({
      where: { UserId: userId },
      individualHooks: true,
    });
  }
}
