import {
  generateUserProfileDto,
  UserProfileDto,
} from 'src/user-profiles/dto/user-profile.dto';
import { UserProfile } from 'src/user-profiles/models';
import { User } from 'src/users/models';

export interface CurrentUserDto extends Partial<Omit<User, 'userProfile'>> {
  userProfile: UserProfileDto;
  averageDelayResponse: number | null;
  responseRate: number | null;
  hasExtractedCvData: boolean;
}

export const generateCurrentUserDto = (
  user: User,
  userProfile: UserProfile,
  usersStats?: {
    averageDelayResponse: number | null;
    responseRate: number | null;
  },
  hasExtractedCvData?: boolean,
  complete = false
): CurrentUserDto => {
  const dto = {
    // From User
    id: user.id,
    whatsappZoneName: user.whatsappZoneName || null,
    whatsappZoneUrl: user.whatsappZoneUrl || null,
    whatsappZoneQR: user.whatsappZoneQR || null,
    OrganizationId: user.OrganizationId || null,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
    address: user.address,
    role: user.role,
    adminRole: user.adminRole,
    zone: user.zone,
    gender: user.gender,
    lastConnection: user.lastConnection,
    isEmailVerified: user.isEmailVerified,
    refererId: user.refererId || null,
    candidat: user.candidat || null,
    referredCandidates: user.referredCandidates || [],
    referer: user.referer || null,
    readDocuments: user.readDocuments || [],
    company: user.company,

    // From UserProfile
    userProfile: generateUserProfileDto(userProfile, complete),
  } as CurrentUserDto;
  if (hasExtractedCvData !== undefined) {
    dto.hasExtractedCvData = hasExtractedCvData;
  }
  if (usersStats !== undefined) {
    dto.averageDelayResponse = usersStats.averageDelayResponse;
    dto.responseRate = usersStats.responseRate;
  }
  return dto as CurrentUserDto;
};
