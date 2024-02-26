import { Module } from '@nestjs/common';
import { MessagesModule } from 'src/messages/messages.module';
import { UsersModule } from 'src/users/users.module';
import { ExternalMessageFactory } from './external-message.factory';
import { InternalMessageFactory } from './internal-message.factory';
import { MessagesHelper } from './messages.helper';

@Module({
  imports: [MessagesModule, UsersModule],
  providers: [ExternalMessageFactory, InternalMessageFactory, MessagesHelper],
  exports: [ExternalMessageFactory, InternalMessageFactory, MessagesHelper],
})
export class MessagesTestingModule {}
