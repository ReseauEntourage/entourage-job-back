import { forwardRef, Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { HelpGroup } from 'src/help-groups/models';
import { MessagingModule } from 'src/messaging/messaging.module';
import { Conversation } from 'src/messaging/models';
import { Post, PostContext, PostReply } from 'src/posts/models';
import { ReportsModule } from 'src/reports/reports.module';
import { User } from 'src/users/models';
import { ReportsAdminController } from './reports-admin.controller';
import { ReportsAdminService } from './reports-admin.service';

/**
 * "Signalements" admin tab. Kept apart from `ReportsModule`, imported by the
 * reported domains, which this module reads in turn.
 */
@Module({
  imports: [
    SequelizeModule.forFeature([
      Conversation,
      User,
      Post,
      PostReply,
      PostContext,
      HelpGroup,
    ]),
    ReportsModule,
    forwardRef(() => MessagingModule),
  ],
  controllers: [ReportsAdminController],
  providers: [ReportsAdminService],
})
export class ReportsAdminModule {}
