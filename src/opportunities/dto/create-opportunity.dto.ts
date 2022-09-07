import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsOptional } from 'class-validator';
import { Opportunity } from '../models';
import { Department } from 'src/locations/locations.types';

interface LocationDto {
  department: Department;
  address: string;
}

export class CreateOpportunityDto extends Opportunity {
  // TODO change to candidateIds
  @ApiProperty()
  @IsOptional()
  @IsArray()
  candidatesId: string[];

  @ApiProperty()
  @IsBoolean()
  isAdmin: boolean;

  @ApiProperty()
  @IsBoolean()
  shouldSendNotifications: boolean;

  @ApiProperty()
  @IsBoolean()
  isCopy: boolean;

  @ApiProperty()
  @IsOptional()
  locations: LocationDto | LocationDto[];
}
