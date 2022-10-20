import { PartialType, ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import { CreateExternalOpportunityRestrictedDto } from './create-external-opportunity-restricted.dto';

export class UpdateExternalOpportunityRestrictedDto extends PartialType(
  CreateExternalOpportunityRestrictedDto
) {
  @ApiProperty()
  @IsUUID()
  id: string;
}
