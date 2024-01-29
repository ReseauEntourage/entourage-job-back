import { PickType } from '@nestjs/swagger';
import { UserProfile } from '../models';

export class CreateCoachUserProfileDto extends PickType(UserProfile, [
  'UserId',
  'description',
  'department',
  'currentJob',
  'networkBusinessLines',
  'helpOffers',
] as const) {}
