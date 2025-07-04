import { PickType } from '@nestjs/swagger';
import { UserProfile } from '../models';

export class CreateCandidateUserProfileDto extends PickType(UserProfile, [
  'userId',
  'introduction',
  'description',
  'department',
  'isAvailable',
  'unavailabilityReason',
  'occupations',
  'linkedinUrl',
  'interests',
  'skills',
  'experiences',
  'formations',
  'contracts',
  'userProfileLanguages',
  'allowPhysicalEvents',
  'allowRemoteEvents',
  'nudges',
  'customNudges',
  'sectorOccupations',
  'optInNewsletter',
  'optInRecommendations',
] as const) {}
