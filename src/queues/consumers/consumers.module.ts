import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';

import { CVsModule } from 'src/cvs/cvs.module';
import { MailsModule } from 'src/mails/mails.module';
import { getBullWorkQueueOptions } from 'src/queues/queues.utils';
import { PusherService } from './pusher.service';
import { WorkQueueProcessor } from './work-queue.processor';

@Module({
  imports: [
    BullModule.registerQueue(getBullWorkQueueOptions()),
    CVsModule,
    MailsModule,
  ],
  providers: [WorkQueueProcessor, PusherService],
  exports: [WorkQueueProcessor],
})
export class ConsumersModule {}
