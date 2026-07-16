import { User } from 'src/users/models';

export interface CurrentUserReferredUserDto {
  coachesContactedCount: number;
  email: string;
  eventsParticipatedCount: number;
  firstName: string;
  id: string;
  lastName: string;
  onboardingCompletedAt: string | null;
  referredAt: string | null;
  role: string;
}

export interface CurrentUserReferredUsersDto {
  referredCandidates: CurrentUserReferredUserDto[];
}

export const generateCurrentUserReferredUsersDto = (
  user: User,
  eventsParticipatedCountByEmail: Record<string, number> = {}
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
    eventsParticipatedCount:
      eventsParticipatedCountByEmail[candidate.email?.toLowerCase()] ?? 0,
    referredAt: candidate.createdAt
      ? new Date(candidate.createdAt).toISOString()
      : null,
    onboardingCompletedAt: candidate.onboardingCompletedAt
      ? new Date(candidate.onboardingCompletedAt).toISOString()
      : null,
  })),
});
