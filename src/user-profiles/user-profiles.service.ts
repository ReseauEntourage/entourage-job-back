import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { CreateUserProfileDto } from './dto/create-user-profile.dto';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import { UserProfile } from './models';

@Injectable()
export class UserProfilesService {
  constructor(
    @InjectModel(UserProfile)
    private userProfileModel: typeof UserProfile
  ) {}

  create(createUserProfileDto: CreateUserProfileDto) {
    return 'This action adds a new userProfile';
  }

  findAll() {
    return `This action returns all userProfiles`;
  }

  async findOneByUserId(userId: string) {
    return this.userProfileModel.findOne({
      where: { UserId: userId },
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
