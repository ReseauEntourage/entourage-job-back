import { Module } from '@nestjs/common';
import { MessagingModule } from 'src/messaging/messaging.module';
import { UsersModule } from 'src/users/users.module';
import { ConversationFactory } from './conversation.factory';
import { MessagingHelper } from './messaging.helper';

@Module({
  imports: [MessagingModule, UsersModule],
  providers: [ConversationFactory, MessagingHelper],
  exports: [ConversationFactory, MessagingHelper],
})
export class MessagingTestingModule {}
