import { ApiProperty, PickType } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';
import { Opportunity } from '../models';
import { OfferStatus } from 'src/opportunities/opportunities.types';

export class CreateExternalOpportunityDto extends PickType(Opportunity, [
  'title',
  'company',
  'contract',
  'startOfContract',
  'endOfContract',
  'isPartTime',
  'businessLines',
  'department',
  'link',
  'description',
  'externalOrigin',
  'date',
] as const) {
  @ApiProperty()
  @IsUUID()
  candidateId: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  status: OfferStatus;
}
