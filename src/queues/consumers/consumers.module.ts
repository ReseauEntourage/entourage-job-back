import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';

import { CVsModule } from 'src/cvs/cvs.module';
import { MailjetModule } from 'src/external-services/mailjet/mailjet.module';
import { PusherService } from 'src/external-services/pusher/pusher.service';
import { SalesforceModule } from 'src/external-services/salesforce/salesforce.module';
import { getBullWorkQueueOptions } from 'src/queues/queues.utils';
import { WorkQueueProcessor } from './work-queue.processor';

@Module({
  imports: [
    BullModule.registerQueue(getBullWorkQueueOptions()),
    CVsModule,
    MailjetModule,
    SalesforceModule,
  ],
  providers: [WorkQueueProcessor, PusherService],
  exports: [WorkQueueProcessor],
})
export class ConsumersModule {}
