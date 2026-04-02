import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { CompaniesModule } from 'src/companies/companies.module';
import { EmbeddingsModule } from 'src/embeddings/embeddings.module';
import { MailjetModule } from 'src/external-services/mailjet/mailjet.module';
import { OpenAiModule } from 'src/external-services/openai/openai.module';
import { PusherService } from 'src/external-services/pusher/pusher.service';
import { SalesforceModule } from 'src/external-services/salesforce/salesforce.module';
import { SlackModule } from 'src/external-services/slack/slack.module';
import { GamificationModule } from 'src/gamification/gamification.module';
import { MessagingModule } from 'src/messaging/messaging.module';
import { ProfileGenerationModule } from 'src/profile-generation/profile-generation.module';
import {
  getBullWorkQueueOptions,
  getBullProfileGenerationQueueOptions,
  getBullCronTasksQueueOptions,
  getEmbeddingQueueOptions,
} from 'src/queues/queues.utils';
import { UserProfilesModule } from 'src/user-profiles/user-profiles.module';
import { UsersModule } from 'src/users/users.module';
import { UsersDeletionModule } from 'src/users-deletion/users-deletion.module';
import { CronTasksSlackReporterService } from './cron-tasks/cron-tasks-slack-reporter.service';
import { CronTasksProcessor } from './cron-tasks/cron-tasks.processor';
import { EmbeddingQueueProcessor } from './embedding-queue.processor';
import { ProfileGeneratorProcessor } from './profile-generator.processor';
import { WorkQueueProcessor } from './work-queue.processor';

@Module({
  imports: [
    BullModule.registerQueue(getBullWorkQueueOptions()),
    BullModule.registerQueue(getBullProfileGenerationQueueOptions()),
    BullModule.registerQueue(getBullCronTasksQueueOptions()),
    BullModule.registerQueue(getEmbeddingQueueOptions()),
    MailjetModule,
    OpenAiModule,
    SalesforceModule,
    ProfileGenerationModule,
    CompaniesModule,
    SlackModule,
    UsersModule,
    UsersDeletionModule,
    UsersModule,
    UserProfilesModule,
    MessagingModule,
    EmbeddingsModule,
    GamificationModule,
  ],
  providers: [
    WorkQueueProcessor,
    ProfileGeneratorProcessor,
    PusherService,
    CronTasksSlackReporterService,
    CronTasksProcessor,
    EmbeddingQueueProcessor,
  ],
  exports: [
    WorkQueueProcessor,
    ProfileGeneratorProcessor,
    CronTasksProcessor,
    EmbeddingQueueProcessor,
  ],
})
export class ConsumersModule {}
