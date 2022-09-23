import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Review } from './models';

@Module({
  imports: [SequelizeModule.forFeature([Review])],
  exports: [SequelizeModule],
})
export class ReviewsModule {}
