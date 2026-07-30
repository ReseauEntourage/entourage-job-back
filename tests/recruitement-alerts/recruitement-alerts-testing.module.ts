import { Module } from '@nestjs/common';
import { RecruitementAlertsModule } from 'src/recruitement-alerts/recruitement-alerts.module';
import { RecruitementAlertFactory } from './recruitement-alert.factory';

@Module({
  imports: [RecruitementAlertsModule],
  providers: [RecruitementAlertFactory],
  exports: [RecruitementAlertFactory],
})
export class RecruitementAlertsTestingModule {}
