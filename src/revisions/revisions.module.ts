import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Revision, RevisionChange } from './models';

@Module({
  imports: [SequelizeModule.forFeature([Revision, RevisionChange])],
  exports: [SequelizeModule],
})
export class RevisionsModule {}
