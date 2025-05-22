import { ApiProperty, PickType } from '@nestjs/swagger';
import { IsArray, IsOptional } from 'class-validator';
import { UserProfile, UserProfileSectorOccupation } from '../models';

export class CreateCoachUserProfileDto extends PickType(UserProfile, [
  'userId',
  'description',
  'introduction',
  'department',
  'currentJob',
  'isAvailable',
  'unavailabilityReason',
  'linkedinUrl',
  'interests',
  'skills',
  'experiences',
  'formations',
  'allowPhysicalEvents',
  'allowRemoteEvents',
  'nudges',
  'userProfileLanguages',
  'customNudges',
] as const) {
  @ApiProperty()
  @IsArray()
  @IsOptional()
  sectorOccupations?: UserProfileSectorOccupation[];
}
