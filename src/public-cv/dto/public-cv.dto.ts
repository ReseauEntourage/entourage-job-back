import {
  generateUserProfileDto,
  UserProfileDto,
} from 'src/user-profiles/dto/user-profile.dto';
import { UserProfile } from 'src/user-profiles/models';
import { User } from 'src/users/models';
import { UserRole } from 'src/users/users.types';

export class PublicCVDto {
  id: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  userProfile: UserProfileDto;
}

export const generatePublicCVDto = (
  user: User,
  userProfile: UserProfile
): PublicCVDto => {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    userProfile: generateUserProfileDto(userProfile, true),
  };
};
