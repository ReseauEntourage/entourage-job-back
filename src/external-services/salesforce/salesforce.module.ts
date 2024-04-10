import { Module } from '@nestjs/common';
import { MessagesModule } from 'src/messages/messages.module';
import { OpportunitiesModule } from 'src/opportunities/opportunities.module';
import { UsersModule } from 'src/users/users.module';
import { SalesforceService } from './salesforce.service';

@Module({
  imports: [OpportunitiesModule, UsersModule, MessagesModule],
  providers: [SalesforceService],
  exports: [SalesforceService],
})
export class SalesforceModule {}
