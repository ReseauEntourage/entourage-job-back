import { Module } from '@nestjs/common';
import { ExternalMessagesModule } from 'src/external-messages/external-messages.module';
import { ExternalMessageFactory } from './external-message.factory';
import { ExternalMessagesHelper } from './external-messages.helper';

@Module({
  imports: [ExternalMessagesModule],
  providers: [ExternalMessageFactory, ExternalMessagesHelper],
  exports: [ExternalMessageFactory, ExternalMessagesHelper],
})
export class ExternalMessagesTestingModule {}
