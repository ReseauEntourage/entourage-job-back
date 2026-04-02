import { forwardRef, Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { SlackModule } from 'src/external-services/slack/slack.module';
import { GamificationModule } from 'src/gamification/gamification.module';
import { MailsModule } from 'src/mails/mails.module';
import { MediasModule } from 'src/medias/medias.module';
import { QueuesModule } from 'src/queues/producers';
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
    QueuesModule,
    forwardRef(() => GamificationModule),
    forwardRef(() => MailsModule),
    forwardRef(() => UsersModule),
    forwardRef(() => MediasModule),
  ],
  controllers: [MessagingController],
  providers: [MessagingService],
  exports: [SequelizeModule, MessagingService],
})
export class MessagingModule {}
