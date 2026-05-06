import { User } from 'src/users/models';

export interface CurrentUserReferredUserDto {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  email: string;
  coachesContactedCount: number;
  referredAt: string | null;
  onboardingCompletedAt: string | null;
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
    email: candidate.email,
    coachesContactedCount: candidate.getDataValue(
      'coachesContactedCount'
    ) as number,
    referredAt: candidate.createdAt
      ? new Date(candidate.createdAt).toISOString()
      : null,
    onboardingCompletedAt: candidate.onboardingCompletedAt
      ? new Date(candidate.onboardingCompletedAt).toISOString()
      : null,
  })),
});
