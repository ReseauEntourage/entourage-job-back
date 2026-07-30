import { UserProfile, UserProfileSectorOccupation } from '../models';
import { UserProfileLanguage } from '../models/user-profile-language.model';
import { UserProfileNudge } from '../models/user-profile-nudge.model';
import { Review } from 'src/common/reviews/models';
import { Company } from 'src/companies/models/company.model';
import { Contract } from 'src/contracts/models';
import { Experience } from 'src/experiences/models';
import { Formation } from 'src/formations/models';
import { UserAchievement } from 'src/gamification/models';
import { Interest } from 'src/interests/models';
import { Department } from 'src/locations/locations.types';
import { Nudge } from 'src/nudge/models';
import { Skill } from 'src/skills/models';
import { User } from 'src/users/models';
import { Gender, UserRole } from 'src/users/users.types';
import { ZoneName } from 'src/utils/types/zones.types';

export type PublicProfileDto = {
  achievements: UserAchievement[];
  averageDelayResponse?: number | null;
  company: Partial<Company> | null;
  contracts: Contract[];
  createdAt: Date;
  currentJob: string;
  customNudges: UserProfileNudge[];
  cvUrl?: string;
  department: Department;
  description: string;
  elearningCompletedAt: Date | null;
  experiences: Experience[];
  firstName: string;
  formations: Formation[];
  gender: Gender;
  hasExternalCv: boolean;
  hasPicture: boolean;
  id: string;
  interests: Interest[];
  isAvailable: boolean;
  lastName: string;
  linkedinUrl?: string;
  nudges: Nudge[];
  reviews: Review[];
  role: UserRole;
  sectorOccupations: UserProfileSectorOccupation[];
  skills: Skill[];
  totalConversationWithMirrorRoleCount?: number | null;
  userProfileLanguages: UserProfileLanguage[];
  zone: ZoneName;
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
    gender: user.gender,
    elearningCompletedAt: user.elearningCompletedAt,
    department: userProfile.department,
    currentJob: userProfile.currentJob,
    isAvailable: userProfile.isAvailable,
    nudges: userProfile.nudges,
    customNudges: userProfile.customNudges,
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
    achievements: user.achievements ?? [],
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
