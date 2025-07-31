import { UserProfile, UserProfileWithPartialAssociations } from '../models';

export interface UserProfileDto extends UserProfileWithPartialAssociations {}

export const generateUserProfileDto = (
  userProfile: UserProfile,
  complete = false
): UserProfileDto => {
  const dto = {
    isAvailable: userProfile.isAvailable,
    department: userProfile.department,
    currentJob: userProfile.currentJob,
    nudges: userProfile.nudges,
    description: userProfile.description,
    introduction: userProfile.introduction,
    linkedinUrl: userProfile.linkedinUrl,
    hasExternalCv: userProfile.hasExternalCv,
    sectorOccupations: userProfile.sectorOccupations,
    hasPicture: userProfile.hasPicture,
  } as UserProfileDto;
  if (complete) {
    dto.allowPhysicalEvents = userProfile.allowPhysicalEvents;
    dto.allowRemoteEvents = userProfile.allowRemoteEvents;
    dto.experiences = userProfile.experiences;
    dto.formations = userProfile.formations;
    dto.skills = userProfile.skills;
    dto.contracts = userProfile.contracts;
    dto.reviews = userProfile.reviews;
    dto.interests = userProfile.interests;
    dto.customNudges = userProfile.customNudges;
    dto.userProfileLanguages = userProfile.userProfileLanguages;
  }
  return dto;
};
