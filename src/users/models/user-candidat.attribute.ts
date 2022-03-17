export const UserCandidatAttribute = [
  'employed',
  'hidden',
  'note',
  'url',
  'contract',
  'endOfContract',
] as const;

export type UserCandidatAttribute = typeof UserCandidatAttribute[number];
