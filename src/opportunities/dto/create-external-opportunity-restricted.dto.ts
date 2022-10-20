import { OmitType } from '@nestjs/swagger';
import { CreateExternalOpportunityDto } from './create-external-opportunity.dto';

export class CreateExternalOpportunityRestrictedDto extends OmitType(
  CreateExternalOpportunityDto,
  ['businessLines'] as const
) {}
