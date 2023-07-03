import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { BusinessLine } from './models';

@Module({
  imports: [SequelizeModule.forFeature([BusinessLine])],
  exports: [SequelizeModule],
})
export class BusinessLinesModule {}
