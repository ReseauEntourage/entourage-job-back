import { ApiProperty, PickType } from '@nestjs/swagger';
import { UserProfile } from '../models';

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
  'contracts',
  'allowPhysicalEvents',
  'allowRemoteEvents',
] as const) {
  @ApiProperty()
  businessSectorIds: string[];

  @ApiProperty()
  nudgeIds: string[];
}
