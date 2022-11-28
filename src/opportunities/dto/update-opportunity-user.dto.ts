import { PartialType, PickType } from '@nestjs/swagger';
import { OpportunityUser } from '../models';

export class UpdateOpportunityUserDto extends PartialType(
  PickType(OpportunityUser, [
    'status',
    'seen',
    'bookmarked',
    'archived',
    'recommended',
    'note',
  ] as const)
) {}
