/**
 * class-transformer `@Transform` trimming a string, so that lengths are
 * checked after trimming: a whitespace only text is empty.
 */
export const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
