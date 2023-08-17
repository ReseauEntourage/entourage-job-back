import { IntersectionType, PartialType, PickType } from '@nestjs/swagger';
import { Opportunity } from '../models';
import { CreateOpportunityDto } from './create-opportunity.dto';

export class UpdateOpportunityDto extends PartialType(
  IntersectionType(
    CreateOpportunityDto,
    PickType(Opportunity, ['isValidated', 'isArchived'] as const)
  )
) {}
