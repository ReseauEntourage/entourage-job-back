import { PickType } from '@nestjs/swagger';
import { UserProfile } from '../models';

export class CreateCandidateUserProfileDto extends PickType(UserProfile, [
  'UserId',
  'description',
  'department',
  'searchBusinessLines',
  'searchAmbitions',
  'helpNeeds',
] as const) {}
