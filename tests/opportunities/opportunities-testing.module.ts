import { Module } from '@nestjs/common';
import { BusinessLinesModule } from 'src/businessLines/businessLines.module';
import { OpportunitiesModule } from 'src/opportunities/opportunities.module';
import { OpportunitiesHelper } from './opportunities.helper';
import { OpportunityUsersHelper } from './opportunity-users.helper';
import { OpportunityFactory } from './opportunity.factory';

@Module({
  imports: [OpportunitiesModule, BusinessLinesModule],
  providers: [OpportunitiesHelper, OpportunityUsersHelper, OpportunityFactory],
  exports: [OpportunitiesHelper, OpportunityUsersHelper, OpportunityFactory],
})
export class OpportunitiesTestingModule {}
