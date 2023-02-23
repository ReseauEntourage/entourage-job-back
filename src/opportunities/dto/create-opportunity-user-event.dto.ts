import { ApiProperty, PickType } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import { OpportunityUserEvent } from '../models/opportunity-user-event.model';

export class CreateOpportunityUserEventDto extends PickType(
  OpportunityUserEvent,
  ['startDate', 'endDate', 'type', 'contract'] as const
) {
  @ApiProperty()
  @IsUUID()
  opportunityId: string;

  @ApiProperty()
  @IsUUID()
  candidateId: string;
}
