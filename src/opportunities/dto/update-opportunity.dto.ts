import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { CreateOpportunityDto } from './create-opportunity.dto';

export class UpdateOpportunityDto extends PartialType(CreateOpportunityDto) {
  @ApiProperty()
  @IsOptional()
  @IsUUID()
  id: string;
}
