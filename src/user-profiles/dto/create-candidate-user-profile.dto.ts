import { PickType } from '@nestjs/swagger';
import { UserProfile } from '../models';

export class CreateCandidateUserProfileDto extends PickType(UserProfile, [
  'userId',
  'description',
  'department',
  'isAvailable',
  'unavailabilityReason',
  'businessSectors',
  'occupations',
  'helpNeeds',
  'linkedinUrl',
] as const) {}
