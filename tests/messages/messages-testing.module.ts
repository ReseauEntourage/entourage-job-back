import { Module } from '@nestjs/common';
import { MessagesModule } from 'src/messages/messages.module';
import { MessageFactory } from './message.factory';
import { MessagesHelper } from './messages.helper';

@Module({
  imports: [MessagesModule],
  providers: [MessageFactory, MessagesHelper],
  exports: [MessageFactory, MessagesHelper],
})
export class MessagesTestingModule {}
