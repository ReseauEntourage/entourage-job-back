import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { CVsModule } from 'src/cvs/cvs.module';
import { MailjetModule } from 'src/external-services/mailjet/mailjet.module';
import { OpenAiModule } from 'src/external-services/openai/openai.module';
import { PusherService } from 'src/external-services/pusher/pusher.service';
import { SalesforceModule } from 'src/external-services/salesforce/salesforce.module';
import { ProfileGenerationModule } from 'src/profile-generation/profile-generation.module';
import {
  getBullWorkQueueOptions,
  getBullProfileGenerationQueueOptions,
} from 'src/queues/queues.utils';
import { ProfileGeneratorProcessor } from './profile-generator.processor';
import { WorkQueueProcessor } from './work-queue.processor';

@Module({
  imports: [
    BullModule.registerQueue(getBullWorkQueueOptions()),
    BullModule.registerQueue(getBullProfileGenerationQueueOptions()),
    CVsModule,
    MailjetModule,
    OpenAiModule,
    SalesforceModule,
    ProfileGenerationModule,
  ],
  providers: [WorkQueueProcessor, ProfileGeneratorProcessor, PusherService],
  exports: [WorkQueueProcessor, ProfileGeneratorProcessor],
})
export class ConsumersModule {}
