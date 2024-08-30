import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { SlackModule } from 'src/external-services/slack/slack.module';
import { UsersModule } from 'src/users/users.module';
import { MessagingController } from './messaging.controller';
import { MessagingService } from './messaging.service';
import { Message, Conversation, ConversationParticipant } from './models';

@Module({
  imports: [
    SequelizeModule.forFeature([
      Conversation,
      Message,
      ConversationParticipant,
    ]),
    SlackModule,
    UsersModule,
  ],
  controllers: [MessagingController],
  providers: [MessagingService],
  exports: [SequelizeModule, MessagingService],
})
export class MessagingModule {}
