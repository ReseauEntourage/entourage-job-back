import { PickType } from '@nestjs/swagger';
import { UserProfile } from '../models';

export class CreateCandidateUserProfileDto extends PickType(UserProfile, [
  'UserId',
  'description',
  'searchBusinessLines',
  'searchAmbitions',
  'helpNeeds',
] as const) {}
