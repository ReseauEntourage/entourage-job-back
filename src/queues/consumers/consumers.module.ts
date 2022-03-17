import { Module } from '@nestjs/common';

import { BullModule } from '@nestjs/bull';
import { getBullWorkQueueOptions } from '../queues.type';
import { MailsModule } from 'src/mails/mails.module';
import { WorkQueueProcessor } from './work-queue.processor';

@Module({
  imports: [MailsModule, BullModule.registerQueue(getBullWorkQueueOptions())],
  providers: [WorkQueueProcessor],
  exports: [WorkQueueProcessor],
})
export class ConsumersModule {}
