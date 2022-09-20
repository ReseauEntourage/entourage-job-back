import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Revision, RevisionChange } from './models';
import { RevisionChangesService } from './revision-changes.service';
import { RevisionsService } from './revisions.service';

@Module({
  imports: [SequelizeModule.forFeature([Revision, RevisionChange])],
  providers: [RevisionsService, RevisionChangesService],
  exports: [SequelizeModule, RevisionsService, RevisionChangesService],
})
export class RevisionsModule {}
