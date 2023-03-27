import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';

import { CVsModule } from 'src/cvs/cvs.module';
import { MailjetModule } from 'src/external-services/mailjet/mailjet.module';
import { PusherService } from 'src/external-services/pusher/pusher.service';
import { SalesforceModule } from 'src/external-services/salesforce/salesforce.module';
import { VonageModule } from 'src/external-services/vonage/vonage.module';
import { OpportunitiesModule } from 'src/opportunities/opportunities.module';
import { getBullWorkQueueOptions } from 'src/queues/queues.utils';
import { WorkQueueProcessor } from './work-queue.processor';

@Module({
  imports: [
    BullModule.registerQueue(getBullWorkQueueOptions()),
    CVsModule,
    OpportunitiesModule,
    MailjetModule,
    VonageModule,
    SalesforceModule,
  ],
  providers: [WorkQueueProcessor, PusherService],
  exports: [WorkQueueProcessor],
})
export class ConsumersModule {}
