import { ApiProperty, PickType } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsOptional } from 'class-validator';
import { Opportunity } from '../models';
import { Department } from 'src/common/locations/locations.types';

interface LocationDto {
  department: Department;
  address: string;
}

export class CreateOpportunityDto extends PickType(Opportunity, [
  'title',
  'isPublic',
  'isExternal',
  'link',
  'externalOrigin',
  'company',
  'recruiterName',
  'recruiterFirstName',
  'recruiterMail',
  'contactMail',
  'recruiterPosition',
  'recruiterPhone',
  'date',
  'address',
  'description',
  'companyDescription',
  'skills',
  'prerequisites',
  'department',
  'contract',
  'startOfContract',
  'endOfContract',
  'isPartTime',
  'numberOfPositions',
  'beContacted',
  'message',
  'driversLicense',
  'workingHours',
  'salary',
  'otherInfo',
  'businessLines',
] as const) {
  @ApiProperty()
  @IsOptional()
  @IsArray()
  candidatesIds?: string[];

  @ApiProperty()
  @IsOptional()
  @IsBoolean()
  isAdmin?: boolean;

  @ApiProperty()
  @IsOptional()
  @IsBoolean()
  shouldSendNotifications?: boolean;

  @ApiProperty()
  @IsOptional()
  @IsBoolean()
  isCopy?: boolean;

  @ApiProperty()
  @IsOptional()
  locations?: LocationDto | LocationDto[];
}
