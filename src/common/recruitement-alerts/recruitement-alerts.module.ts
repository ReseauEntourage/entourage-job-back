import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import {
  RecruitementAlert,
  RecruitementAlertBusinessSector,
  RecruitementAlertSkill,
} from './models';

@Module({
  imports: [
    SequelizeModule.forFeature([
      RecruitementAlert,
      RecruitementAlertBusinessSector,
      RecruitementAlertSkill,
    ]),
  ],
  exports: [SequelizeModule],
})
export class RecruitementAlertsModule {}
