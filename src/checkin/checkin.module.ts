import { forwardRef, Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AuthModule } from 'src/auth/auth.module';
import { SlackModule } from 'src/external-services/slack/slack.module';
import { MailsModule } from 'src/mails/mails.module';
import { MessagingModule } from 'src/messaging/messaging.module';
import { Conversation } from 'src/messaging/models/conversation.model';
import { UsersModule } from 'src/users/users.module';
import { CheckinController } from './checkin.controller';
import { CheckinService } from './checkin.service';
import { ConversationCheckin } from './models';

@Module({
  imports: [
    SequelizeModule.forFeature([ConversationCheckin, Conversation]),
    SlackModule,
    forwardRef(() => MessagingModule),
    forwardRef(() => UsersModule),
    forwardRef(() => AuthModule),
    forwardRef(() => MailsModule),
  ],
  controllers: [CheckinController],
  providers: [CheckinService],
  exports: [CheckinService, SequelizeModule],
})
export class CheckinModule {}
