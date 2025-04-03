import { ApiProperty, PickType } from '@nestjs/swagger';
import { UserProfile } from '../models';

export class CreateCandidateUserProfileDto extends PickType(UserProfile, [
  'userId',
  'description',
  'department',
  'isAvailable',
  'unavailabilityReason',
  'occupations',
  'helpNeeds',
  'linkedinUrl',
] as const) {
  @ApiProperty()
  businessSectorIds: string[];
}
