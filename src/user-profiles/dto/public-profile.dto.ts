import { UserProfile, UserProfileSectorOccupation } from '../models';
import { UserProfileLanguage } from '../models/user-profile-language.model';
import { UserProfileNudge } from '../models/user-profile-nudge.model';
import { Contract } from 'src/common/contracts/models';
import { Experience } from 'src/common/experiences/models';
import { Formation } from 'src/common/formations/models';
import { Interest } from 'src/common/interests/models';
import { Department } from 'src/common/locations/locations.types';
import { Nudge } from 'src/common/nudge/models';
import { Review } from 'src/common/reviews/models';
import { Skill } from 'src/common/skills/models';
import { Company } from 'src/companies/models/company.model';
import { User } from 'src/users/models';
import { UserRole } from 'src/users/users.types';
import { ZoneName } from 'src/utils/types/zones.types';

export type PublicProfileDto = {
  id: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  department: Department;
  currentJob: string;
  isAvailable: boolean;
  nudges: Nudge[];
  customNudges: UserProfileNudge[];
  introduction: string;
  description: string;
  sectorOccupations: UserProfileSectorOccupation[];
  userProfileLanguages: UserProfileLanguage[];
  experiences: Experience[];
  formations: Formation[];
  skills: Skill[];
  contracts: Contract[];
  reviews: Review[];
  interests: Interest[];
  cvUrl?: string;
  linkedinUrl?: string;
  hasExternalCv: boolean;
  averageDelayResponse?: number | null;
  hasPicture: boolean;
  company: Partial<Company> | null;
  zone: ZoneName;
  totalConversationWithMirrorRoleCount?: number | null;
};

export const generatePublicProfileDto = (
  user: User,
  userProfile: UserProfile,
  usersStats?: {
    averageDelayResponse: number | null;
    responseRate: number | null;
    totalConversationWithMirrorRoleCount: number | null;
  }
): PublicProfileDto => {
  const dto = {
    id: user.id,
    createdAt: user.createdAt,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    department: userProfile.department,
    currentJob: userProfile.currentJob,
    isAvailable: userProfile.isAvailable,
    nudges: userProfile.nudges,
    customNudges: userProfile.customNudges,
    introduction: userProfile.introduction,
    description: userProfile.description,
    sectorOccupations: userProfile.sectorOccupations,
    userProfileLanguages: userProfile.userProfileLanguages,
    experiences: userProfile.experiences,
    formations: userProfile.formations,
    skills: userProfile.skills,
    contracts: userProfile.contracts,
    reviews: userProfile.reviews,
    interests: userProfile.interests,
    linkedinUrl: userProfile.linkedinUrl,
    hasExternalCv: userProfile.hasExternalCv,
    hasPicture: userProfile.hasPicture,
    company: null,
    zone: user.zone,
  } as PublicProfileDto;
  if (user.company) {
    dto.company = {
      ...user.company.toJSON(),
      admin: user.company.admin || null,
    };
  }
  if (usersStats) {
    dto.averageDelayResponse = usersStats.averageDelayResponse;
    dto.totalConversationWithMirrorRoleCount =
      usersStats.totalConversationWithMirrorRoleCount;
  }
  return dto;
};
