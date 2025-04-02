import { PickType } from '@nestjs/swagger';
import { UserProfile } from '../models';

export class CreateCoachUserProfileDto extends PickType(UserProfile, [
  'userId',
  'description',
  'department',
  'currentJob',
  'isAvailable',
  'unavailabilityReason',
  'businessSectors',
  'helpOffers',
  'linkedinUrl',
] as const) {}
