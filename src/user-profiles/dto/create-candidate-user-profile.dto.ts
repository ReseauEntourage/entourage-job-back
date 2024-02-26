import { PickType } from '@nestjs/swagger';
import { UserProfile } from '../models';

export class CreateCandidateUserProfileDto extends PickType(UserProfile, [
  'UserId',
  'description',
  'department',
  'isAvailable',
  'searchBusinessLines',
  'searchAmbitions',
  'helpNeeds',
] as const) {}
