export const SLUG_MAX_LENGTH = 80;
export const SLUG_FALLBACK = 'groupe';

/**
 * Derives a URL slug from a group name: NFD normalization, diacritics
 * removal, lower case, any non alphanumeric run replaced by a single `-`,
 * truncated to `SLUG_MAX_LENGTH`, falling back to `SLUG_FALLBACK` when
 * nothing is left.
 */
export const slugify = (name: string): string => {
  const slug = (name ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-+$/g, '');

  return slug || SLUG_FALLBACK;
};

/**
 * Returns `baseSlug` if free, otherwise the first free `baseSlug-N` (N >= 2).
 * `takenSlugs` must include the slugs of deleted groups, so that a slug is
 * never reassigned.
 */
export const findAvailableSlug = (
  baseSlug: string,
  takenSlugs: string[]
): string => {
  const taken = new Set(takenSlugs);
  if (!taken.has(baseSlug)) {
    return baseSlug;
  }
  let suffix = 2;
  while (taken.has(`${baseSlug}-${suffix}`)) {
    suffix += 1;
  }
  return `${baseSlug}-${suffix}`;
};

export const getInitials = (
  firstName?: string | null,
  lastName?: string | null
): string => {
  return `${firstName?.trim().charAt(0) ?? ''}${
    lastName?.trim().charAt(0) ?? ''
  }`.toUpperCase();
};
