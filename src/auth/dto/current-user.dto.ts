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
  hasExtractedCvData?: boolean
): CurrentUserDto => {
  return {
    // From User
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    readDocuments: user.readDocuments || [],
    phone: user.phone,
    email: user.email,

    // From UserProfile
    userProfile: generateUserProfileDto(userProfile),

    // From UsersStats
    averageDelayResponse: usersStats?.averageDelayResponse ?? null,
    responseRate: usersStats?.responseRate ?? null,

    // From CV Extraction
    hasExtractedCvData: hasExtractedCvData,
  };
};
