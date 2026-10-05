import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AuthModule } from 'src/auth/auth.module';
import { AnthropicModule } from 'src/external-services/anthropic/anthropic.module';
import { PusherModule } from 'src/external-services/pusher/pusher.module';
import { SlackModule } from 'src/external-services/slack/slack.module';
import { MailsModule } from 'src/mails/mails.module';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { PostsModule } from 'src/posts/posts.module';
import { QueuesModule } from 'src/queues/producers';
import { ReportsModule } from 'src/reports/reports.module';
import { UsersModule } from 'src/users/users.module';
import { HelpGroupsAdminController } from './help-groups-admin.controller';
import { HelpGroupsAdminService } from './help-groups-admin.service';
import { HelpGroupsDigestService } from './help-groups-digest.service';
import { HelpGroupsModerationAlertService } from './help-groups-moderation-alert.service';
import { HelpGroupsNotificationEmailsService } from './help-groups-notification-emails.service';
import { HelpGroupsNotificationsService } from './help-groups-notifications.service';
import { HelpGroupsParticipationController } from './help-groups-participation.controller';
import { HelpGroupsParticipationService } from './help-groups-participation.service';
import { HelpGroupsRealtimeService } from './help-groups-realtime.service';
import { HelpGroupsReportingService } from './help-groups-reporting.service';
import { HelpGroupsTitleService } from './help-groups-title.service';
import { HelpGroupsWriteGuardService } from './help-groups-write-guard.service';
import { HelpGroupsController } from './help-groups.controller';
import { HelpGroupsService } from './help-groups.service';
import { HelpGroup, HelpGroupMembership } from './models';
import { PusherAuthController } from './pusher-auth.controller';

/**
 * Help groups ("groupes d'entraide"). Named `help-groups` to avoid any
 * confusion with `Conversation.type = 'group'` of the messaging.
 */
@Module({
  imports: [
    SequelizeModule.forFeature([HelpGroup, HelpGroupMembership]),
    PostsModule,
    ReportsModule,
    NotificationsModule,
    QueuesModule,
    UsersModule,
    AnthropicModule,
    PusherModule,
    SlackModule,
    AuthModule,
    MailsModule,
  ],
  controllers: [
    HelpGroupsAdminController,
    HelpGroupsParticipationController,
    HelpGroupsController,
    PusherAuthController,
  ],
  providers: [
    HelpGroupsService,
    HelpGroupsAdminService,
    HelpGroupsWriteGuardService,
    HelpGroupsParticipationService,
    HelpGroupsTitleService,
    HelpGroupsRealtimeService,
    HelpGroupsModerationAlertService,
    HelpGroupsReportingService,
    HelpGroupsNotificationsService,
    HelpGroupsNotificationEmailsService,
    HelpGroupsDigestService,
  ],
  exports: [
    SequelizeModule,
    HelpGroupsService,
    HelpGroupsNotificationEmailsService,
    HelpGroupsDigestService,
  ],
})
export class HelpGroupsModule {}
