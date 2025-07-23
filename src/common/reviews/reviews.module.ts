import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Review } from './models';
import { ReviewsService } from './reviews.service';

@Module({
  imports: [SequelizeModule.forFeature([Review])],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
