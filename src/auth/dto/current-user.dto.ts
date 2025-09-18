import { Company } from 'src/companies/models/company.model';
import {
  generateUserProfileDto,
  UserProfileDto,
} from 'src/user-profiles/dto/user-profile.dto';
import { UserProfile } from 'src/user-profiles/models';
import { User } from 'src/users/models';

export interface CurrentUserDto
  extends Partial<
    Omit<User, 'userProfile' | 'company' | 'candidat' | 'createdAt'>
  > {
  createdAt: string;
  userProfile: UserProfileDto;
  averageDelayResponse: number | null;
  responseRate: number | null;
  hasExtractedCvData: boolean;
  company?: Partial<Company>;
  candidat?: Partial<User['candidat']>;
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
    createdAt:
      user.createdAt instanceof Date
        ? user.createdAt.toISOString()
        : user.createdAt,
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
    referredCandidates: user.referredCandidates || [],
    referer: user.referer || null,
    readDocuments: user.readDocuments || [],

    // From UserProfile
    userProfile: generateUserProfileDto(userProfile, complete),

    // Default values, may be overwritten below
    company: null,
    candidat: null,
  } as CurrentUserDto;

  if (user.candidat) {
    dto.candidat = {
      employed: user.candidat?.employed || null,
      hidden: user.candidat?.hidden || null,
      note: user.candidat?.note || null,
      url: user.candidat?.url || null,
      contract: user.candidat?.contract || null,
      endOfContract: user.candidat?.endOfContract || null,
      lastModifiedBy: user.candidat?.lastModifiedBy || null,
    };
  }

  if (user.company) {
    dto.company = {
      ...user.company.toJSON(),
      admin: user.company.admin || null,
    };
  }
  if (hasExtractedCvData !== undefined) {
    dto.hasExtractedCvData = hasExtractedCvData;
  }
  if (usersStats !== undefined) {
    dto.averageDelayResponse = usersStats.averageDelayResponse;
    dto.responseRate = usersStats.responseRate;
  }
  return dto as CurrentUserDto;
};
