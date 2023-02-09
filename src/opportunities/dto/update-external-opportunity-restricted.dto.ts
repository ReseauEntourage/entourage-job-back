import { PartialType } from '@nestjs/swagger';
import { CreateExternalOpportunityRestrictedDto } from './create-external-opportunity-restricted.dto';

export class UpdateExternalOpportunityRestrictedDto extends PartialType(
  CreateExternalOpportunityRestrictedDto
) {}
