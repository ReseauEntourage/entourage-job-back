import { Module } from '@nestjs/common';
import { BusinessLinesModule } from 'src/common/business-lines/business-lines.module';
import { ContractsModule } from 'src/common/contracts/contracts.module';
import { OpportunitiesModule } from 'src/opportunities/opportunities.module';
import { OpportunitiesHelper } from './opportunities.helper';
import { OpportunityUserEventFactory } from './opportunity-user-event.factory';
import { OpportunityUsersHelper } from './opportunity-users.helper';
import { OpportunityFactory } from './opportunity.factory';

@Module({
  imports: [OpportunitiesModule, BusinessLinesModule, ContractsModule],
  providers: [
    OpportunitiesHelper,
    OpportunityUsersHelper,
    OpportunityFactory,
    OpportunityUserEventFactory,
  ],
  exports: [
    OpportunitiesHelper,
    OpportunityUsersHelper,
    OpportunityFactory,
    OpportunityUserEventFactory,
  ],
})
export class OpportunitiesTestingModule {}
