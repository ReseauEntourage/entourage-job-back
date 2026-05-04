import { Conversation } from 'src/messaging/models';
import { User } from 'src/users/models';

export interface CurrentUserReferredUserDto {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  email: string;
  coachesContactedCount: number;
  referredAt: string | null;
  accountCreatedAt: string | null;
}

export interface CurrentUserReferredUsersDto {
  referredCandidates: CurrentUserReferredUserDto[];
}

export const generateCurrentUserReferredUsersDto = (
  user: User
): CurrentUserReferredUsersDto => ({
  referredCandidates: (user.referredCandidates || []).map((candidate) => {
    const conversations =
      (candidate.conversations as Conversation[] | undefined) ?? [];
    return {
      id: candidate.id,
      firstName: candidate.firstName,
      lastName: candidate.lastName,
      role: candidate.role,
      email: candidate.email,
      coachesContactedCount: conversations.length,
      referredAt: candidate.createdAt
        ? new Date(candidate.createdAt).toLocaleDateString('fr')
        : null,
      accountCreatedAt: candidate.onboardingCompletedAt
        ? new Date(candidate.onboardingCompletedAt).toLocaleDateString('fr')
        : null,
    };
  }),
});
