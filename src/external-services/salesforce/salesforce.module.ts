import { Module } from '@nestjs/common';
import { MessagesModule } from 'src/messages/messages.module';
import { UsersModule } from 'src/users/users.module';
import { SalesforceService } from './salesforce.service';

@Module({
  imports: [UsersModule, MessagesModule],
  providers: [SalesforceService],
  exports: [SalesforceService],
})
export class SalesforceModule {}
