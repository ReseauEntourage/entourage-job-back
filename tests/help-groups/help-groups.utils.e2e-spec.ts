import {
  findAvailableSlug,
  getInitials,
  SLUG_FALLBACK,
  SLUG_MAX_LENGTH,
  slugify,
} from 'src/help-groups/help-groups.utils';

describe('Help groups utils', () => {
  describe('slugify', () => {
    it('Should lower case and join words with dashes', () => {
      expect(slugify('Refaire un CV')).toBe('refaire-un-cv');
    });
    it('Should remove accents', () => {
      expect(slugify('Préparer ses entretiens à Lyon')).toBe(
        'preparer-ses-entretiens-a-lyon'
      );
    });
    it('Should replace punctuation and merge dashes', () => {
      expect(slugify("  L'emploi : quoi, où ?! -- Ensemble  ")).toBe(
        'l-emploi-quoi-ou-ensemble'
      );
    });
    it('Should fall back when nothing is left', () => {
      expect(slugify('?!… 🎉')).toBe(SLUG_FALLBACK);
      expect(slugify('')).toBe(SLUG_FALLBACK);
    });
    it('Should truncate without trailing dash', () => {
      const slug = slugify(`${'a'.repeat(SLUG_MAX_LENGTH - 1)} bcd`);
      expect(slug).toBe('a'.repeat(SLUG_MAX_LENGTH - 1));
      expect(slugify('b'.repeat(200))).toHaveLength(SLUG_MAX_LENGTH);
    });
  });

  describe('findAvailableSlug', () => {
    it('Should keep the base slug when it is free', () => {
      expect(findAvailableSlug('refaire-un-cv', [])).toBe('refaire-un-cv');
    });
    it('Should add a suffix when the slug is taken, including by a deleted group', () => {
      // Taken slugs come from a `paranoid: false` query (deleted groups included)
      expect(findAvailableSlug('refaire-un-cv', ['refaire-un-cv'])).toBe(
        'refaire-un-cv-2'
      );
      expect(
        findAvailableSlug('refaire-un-cv', [
          'refaire-un-cv',
          'refaire-un-cv-2',
          'refaire-un-cv-3',
        ])
      ).toBe('refaire-un-cv-4');
    });
  });

  describe('getInitials', () => {
    it('Should build upper case initials', () => {
      expect(getInitials('amina', 'Lefèvre')).toBe('AL');
      expect(getInitials('Julien', null)).toBe('J');
    });
  });
});
