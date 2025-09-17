import { Module } from '@nestjs/common';
import { ApiKeysModule } from 'src/api-keys/api-keys.module';
import { RecruitementAlertsModule } from 'src/common/recruitement-alerts/recruitement-alerts.module';
import { UsersModule } from 'src/users/users.module';
import { WorkerController } from './worker.controller';

@Module({
  imports: [ApiKeysModule, RecruitementAlertsModule, UsersModule],
  controllers: [WorkerController],
  providers: [],
  exports: [],
})
export class WorkerControllerModule {}
