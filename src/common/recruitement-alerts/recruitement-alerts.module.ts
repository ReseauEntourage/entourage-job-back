import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { SkillsModule } from 'src/common/skills/skills.module';
import { CompanyUser } from 'src/companies/models/company-user.model';
import { UserProfilesModule } from 'src/user-profiles/user-profiles.module';
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
      CompanyUser,
    ]),
    SkillsModule,
    UserProfilesModule,
  ],
  providers: [RecruitementAlertsService],
  controllers: [RecruitementAlertsController],
  exports: [SequelizeModule],
})
export class RecruitementAlertsModule {}
