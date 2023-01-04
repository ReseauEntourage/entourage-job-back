import { PartialType, ApiProperty, OmitType } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import { CreateExternalOpportunityDto } from './create-external-opportunity.dto';

export class UpdateExternalOpportunityDto extends OmitType(
  PartialType(CreateExternalOpportunityDto),
  ['status', 'candidateId'] as const
) {}
