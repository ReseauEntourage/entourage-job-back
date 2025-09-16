import { Module } from '@nestjs/common';
import { RecruitementAlertsModule } from 'src/common/recruitement-alerts/recruitement-alerts.module';
import { UsersModule } from 'src/users/users.module';
import { WorkerController } from './worker.controller';

@Module({
  imports: [RecruitementAlertsModule, UsersModule],
  controllers: [WorkerController],
  providers: [],
  exports: [],
})
export class WorkerControllerModule {}
