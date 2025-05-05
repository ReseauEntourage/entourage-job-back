import { ApiProperty, PickType } from '@nestjs/swagger';
import { UserProfile } from '../models';

export class CreateCandidateUserProfileDto extends PickType(UserProfile, [
  'userId',
  'description',
  'department',
  'isAvailable',
  'unavailabilityReason',
  'occupations',
  'linkedinUrl',
  'interests',
  'contracts',
] as const) {
  @ApiProperty()
  businessSectorIds: string[];

  @ApiProperty()
  nudgeIds: string[];
}
