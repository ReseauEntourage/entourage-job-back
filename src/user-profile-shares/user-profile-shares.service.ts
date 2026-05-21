import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { CreateUserProfileShareDto } from './dto/create-user-profile-share.dto';
import { UserProfileShare } from './models/user-profile-share.model';

@Injectable()
export class UserProfileSharesService {
  constructor(
    @InjectModel(UserProfileShare)
    private readonly userProfileShareModel: typeof UserProfileShare
  ) {}

  async create(dto: CreateUserProfileShareDto): Promise<UserProfileShare> {
    return this.userProfileShareModel.create({ ...dto });
  }

  async findReceivedByUserId(
    sharedUserId: string
  ): Promise<UserProfileShare[]> {
    return this.userProfileShareModel.findAll({
      where: { sharedUserId },
      order: [['createdAt', 'DESC']],
    });
  }

  async findSentByUserId(sharingUserId: string): Promise<UserProfileShare[]> {
    return this.userProfileShareModel.findAll({
      where: { sharingUserId },
      order: [['createdAt', 'DESC']],
    });
  }
}
