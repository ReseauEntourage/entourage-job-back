import { ApiProperty, PickType } from '@nestjs/swagger';
import { IsOptional, IsArray } from 'class-validator';
import { UserProfile, UserProfileSectorOccupation } from '../models';

export class CreateCandidateUserProfileDto extends PickType(UserProfile, [
  'userId',
  'introduction',
  'description',
  'department',
  'isAvailable',
  'unavailabilityReason',
  'occupations',
  'linkedinUrl',
  'interests',
  'skills',
  'experiences',
  'formations',
  'contracts',
  'allowPhysicalEvents',
  'allowRemoteEvents',
  'nudges',
  'customNudges',
] as const) {
  @ApiProperty()
  @ApiProperty()
  @IsArray()
  @IsOptional()
  sectorOccupations?: UserProfileSectorOccupation[];
}
