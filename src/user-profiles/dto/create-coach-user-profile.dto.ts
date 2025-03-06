import { PickType } from '@nestjs/swagger';
import { UserProfile } from '../models';

export class CreateCoachUserProfileDto extends PickType(UserProfile, [
  'UserId',
  'description',
  'department',
  'currentJob',
  'isAvailable',
  'unavailabilityReason',
  'networkBusinessLines',
  'helpOffers',
  'linkedinUrl',
] as const) {}
