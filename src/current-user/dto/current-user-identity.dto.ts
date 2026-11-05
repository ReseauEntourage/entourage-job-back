import { FeatureKey } from 'src/feature-flags/models/feature-key.types';
import { User } from 'src/users/models';

type CurrentUserIdentityUserKeys =
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
  | 'elearningCompletedAt';

export type CurrentUserIdentityDto = Pick<User, CurrentUserIdentityUserKeys> & {
  betaFeatures: Record<FeatureKey, boolean>;
  hasLinkedinLinked: boolean;
  hasPassword: boolean;
};

// linkedinAccessToken, linkedinTokenExpiresAt and password are fetched but not
// exposed in the DTO — only hasLinkedinLinked and hasPassword are returned
export const CurrentUserIdentityAttributes: (
  | CurrentUserIdentityUserKeys
  | 'linkedinAccessToken'
  | 'linkedinTokenExpiresAt'
  | 'password'
)[] = [
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
  'elearningCompletedAt',
  'linkedinAccessToken',
  'linkedinTokenExpiresAt',
  'password',
];

// An expired token is no longer usable (no refresh token is issued), so the
// account is reported as not linked to let the front restart the OAuth flow
const hasValidLinkedinToken = (user: User): boolean =>
  !!user.linkedinAccessToken &&
  (!user.linkedinTokenExpiresAt ||
    new Date(user.linkedinTokenExpiresAt) > new Date());

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
  elearningCompletedAt: user.elearningCompletedAt,
  betaFeatures: Object.fromEntries(
    (user.featureFlags ?? []).map((f) => [f.featureKey, f.enabled])
  ) as Record<FeatureKey, boolean>,
  hasLinkedinLinked: hasValidLinkedinToken(user),
  hasPassword: !!user.password,
});
