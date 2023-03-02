import { PickType } from '@nestjs/swagger';
import { OpportunityUserEvent } from 'src/opportunities/models/opportunity-user-event.model';

export class UpdateOpportunityUserEventDto extends PickType(
  OpportunityUserEvent,
  ['startDate', 'endDate', 'type', 'contract'] as const
) {}
