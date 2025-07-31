import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Review } from './models';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectModel(Review)
    private reviewsModel: typeof Review
  ) {}

  async findByUserProfileId(userProfileId: string) {
    return this.reviewsModel.findAll({
      where: { userProfileId },
    });
  }
}
