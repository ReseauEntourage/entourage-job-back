import { ApiProperty, PickType } from '@nestjs/swagger';
import { UserProfile } from '../models';

export class CreateCoachUserProfileDto extends PickType(UserProfile, [
  'userId',
  'description',
  'department',
  'currentJob',
  'isAvailable',
  'unavailabilityReason',
  'linkedinUrl',
] as const) {
  @ApiProperty()
  businessSectorIds: string[];

  @ApiProperty()
  nudgeIds: string[];
}
