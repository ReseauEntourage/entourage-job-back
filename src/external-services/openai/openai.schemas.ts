import { Departments } from 'src/common/locations/locations.types';

// Increment schema version on changes to make sure we dont reuse old saved schemas
export const SCHEMA_VERSION = 2;

// Définition du schéma JSON pour la sortie structurée
export const cvSchema = {
  type: 'object',
  properties: {
    // introduction: { type: 'string', maxLength: 1000 },
    description: { type: 'string', maxLength: 1000 },
    department: {
      type: 'string',
      enum: Departments.map((dept) => dept.name),
    },
    linkedinUrl: { type: 'string' },
    transport: { type: 'string' },
    skills: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          order: { type: 'number' },
        },
        required: ['name'],
      },
      maxItems: 50,
    },
    nudges: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          order: { type: 'number' },
        },
        required: ['name'],
      },
    },
    experiences: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string', maxLength: 60 },
          company: { type: 'string', maxLength: 60 },
          description: { type: 'string', maxLength: 300 },
          location: { type: 'string', maxLength: 60 },
          startDate: {
            type: 'string',
            pattern: '^([0-9]{4})-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$',
            description: 'Date au format ISO YYYY-MM-DD',
          },
          endDate: {
            type: 'string',
            pattern: '^([0-9]{4})-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$',
            description: 'Date au format ISO YYYY-MM-DD',
          },
          order: { type: 'number' },
          skills: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                order: { type: 'number' },
              },
              required: ['name'],
            },
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
          title: { type: 'string' },
          description: { type: 'string' },
          institution: { type: 'string' },
          location: { type: 'string' },
          startDate: {
            type: 'string',
            pattern: '^([0-9]{4})-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$',
            description: 'Date au format ISO YYYY-MM-DD',
          },
          endDate: {
            type: 'string',
            pattern: '^([0-9]{4})-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$',
            description: 'Date au format ISO YYYY-MM-DD',
          },
          skills: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                order: { type: 'number' },
              },
              required: ['name'],
            },
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
    },
    interests: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
        required: ['name'],
      },
    },
  },
};

// Définition du type pour les données extraites du CV
export interface CvSchemaType {
  schemaVersion: number;

  // UserProfile fields
  // introduction?: string;
  description?: string;
  department?: string;
  linkedinUrl?: string;

  //Skills
  skills?: Array<{ name: string; order?: number }>;

  //Nudges
  nudges?: Array<{ name: string; order?: number }>;

  // Experiences
  experiences?: Array<{
    title: string;
    description?: string;
    company?: string;
    location?: string;
    startDate?: string;
    endDate?: string;
    order?: number;
    skills?: Array<{ name: string; order?: number }>;
  }>;

  // Formations
  formations?: Array<{
    title: string;
    description?: string;
    institution?: string;
    location?: string;
    startDate?: string;
    endDate?: string;
    skills?: Array<{ name: string; order?: number }>;
  }>;

  // Languages
  languages?: Array<{
    name: string; // Nom de la langue en français
    value: string; // Code ISO 639-1 de la langue
    level?: string;
  }>;

  // Todo: Adapt when implemented
  transport?: string;

  interests?: Array<{ name: string }>;

  // contracts?: Array<{ name: string }>;
}
