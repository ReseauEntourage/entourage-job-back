// Increment schema version on changes to make sure we dont reuse old saved schemas
export const SCHEMA_VERSION = 5;

// Définition du schéma JSON pour la sortie structurée
export const cvSchema = {
  type: 'object',
  properties: {
    description: {
      type: 'string',
      maxLength: 500,
      description:
        'Résumé du CV à la première personne, mettant en avant les compétences clés, l expérience et la formation de la personne',
    },
    skills: {
      description: 'Liste des compétences',
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', maxLength: 80 },
          order: { type: 'number' },
        },
        required: ['name'],
      },
      maxItems: 50,
    },
    experiences: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string', maxLength: 80 },
          company: { type: 'string', maxLength: 60 },
          description: { type: 'string', maxLength: 300 },
          location: { type: 'string', maxLength: 60 },
          startDate: {
            type: 'string',
            pattern: '^([0-9]{4})-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$',
            description:
              "Date de début de l'expérience au format ISO YYYY-MM-DD",
          },
          endDate: {
            type: 'string',
            pattern: '^([0-9]{4})-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$',
            description:
              "Date de fin de l'expérience au format ISO YYYY-MM-DD (ne pas remplir si l'expérience est en cours)",
          },
          order: { type: 'number' },
          skills: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string', maxLength: 80 },
                order: { type: 'number' },
              },
              required: ['name'],
            },
            maxItems: 50,
          },
        },
        required: ['title'],
      },
    },
    formations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string', maxLength: 80 },
          description: { type: 'string', maxLength: 300 },
          institution: { type: 'string', maxLength: 60 },
          location: { type: 'string', maxLength: 60 },
          startDate: {
            type: 'string',
            pattern: '^([0-9]{4})-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$',
            description:
              'Date de début de la formation au format ISO YYYY-MM-DD',
          },
          endDate: {
            type: 'string',
            pattern: '^([0-9]{4})-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$',
            description:
              'Date de fin de la formation au format ISO YYYY-MM-DD (ne pas remplir si la formation est en cours)',
          },
          skills: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string', maxLength: 80 },
                order: { type: 'number' },
              },
              required: ['name'],
            },
            maxItems: 50,
          },
        },
        required: ['title'],
      },
    },
    languages: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Nom de la langue en français (ex: Anglais, Espagnol)',
            maxLength: 50,
          },
          value: {
            type: 'string',
            description: 'Code de la langue au format ISO 639-1 (ex: en, es)',
            pattern: '^[a-z]{2}$',
          },
          level: {
            type: 'string',
            enum: ['NOTIONS', 'INTERMEDIATE', 'FLUENT', 'NATIVE'],
            description: 'Niveau de maîtrise de la langue',
          },
        },
        required: ['name', 'value'],
      },
      maxItems: 10,
      description: 'Liste des langues parlées avec leur niveau de maîtrise',
    },
    interests: {
      description: "Liste des centres d'intérêt",
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', maxLength: 50 },
        },
        required: ['name'],
      },
      maxItems: 10,
    },
  },
};

// Définition du type pour les données extraites du CV
export interface CvSchemaType {
  // UserProfile fields
  description?: string;

  // Experiences
  experiences?: Array<{
    company?: string;
    description?: string;
    endDate?: string;
    location?: string;
    order?: number;
    skills?: Array<{ name: string; order?: number }>;
    startDate?: string;
    title: string;
  }>;

  // Formations
  formations?: Array<{
    description?: string;
    endDate?: string;
    institution?: string;
    location?: string;
    skills?: Array<{ name: string; order?: number }>;
    startDate?: string;
    title: string;
  }>;

  interests?: Array<{ name: string }>;

  // Languages
  languages?: Array<{
    // Code ISO 639-1 de la langue
    level?: string;
    name: string;
    // Nom de la langue en français
    value: string;
  }>;

  //Nudges
  nudges?: Array<{ name: string; order?: number }>;

  schemaVersion: number;

  //Skills
  skills?: Array<{ name: string; order?: number }>;

  // contracts?: Array<{ name: string }>;
}
