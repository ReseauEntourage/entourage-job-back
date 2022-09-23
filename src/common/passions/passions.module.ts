import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Passion } from './models';

@Module({
  imports: [SequelizeModule.forFeature([Passion])],
  exports: [SequelizeModule],
})
export class PassionsModule {}
