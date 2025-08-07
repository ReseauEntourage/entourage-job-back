import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import {
  RecruitementAlert,
  RecruitementAlertBusinessSector,
  RecruitementAlertSkill,
} from './models';
import { RecruitementAlertsController } from './recruitement-alerts.controller';
import { RecruitementAlertsService } from './recruitement-alerts.service';

@Module({
  imports: [
    SequelizeModule.forFeature([
      RecruitementAlert,
      RecruitementAlertBusinessSector,
      RecruitementAlertSkill,
    ]),
  ],
  providers: [RecruitementAlertsService],
  controllers: [RecruitementAlertsController],
  exports: [SequelizeModule],
})
export class RecruitementAlertsModule {}
