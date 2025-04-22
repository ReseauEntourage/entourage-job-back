import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AWSModule } from 'src/external-services/aws/aws.module';
import { SlackModule } from 'src/external-services/slack/slack.module';
import { MailsModule } from 'src/mails/mails.module';
import { MediasModule } from 'src/medias/medias.module';
import { UsersModule } from 'src/users/users.module';
import { MessagingController } from './messaging.controller';
import { MessagingService } from './messaging.service';
import {
  Message,
  Conversation,
  ConversationParticipant,
  MessageMedia,
} from './models';

@Module({
  imports: [
    SequelizeModule.forFeature([
      Conversation,
      Message,
      ConversationParticipant,
      MessageMedia,
    ]),
    SlackModule,
    MailsModule,
    UsersModule,
    MediasModule,
    AWSModule,
  ],
  controllers: [MessagingController],
  providers: [MessagingService],
  exports: [SequelizeModule, MessagingService],
})
export class MessagingModule {}
