import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { SlackModule } from 'src/external-services/slack/slack.module';
import { MailsModule } from 'src/mails/mails.module';
import { UsersModule } from 'src/users/users.module';
import { MessagingController } from './messaging.controller';
import { MessagingService } from './messaging.service';
import {
  Message,
  Conversation,
  ConversationParticipant,
  ConversationFeedback,
} from './models';

@Module({
  imports: [
    SequelizeModule.forFeature([
      Conversation,
      Message,
      ConversationParticipant,
      ConversationFeedback,
    ]),
    SlackModule,
    MailsModule,
    UsersModule,
  ],
  controllers: [MessagingController],
  providers: [MessagingService],
  exports: [SequelizeModule, MessagingService],
})
export class MessagingModule {}
