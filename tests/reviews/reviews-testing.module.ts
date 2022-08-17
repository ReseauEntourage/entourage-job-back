import { Module } from '@nestjs/common';
import { ReviewsModule } from 'src/reviews/reviews.module';
import { ReviewsHelper } from './reviews.helper';

@Module({
  imports: [ReviewsModule],
  providers: [ReviewsHelper],
  exports: [ReviewsHelper],
})
export class ReviewsTestingModule {}
