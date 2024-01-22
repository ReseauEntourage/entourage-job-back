import { User } from "src/users/models";
import { UserProfile } from "./models";
import { PublicProfile } from "./user-profiles.types";

export const getPublicProfileFromUserAndUserProfile = (user: User, userProfile: UserProfile): PublicProfile => {
 return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    zone: user.zone,
    currentJob: userProfile.currentJob,
    helpOffers: userProfile.helpOffers,
    helpNeeds: userProfile.helpNeeds,
    description: userProfile.description,
    searchBusinessLines: userProfile.searchBusinessLines,
    networkBusinessLines: userProfile.networkBusinessLines,
    searchAmbitions: userProfile.searchAmbitions,
 }
}