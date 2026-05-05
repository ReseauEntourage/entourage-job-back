import { User } from 'src/users/models';
import { UserAttributes } from 'src/users/models/user.attributes';

export type CurrentUserIdentityDto = Pick<
  User,
  | 'id'
  | 'firstName'
  | 'lastName'
  | 'email'
  | 'phone'
  | 'role'
  | 'zone'
  | 'gender'
  | 'lastConnection'
  | 'isEmailVerified'
  | 'OrganizationId'
  | 'refererId'
  | 'onboardingStatus'
  | 'onboardingCompletedAt'
  | 'onboardingWebinarSkippedAt'
> & {
  betaFeatures: Record<string, boolean>;
};

export const generateCurrentUserIdentityDto = (
  user: User
): CurrentUserIdentityDto => ({
  id: user.id,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  phone: user.phone,
  role: user.role,
  zone: user.zone,
  gender: user.gender,
  lastConnection: user.lastConnection,
  isEmailVerified: user.isEmailVerified,
  OrganizationId: user.OrganizationId || null,
  refererId: user.refererId || null,
  onboardingStatus: user.onboardingStatus,
  onboardingCompletedAt: user.onboardingCompletedAt,
  onboardingWebinarSkippedAt: user.onboardingWebinarSkippedAt,
  betaFeatures: Object.fromEntries(
    (user.featureFlags ?? []).map((f) => [f.featureKey, f.enabled])
  ),
});

export const CurrentUserIdentityAttributes: (typeof UserAttributes)[number][] =
  [
    'id',
    'firstName',
    'lastName',
    'email',
    'phone',
    'role',
    'zone',
    'gender',
    'lastConnection',
    'isEmailVerified',
    'OrganizationId',
    'refererId',
    'onboardingStatus',
    'onboardingCompletedAt',
    'onboardingWebinarSkippedAt',
  ];
