import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';

import { MailsModule } from 'src/mails/mails.module';
import { getBullWorkQueueOptions } from 'src/queues';
import { WorkQueueProcessor } from './work-queue.processor';

@Module({
  imports: [BullModule.registerQueue(getBullWorkQueueOptions()), MailsModule],
  providers: [WorkQueueProcessor],
  exports: [WorkQueueProcessor],
})
export class ConsumersModule {}
