import { UserProfile, UserProfileWithPartialAssociations } from '../models';

export interface UserProfileDto extends UserProfileWithPartialAssociations {}

export const generateUserProfileDto = (
  userProfile: UserProfile
): UserProfileDto => {
  return {
    isAvailable: userProfile.isAvailable,
    department: userProfile.department,
    currentJob: userProfile.currentJob,
    nudges: userProfile.nudges,
    customNudges: userProfile.customNudges,
    description: userProfile.description,
    introduction: userProfile.introduction,
    linkedinUrl: userProfile.linkedinUrl,
    hasExternalCv: userProfile.hasExternalCv,
    sectorOccupations: userProfile.sectorOccupations,
    userProfileLanguages: userProfile.userProfileLanguages,
    experiences: userProfile.experiences,
    formations: userProfile.formations,
    skills: userProfile.skills,
    contracts: userProfile.contracts,
    reviews: userProfile.reviews,
    interests: userProfile.interests,
    hasPicture: userProfile.hasPicture,
  } as UserProfileDto;
};
