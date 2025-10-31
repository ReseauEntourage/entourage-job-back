import { User } from 'src/users/models';
import { searchInColumnWhereOption } from 'src/utils/misc';
import { UserProfile } from './models';
import { PublicProfile } from './user-profiles.types';

export const getPublicProfileFromUserAndUserProfile = ({
  user,
  userProfile,
  averageDelayResponse = null,
}: {
  user: User;
  userProfile: UserProfile;
  averageDelayResponse: number | null;
}): PublicProfile => {
  const dto = {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
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
    averageDelayResponse,
    hasPicture: userProfile.hasPicture,
    company: user.company
      ? {
          ...user.company.toJSON(),
          admin: user.company.admin,
        }
      : null,
  };
  return dto;
};

export function userProfileSearchQuery(query = '') {
  return [
    searchInColumnWhereOption('user.firstName', query, true),
    searchInColumnWhereOption('user.lastName', query, true),
    searchInColumnWhereOption(
      'sectorOccupations->occupation.name',
      query,
      true
    ),
    searchInColumnWhereOption('currentJob', query, true),
  ];
}
