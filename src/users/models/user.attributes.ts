export const UserAttributes = [
  'id',
  'OrganizationId',
  'firstName',
  'lastName',
  'email',
  'phone',
  'role',
  'zone',
  'gender',
  'lastConnection',
  'isEmailVerified',
  'createdAt',
  'refererId',
  'deletedAt',
  'whatsappZoneName',
  'whatsappZoneUrl',
  'whatsappZoneQR',
  'onboardingStatus',
  'onboardingCompletedAt',
  'onboardingWebinarSkippedAt',
  'elearningCompletedAt',
] as const;

export type UserAttribute = (typeof UserAttributes)[number];

export const OtpUserAttributes = [
  'id',
  'email',
  'lastConnection',
  'otpCode',
  'otpSalt',
  'otpExpiresAt',
] as const;

export type OtpUserAttribute = (typeof OtpUserAttributes)[number];

export const PublicUserAttributes = [
  'id',
  'firstName',
  'lastName',
  'role',
  'gender',
  'createdAt',
  'zone',
];

export type PublicUserAttribute = (typeof PublicUserAttributes)[number];

export const UserAttributesVisibleByCompanyAdmins = [
  ...PublicUserAttributes,
  'email',
];
export type UserAttributeVisibleByCompanyAdmin =
  (typeof UserAttributesVisibleByCompanyAdmins)[number];
