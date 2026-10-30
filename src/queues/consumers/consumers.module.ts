import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { CheckinModule } from 'src/checkin/checkin.module';
import { CommunicationLogsModule } from 'src/communication-logs/communication-logs.module';
import { CompaniesModule } from 'src/companies/companies.module';
import { EmbeddingsModule } from 'src/embeddings/embeddings.module';
import { CvExtractionModule } from 'src/external-services/cv-extraction/cv-extraction.module';
import { MailjetModule } from 'src/external-services/mailjet/mailjet.module';
import { PusherService } from 'src/external-services/pusher/pusher.service';
import { SalesforceModule } from 'src/external-services/salesforce/salesforce.module';
import { SlackModule } from 'src/external-services/slack/slack.module';
import { VonageModule } from 'src/external-services/vonage/vonage.module';
import { GamificationModule } from 'src/gamification/gamification.module';
import { HelpGroupsModule } from 'src/help-groups/help-groups.module';
import { MessagingModule } from 'src/messaging/messaging.module';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { ProfileGenerationModule } from 'src/profile-generation/profile-generation.module';
import {
  getBullWorkQueueOptions,
  getBullProfileGenerationQueueOptions,
  getBullCronTasksQueueOptions,
  getEmbeddingQueueOptions,
} from 'src/queues/queues.utils';
import { RecruitementAlertsModule } from 'src/recruitement-alerts/recruitement-alerts.module';
import { UserProfileEmbeddingsModule } from 'src/user-profile-embeddings/user-profile-embeddings.module';
import { UserProfilesModule } from 'src/user-profiles/user-profiles.module';
import { UsersModule } from 'src/users/users.module';
import { UsersDeletionModule } from 'src/users-deletion/users-deletion.module';
import { CronTasksSlackReporterService } from './cron-tasks/cron-tasks-slack-reporter.service';
import { CronTasksProcessor } from './cron-tasks/cron-tasks.processor';
import { EmbeddingQueueProcessor } from './embedding-queue.processor';
import { ProfileGeneratorProcessor } from './profile-generator.processor';
import { QueuesMetricsRecorderService } from './queues-metrics-recorder.service';
import { WorkQueueProcessor } from './work-queue.processor';

@Module({
  imports: [
    BullModule.registerQueue(getBullWorkQueueOptions()),
    BullModule.registerQueue(getBullProfileGenerationQueueOptions()),
    BullModule.registerQueue(getBullCronTasksQueueOptions()),
    BullModule.registerQueue(getEmbeddingQueueOptions()),
    MailjetModule,
    VonageModule,
    CvExtractionModule,
    SalesforceModule,
    ProfileGenerationModule,
    CompaniesModule,
    SlackModule,
    UsersModule,
    UsersDeletionModule,
    UsersModule,
    UserProfilesModule,
    UserProfileEmbeddingsModule,
    MessagingModule,
    EmbeddingsModule,
    GamificationModule,
    RecruitementAlertsModule,
    CheckinModule,
    HelpGroupsModule,
    NotificationsModule,
    CommunicationLogsModule,
  ],
  providers: [
    WorkQueueProcessor,
    ProfileGeneratorProcessor,
    PusherService,
    CronTasksSlackReporterService,
    CronTasksProcessor,
    EmbeddingQueueProcessor,
    QueuesMetricsRecorderService,
  ],
  exports: [
    WorkQueueProcessor,
    ProfileGeneratorProcessor,
    CronTasksProcessor,
    EmbeddingQueueProcessor,
  ],
})
export class ConsumersModule {}
