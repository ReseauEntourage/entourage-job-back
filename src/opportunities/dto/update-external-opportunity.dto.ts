import { PartialType, ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import { CreateExternalOpportunityDto } from './create-external-opportunity.dto';

export class UpdateExternalOpportunityDto extends PartialType(
  CreateExternalOpportunityDto
) {
  @ApiProperty()
  @IsUUID()
  id: string;
}
