export const UserCandidatAttributes = [
  'employed',
  'hidden',
  'note',
  'url',
  'contract',
  'endOfContract',
  'lastModifiedBy',
] as const;

export type UserCandidatAttribute = typeof UserCandidatAttributes[number];
