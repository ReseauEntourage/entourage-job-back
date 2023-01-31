import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateExternalOpportunityDto } from './create-external-opportunity.dto';

export class UpdateExternalOpportunityDto extends OmitType(
  PartialType(CreateExternalOpportunityDto),
  ['status', 'candidateId'] as const
) {}
