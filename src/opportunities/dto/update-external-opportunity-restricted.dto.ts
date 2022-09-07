import { PartialType } from '@nestjs/mapped-types';
import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import { CreateExternalOpportunityRestrictedDto } from './create-external-opportunity-restricted.dto';

export class UpdateExternalOpportunityRestrictedDto extends PartialType(
  CreateExternalOpportunityRestrictedDto
) {
  @ApiProperty()
  @IsUUID()
  id: string;

  @ApiProperty()
  @IsUUID()
  candidateId: string;
}
