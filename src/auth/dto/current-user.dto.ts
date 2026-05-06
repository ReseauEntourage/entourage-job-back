import { Company } from 'src/companies/models/company.model';
import {
  generateUserProfileDto,
  UserProfileDto,
} from 'src/user-profiles/dto/user-profile.dto';
import { UserProfile } from 'src/user-profiles/models';
import { User } from 'src/users/models';

export interface CurrentUserDto
  extends Partial<Omit<User, 'userProfile' | 'company' | 'candidat'>> {
  userProfile: UserProfileDto;
  hasExtractedCvData: boolean;
  company?: Partial<Company>;

  // Stats
  averageDelayResponse?: number | null;
  responseRate?: number | null;
  totalConversationWithMirrorRoleCount?: number | null;
}

export const generateCurrentUserDto = (
  user: User,
  userProfile: UserProfile,
  hasExtractedCvData?: boolean,
  complete = false
): CurrentUserDto => {
  const dto = {
    // From User
    id: user.id,
    OrganizationId: user.OrganizationId || null,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
    role: user.role,
    zone: user.zone,
    gender: user.gender,
    lastConnection: user.lastConnection,
    isEmailVerified: user.isEmailVerified,
    refererId: user.refererId || null,
    referredCandidates: user.referredCandidates || [],
    referer: user.referer || null,
    readDocuments: user.readDocuments || [],
    achievements: user.achievements || [],

    // From UserProfile
    userProfile: generateUserProfileDto(userProfile, complete),

    // Default values, may be overwritten below
    company: null,

    // Onboarding completion status
    onboardingStatus: user.onboardingStatus,
    onboardingCompletedAt: user.onboardingCompletedAt,
    onboardingWebinarSkippedAt: user.onboardingWebinarSkippedAt,
  } as CurrentUserDto;

  if (user.company) {
    dto.company = {
      ...user.company.toJSON(),
      admin: user.company.admin || null,
    };
  }
  if (hasExtractedCvData !== undefined) {
    dto.hasExtractedCvData = hasExtractedCvData;
  }
  return dto as CurrentUserDto;
};
