import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { CompaniesModule } from 'src/companies/companies.module';
import { MailjetModule } from 'src/external-services/mailjet/mailjet.module';
import { OpenAiModule } from 'src/external-services/openai/openai.module';
import { PusherService } from 'src/external-services/pusher/pusher.service';
import { SalesforceModule } from 'src/external-services/salesforce/salesforce.module';
import { SlackModule } from 'src/external-services/slack/slack.module';
import { ProfileGenerationModule } from 'src/profile-generation/profile-generation.module';
import {
  getBullWorkQueueOptions,
  getBullProfileGenerationQueueOptions,
  getBullCronTasksQueueOptions,
} from 'src/queues/queues.utils';
import { UserProfilesModule } from 'src/user-profiles/user-profiles.module';
import { UsersModule } from 'src/users/users.module';
import { UsersDeletionModule } from 'src/users-deletion/users-deletion.module';
import { CronTasksSlackReporterService } from './cron-tasks/cron-tasks-slack-reporter.service';
import { CronTasksProcessor } from './cron-tasks/cron-tasks.processor';
import { ProfileGeneratorProcessor } from './profile-generator.processor';
import { WorkQueueProcessor } from './work-queue.processor';

@Module({
  imports: [
    BullModule.registerQueue(getBullWorkQueueOptions()),
    BullModule.registerQueue(getBullProfileGenerationQueueOptions()),
    BullModule.registerQueue(getBullCronTasksQueueOptions()),
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
  ],
  providers: [
    WorkQueueProcessor,
    ProfileGeneratorProcessor,
    PusherService,
    CronTasksSlackReporterService,
    CronTasksProcessor,
  ],
  exports: [WorkQueueProcessor, ProfileGeneratorProcessor, CronTasksProcessor],
})
export class ConsumersModule {}
