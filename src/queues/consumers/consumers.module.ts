import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';

import { CVsModule } from 'src/cvs';
import { MailsModule } from 'src/mails';
import { getBullWorkQueueOptions } from 'src/queues';
import { WorkQueueProcessor } from './work-queue.processor';

@Module({
  imports: [
    BullModule.registerQueue(getBullWorkQueueOptions()),
    CVsModule,
    MailsModule,
  ],
  providers: [WorkQueueProcessor],
  exports: [WorkQueueProcessor],
})
export class ConsumersModule {}
