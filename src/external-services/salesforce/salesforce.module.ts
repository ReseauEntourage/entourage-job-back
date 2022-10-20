import { Module } from '@nestjs/common';
import { OpportunitiesModule } from 'src/opportunities/opportunities.module';
import { SalesforceService } from './salesforce.service';

@Module({
  imports: [OpportunitiesModule],
  providers: [SalesforceService],
  exports: [SalesforceService],
})
export class SalesforceModule {}
