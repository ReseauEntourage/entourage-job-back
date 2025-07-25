import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';

import { CVsModule } from 'src/cvs/cvs.module';
import { MailjetModule } from 'src/external-services/mailjet/mailjet.module';
import { PusherService } from 'src/external-services/pusher/pusher.service';
import { SalesforceModule } from 'src/external-services/salesforce/salesforce.module';
import {
  getBullWorkQueueOptions,
  getBullProfileGenerationQueueOptions,
} from 'src/queues/queues.utils';
import { ProfileGenerationModule } from './profile-generation.module';
import { WorkQueueProcessor } from './work-queue.processor';

@Module({
  imports: [
    BullModule.registerQueue(getBullWorkQueueOptions()),
    BullModule.registerQueue(getBullProfileGenerationQueueOptions()),
    CVsModule,
    MailjetModule,
    SalesforceModule,
    ProfileGenerationModule,
  ],
  providers: [WorkQueueProcessor, PusherService],
  exports: [WorkQueueProcessor],
})
export class ConsumersModule {}
