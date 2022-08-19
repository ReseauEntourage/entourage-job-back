import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Review } from 'src/reviews/models';

@Injectable()
export class ReviewsHelper {
  constructor(
    @InjectModel(Review)
    private reviewModel: typeof Review
  ) {}

  async countReviewsByCVId(cvId: string) {
    return this.reviewModel.count({
      where: {
        CVId: cvId,
      },
    });
  }
}
