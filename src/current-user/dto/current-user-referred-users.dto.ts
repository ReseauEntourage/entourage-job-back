import { User } from 'src/users/models';

export interface CurrentUserReferredUserDto {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
}

export interface CurrentUserReferredUsersDto {
  referredCandidates: CurrentUserReferredUserDto[];
}

export const generateCurrentUserReferredUsersDto = (
  user: User
): CurrentUserReferredUsersDto => ({
  referredCandidates: (user.referredCandidates || []).map((candidate) => ({
    id: candidate.id,
    firstName: candidate.firstName,
    lastName: candidate.lastName,
    role: candidate.role,
  })),
});
