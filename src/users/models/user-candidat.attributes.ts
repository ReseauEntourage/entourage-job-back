export const UserCandidatAttributes = [
  'employed',
  'hidden',
  'note',
  'url',
  'contract',
  'endOfContract',
] as const;

export type UserCandidatAttribute = typeof UserCandidatAttributes[number];
