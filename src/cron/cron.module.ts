import { Module } from '@nestjs/common';
import { QueuesModule } from 'src/queues/producers';
import { CronService } from './cron.service';

@Module({
  imports: [QueuesModule],
  providers: [CronService],
})
export class CronModule {}
