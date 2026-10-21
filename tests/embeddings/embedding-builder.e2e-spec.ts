import moment from 'moment';
import { EmbeddingBuilder } from 'src/embeddings/embedding.builder';
import { UserProfile } from 'src/user-profiles/models';
import { UserRoles } from 'src/users/users.types';

const buildProfile = (overrides: Record<string, unknown> = {}): UserProfile =>
  ({
    currentJob: undefined,
    description: 'Passionate about cooking',
    skills: [],
    experiences: [],
    formations: [],
    userProfileLanguages: [],
    nudges: [],
    customNudges: [],
    sectorOccupations: [],
    ...overrides,
  }) as unknown as UserProfile;

describe('EmbeddingBuilder', () => {
  const builder = new EmbeddingBuilder();

  describe('profile embedding', () => {
    it('describes the current job, description and skills of the profile', () => {
      const text = builder.build(
        UserRoles.CANDIDATE,
        buildProfile({
          currentJob: 'Cook',
          skills: [{ name: 'Cooking' }, { name: 'Teamwork' }],
        }),
        'profile'
      );

      expect(text).toContain('Poste actuel : Cook');
      expect(text).toContain('description : Passionate about cooking');
      expect(text).toContain('Compétences : Cooking, Teamwork');
    });

    it('omits the sections that are empty', () => {
      const text = builder.build(
        UserRoles.CANDIDATE,
        buildProfile({ currentJob: undefined, skills: [] }),
        'profile'
      );

      expect(text).not.toContain('Poste actuel');
      expect(text).not.toContain('Compétences');
      expect(text).not.toContain('Formations');
      expect(text).not.toContain('Languages');
    });

    it('describes the experiences with company, location, duration, description and skills', () => {
      const text = builder.build(
        UserRoles.COACH,
        buildProfile({
          experiences: [
            {
              title: 'Chef de partie',
              company: 'Bistro',
              location: 'Lyon',
              startDate: moment().subtract(3, 'years').toDate(),
              endDate: moment().subtract(1, 'years').toDate(),
              description: 'Cooked a lot',
              skills: [{ name: 'Knife skills' }],
            },
          ],
        }),
        'profile'
      );

      expect(text).toContain('Experiences :');
      expect(text).toContain("Nom de l'expérience : Chef de partie");
      expect(text).toContain('Entreprise : Bistro');
      expect(text).toContain('Lieu : Lyon');
      expect(text).toContain('Durée : 2 ans');
      expect(text).toContain('Description : Cooked a lot');
      expect(text).toContain('Compétences : Knife skills');
    });

    it('expresses an ongoing experience since a number of months or years', () => {
      const text = builder.build(
        UserRoles.COACH,
        buildProfile({
          experiences: [
            {
              title: 'Recent',
              startDate: moment().subtract(3, 'months').toDate(),
            },
            {
              title: 'Long',
              startDate: moment().subtract(18, 'months').toDate(),
            },
            {
              title: 'Very long',
              startDate: moment().subtract(5, 'years').toDate(),
            },
          ],
        }),
        'profile'
      );

      expect(text).toContain('Depuis : 3 mois');
      expect(text).toContain('Depuis : 1 an\n');
      expect(text).toContain('Depuis : 5 ans');
    });

    it('does not state any duration when the dates are inconsistent', () => {
      const date = moment().subtract(1, 'years').toDate();
      const text = builder.build(
        UserRoles.COACH,
        buildProfile({
          experiences: [
            {
              title: 'Reversed',
              startDate: date,
              endDate: moment(date).subtract(1, 'months').toDate(),
            },
            { title: 'Same day', startDate: date, endDate: date },
            {
              title: 'Invalid',
              startDate: new Date('not a date'),
            },
          ],
        }),
        'profile'
      );

      expect(text).toContain("Nom de l'expérience : Reversed");
      expect(text).not.toContain('Durée');
      expect(text).not.toContain('Depuis');
    });

    it('describes the formations and the languages', () => {
      const text = builder.build(
        UserRoles.CANDIDATE,
        buildProfile({
          formations: [
            {
              title: 'CAP Cuisine',
              institution: 'Lycée Hôtelier',
              location: 'Paris',
              startDate: moment().subtract(4, 'years').toDate(),
              endDate: moment().subtract(2, 'years').toDate(),
              description: 'Two years',
              skills: [{ name: 'Pastry' }],
            },
          ],
          userProfileLanguages: [
            { language: { name: 'Français' }, level: 'Natif' },
            { language: { name: 'Anglais' }, level: 'B1' },
          ],
        }),
        'profile'
      );

      expect(text).toContain('Formations :');
      expect(text).toContain('Nom de la formation : CAP Cuisine');
      expect(text).toContain('Institution : Lycée Hôtelier');
      expect(text).toContain('Compétences : Pastry');
      expect(text).toContain('Languages :');
      expect(text).toContain('Français (niveau: Natif)');
      expect(text).toContain('Anglais (niveau: B1)');
    });

    it('separates the sections with a blank line', () => {
      const text = builder.build(
        UserRoles.CANDIDATE,
        buildProfile({ currentJob: 'Cook' }),
        'profile'
      );

      expect(text.split('\n\n').length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('needs embedding', () => {
    const nudges = [
      { nameRequest: 'Je cherche un stage', nameOffer: 'Je propose un stage' },
    ];

    it('describes the sectors and occupations wished', () => {
      const text = builder.build(
        UserRoles.CANDIDATE,
        buildProfile({
          sectorOccupations: [
            {
              businessSector: { name: 'Restauration' },
              occupation: { name: 'Cuisinier' },
            },
            { businessSector: { name: 'Transport' } },
          ],
        }),
        'needs'
      );

      expect(text).toContain("Secteurs d'activité : Restauration, Transport");
      expect(text).toContain('Métiers : Cuisinier');
    });

    it('uses the request wording of the nudges for candidates', () => {
      const text = builder.build(
        UserRoles.CANDIDATE,
        buildProfile({ nudges }),
        'needs'
      );

      expect(text).toContain('Je cherche un stage');
      expect(text).not.toContain('Je propose un stage');
    });

    it('uses the offer wording of the nudges for coaches', () => {
      const text = builder.build(
        UserRoles.COACH,
        buildProfile({ nudges }),
        'needs'
      );

      expect(text).toContain('Je propose un stage');
      expect(text).not.toContain('Je cherche un stage');
    });

    it('includes the custom nudges', () => {
      const text = builder.build(
        UserRoles.CANDIDATE,
        buildProfile({
          customNudges: [
            { content: 'Relire mon CV' },
            { content: 'Mentoring' },
          ],
        }),
        'needs'
      );

      expect(text).toContain('Coup de pouces personnalisés :');
      expect(text).toContain('Relire mon CV, Mentoring');
    });

    it('does not include the profile-only fields', () => {
      const text = builder.build(
        UserRoles.CANDIDATE,
        buildProfile({ currentJob: 'Cook' }),
        'needs'
      );

      expect(text).not.toContain('Poste actuel');
      expect(text).not.toContain('description');
    });
  });
});
