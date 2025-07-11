export const UserAttributes = [
  'id',
  'OrganizationId',
  'firstName',
  'lastName',
  'email',
  'phone',
  'address',
  'role',
  'adminRole',
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
] as const;

export type UserAttribute = (typeof UserAttributes)[number];

export const PublicUserAttributes = ['id', 'firstName', 'lastName', 'role'];

export type PublicUserAttribute = (typeof PublicUserAttributes)[number];
