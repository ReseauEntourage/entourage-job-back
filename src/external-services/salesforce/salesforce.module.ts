import { Module } from '@nestjs/common';
import { ExternalMessagesModule } from 'src/external-messages/external-messages.module';
import { OpportunitiesModule } from 'src/opportunities/opportunities.module';
import { SalesforceService } from './salesforce.service';

@Module({
  imports: [OpportunitiesModule, ExternalMessagesModule],
  providers: [SalesforceService],
  exports: [SalesforceService],
})
export class SalesforceModule {}
