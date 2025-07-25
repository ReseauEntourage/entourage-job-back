import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Interest } from './models';

@Injectable()
export class InterestsService {
  constructor(
    @InjectModel(Interest)
    private interestModel: typeof Interest
  ) {}

  async findByUserProfileId(userProfileId: string) {
    return this.interestModel.findAll({
      where: { userProfileId },
      attributes: ['id', 'name', 'order'],
      order: [['order', 'ASC']],
    });
  }
}
