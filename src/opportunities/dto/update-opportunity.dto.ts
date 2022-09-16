import { ApiProperty, PartialType } from '@nestjs/swagger';
import { CreateOpportunityDto } from './create-opportunity.dto';
import { IsUUID } from 'class-validator';

export class UpdateOpportunityDto extends PartialType(CreateOpportunityDto) {
  @ApiProperty()
  @IsUUID()
  id: string;
}
