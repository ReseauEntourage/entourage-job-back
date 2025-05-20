import { Languages } from 'src/common/languages/language.types';
import { Departments } from 'src/common/locations/locations.types';

// Définition du schéma JSON pour la sortie structurée
export const cvSchema = {
  type: 'object',
  properties: {
    introduction: { type: 'string', maxLength: 1000 },
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
            pattern: '^(0[1-9]|[12][0-9]|3[01])/(0[1-9]|1[0-2])/([0-9]{4})$',
            description: 'Date au format dd/mm/YYYY',
          },
          endDate: {
            type: 'string',
            pattern: '^(0[1-9]|[12][0-9]|3[01])/(0[1-9]|1[0-2])/([0-9]{4})$',
            description: 'Date au format dd/mm/YYYY',
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
        required: ['title', 'company', 'description', 'location'],
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
            pattern: '^(0[1-9]|[12][0-9]|3[01])/(0[1-9]|1[0-2])/([0-9]{4})$',
            description: 'Date au format dd/mm/YYYY',
          },
          endDate: {
            type: 'string',
            pattern: '^(0[1-9]|[12][0-9]|3[01])/(0[1-9]|1[0-2])/([0-9]{4})$',
            description: 'Date au format dd/mm/YYYY',
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
        required: ['description'],
      },
    },
    languages: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', enum: Languages.map((lang) => lang.name) },
          level: { type: 'string' },
        },
        required: ['name'],
      },
    },
    passions: {
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
  // UserProfile fields
  introduction?: string;
  description?: string;
  department?: string;
  linkedinUrl?: string;

  //Skills
  skills?: Array<{ name: string; order?: number }>;

  //Nudges
  nudges?: Array<{ name: string; order?: number }>;

  // Experiences
  experiences?: Array<{
    title?: string;
    description: string;
    company?: string;
    location?: string;
    startDate?: string;
    endDate?: string;
    order?: number;
    skills?: Array<{ name: string; order?: number }>;
  }>;

  // Formations
  formations?: Array<{
    title?: string;
    description: string;
    institution?: string;
    location?: string;
    startDate?: string;
    endDate?: string;
    skills?: Array<{ name: string; order?: number }>;
  }>;

  // Languages
  languages?: Array<{ name: string; level?: string }>;

  transport?: string;
  passions?: Array<{ name: string }>;

  // ambitions?: Array<{ name: string; order?: number; prefix?: string }>;
  // businessLines?: Array<{ name: string; order?: number }>;
  // contracts?: Array<{ name: string }>;
}
