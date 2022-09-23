import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Ambition } from './models';

@Module({
  imports: [SequelizeModule.forFeature([Ambition])],
  exports: [SequelizeModule],
})
export class AmbitionsModule {}
