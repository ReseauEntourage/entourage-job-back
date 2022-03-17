export const UserAttribute = [
  'id',
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
  'deletedAt',
] as const;

export type UserAttribute = typeof UserAttribute[number];

export const PublicUserAttributes = [
  'id',
  'firstName',
  'lastName',
  'role',
] as const;

export type PublicUserAttribute = typeof PublicUserAttributes[number];
