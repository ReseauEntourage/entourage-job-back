import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Interest } from './models';

@Module({
  imports: [SequelizeModule.forFeature([Interest])],
  exports: [SequelizeModule],
})
export class InterestsModule {}
