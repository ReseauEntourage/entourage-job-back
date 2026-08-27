import { forwardRef, Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AuthModule } from 'src/auth/auth.module';
import { SlackModule } from 'src/external-services/slack/slack.module';
import { GamificationModule } from 'src/gamification/gamification.module';
import { MailsModule } from 'src/mails/mails.module';
import { MediasModule } from 'src/medias/medias.module';
import { QueuesModule } from 'src/queues/producers';
import { UsersModule } from 'src/users/users.module';
import { ConversationPipelineService } from './conversation-pipeline.service';
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
    forwardRef(() => AuthModule),
  ],
  controllers: [MessagingController],
  providers: [MessagingService, ConversationPipelineService],
  exports: [SequelizeModule, MessagingService, ConversationPipelineService],
})
export class MessagingModule {}
