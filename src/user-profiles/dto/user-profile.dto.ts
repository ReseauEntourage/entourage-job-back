import { UserProfile, UserProfileWithPartialAssociations } from '../models';

export type UserProfileDto = UserProfileWithPartialAssociations;

/**
 * `hasExternalCv` is not a stored column anymore: it is derived from the
 * presence of at least one still-active `ExternalCv` link on the profile.
 *
 * Requires the `externalCvs` association to have been included in the query
 * (see `getUserProfileInclude`).
 */
export const hasCurrentExternalCv = (userProfile: UserProfile): boolean =>
  (userProfile?.externalCvs?.length ?? 0) > 0;

export const generateUserProfileDto = (
  userProfile: UserProfile | null,
  complete = false
): UserProfileDto => {
  if (!userProfile) {
    return null;
  }
  const dto = {
    id: userProfile.id,
    unavailableAt: userProfile.unavailableAt,
    department: userProfile.department,
    currentJob: userProfile.currentJob,
    nudges: userProfile.nudges,
    description: userProfile.description,
    linkedinUrl: userProfile.linkedinUrl,
    hasExternalCv: hasCurrentExternalCv(userProfile),
    sectorOccupations: userProfile.sectorOccupations,
    hasPicture: userProfile.hasPicture,
    optInRecommendations: userProfile.optInRecommendations,
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
