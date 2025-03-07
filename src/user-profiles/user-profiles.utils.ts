import { User } from 'src/users/models';
import { searchInColumnWhereOption } from 'src/utils/misc';
import { UserProfile } from './models';
import { PublicProfile } from './user-profiles.types';

export const getPublicProfileFromUserAndUserProfile = (
  user: User,
  userProfile: UserProfile,
  lastSentMessage: Date,
  lastReceivedMessage: Date,
  cvUrl?: string
): PublicProfile => {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    isAvailable: userProfile.isAvailable,
    department: userProfile.department,
    currentJob: userProfile.currentJob,
    helpOffers: userProfile.helpOffers,
    helpNeeds: userProfile.helpNeeds,
    description: userProfile.description,
    searchBusinessLines: userProfile.searchBusinessLines,
    networkBusinessLines: userProfile.networkBusinessLines,
    searchAmbitions: userProfile.searchAmbitions,
    lastSentMessage: lastSentMessage ? lastSentMessage : null,
    lastReceivedMessage: lastReceivedMessage ? lastReceivedMessage : null,
    cvUrl: cvUrl,
    linkedinUrl: userProfile.linkedinUrl,
    hasExternalCv: userProfile.hasExternalCv,
  };
};

export function userProfileSearchQuery(query = '') {
  return [
    searchInColumnWhereOption('user.firstName', query, true),
    searchInColumnWhereOption('user.lastName', query, true),
    // searchInColumnWhereOption('searchAmbitions.name', query, true),
  ];
}
