import {
  generateUserProfileDto,
  UserProfileDto,
} from 'src/user-profiles/dto/user-profile.dto';
import { UserProfile } from 'src/user-profiles/models';

export type CurrentUserProfileDto = Pick<
  UserProfileDto,
  | 'id'
  | 'hasPicture'
  | 'hasExternalCv'
  | 'description'
  | 'introduction'
  | 'linkedinUrl'
  | 'department'
  | 'isAvailable'
  | 'currentJob'
  | 'optInRecommendations'
  | 'nudges'
  | 'sectorOccupations'
  | 'allowPhysicalEvents'
  | 'allowRemoteEvents'
>;

export type CurrentUserProfileCompleteDto = Pick<
  UserProfileDto,
  | 'id'
  | 'hasPicture'
  | 'hasExternalCv'
  | 'description'
  | 'introduction'
  | 'linkedinUrl'
  | 'department'
  | 'isAvailable'
  | 'currentJob'
  | 'optInRecommendations'
  | 'nudges'
  | 'sectorOccupations'
  | 'allowPhysicalEvents'
  | 'allowRemoteEvents'
  | 'experiences'
  | 'formations'
  | 'skills'
  | 'contracts'
  | 'reviews'
  | 'interests'
  | 'customNudges'
  | 'userProfileLanguages'
> & { hasExtractedCvData: boolean };

export const generateCurrentUserProfileDto = (
  userProfile: UserProfile
): CurrentUserProfileDto => {
  const base = generateUserProfileDto(userProfile, false);
  return {
    id: base.id,
    hasPicture: base.hasPicture,
    hasExternalCv: base.hasExternalCv,
    description: base.description,
    introduction: base.introduction,
    linkedinUrl: base.linkedinUrl,
    department: base.department,
    isAvailable: base.isAvailable,
    currentJob: base.currentJob,
    optInRecommendations: base.optInRecommendations,
    nudges: base.nudges,
    sectorOccupations: base.sectorOccupations,
    allowPhysicalEvents: base.allowPhysicalEvents,
    allowRemoteEvents: base.allowRemoteEvents,
  };
};

export const generateCurrentUserProfileCompleteDto = (
  userProfile: UserProfile,
  hasExtractedCvData: boolean
): CurrentUserProfileCompleteDto => {
  const base = generateUserProfileDto(userProfile, true);
  return {
    id: base.id,
    hasPicture: base.hasPicture,
    hasExternalCv: base.hasExternalCv,
    description: base.description,
    introduction: base.introduction,
    linkedinUrl: base.linkedinUrl,
    department: base.department,
    isAvailable: base.isAvailable,
    currentJob: base.currentJob,
    optInRecommendations: base.optInRecommendations,
    nudges: base.nudges,
    sectorOccupations: base.sectorOccupations,
    allowPhysicalEvents: base.allowPhysicalEvents,
    allowRemoteEvents: base.allowRemoteEvents,
    experiences: base.experiences,
    formations: base.formations,
    skills: base.skills,
    contracts: base.contracts,
    reviews: base.reviews,
    interests: base.interests,
    customNudges: base.customNudges,
    userProfileLanguages: base.userProfileLanguages,
    hasExtractedCvData,
  };
};
