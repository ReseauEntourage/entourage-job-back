// Définition du schéma JSON pour la sortie structurée
export const cvSchema = {
  type: 'object',
  properties: {
    intro: { type: 'string' },
    catchphrase: { type: 'string' },
    story: { type: 'string' },
    availability: { type: 'string' },
    transport: { type: 'string' },
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
    skills: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
        required: ['name'],
      },
    },
    languages: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
        required: ['name'],
      },
    },
    hobbies: {
      type: 'array',
      items: { type: 'string' },
    },
    ambitions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          order: { type: 'number' },
          prefix: { type: 'string' },
        },
        required: ['name'],
      },
    },
    businessLines: {
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
    contracts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
        required: ['name'],
      },
    },
    experiences: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          description: { type: 'string' },
          order: { type: 'number' },
          location: { type: 'string' },
          company: { type: 'string' },
          title: { type: 'string' },
          dateStart: { type: 'string' },
          dateEnd: { type: 'string' },
          skills: {
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
        required: ['description'],
      },
    },
    formations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          description: { type: 'string' },
          location: { type: 'string' },
          institution: { type: 'string' },
          title: { type: 'string' },
          dateStart: { type: 'string' },
          dateEnd: { type: 'string' },
          skills: {
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
        required: ['description'],
      },
    },
  },
};

// Définition du type pour les données extraites du CV
export interface CvSchemaType {
  intro?: string;
  catchphrase?: string;
  story?: string;
  availability?: string;
  transport?: string;
  passions?: Array<{ name: string }>;
  skills?: Array<{ name: string }>;
  languages?: Array<{ name: string }>;
  hobbies?: string[];
  ambitions?: Array<{ name: string; order?: number; prefix?: string }>;
  businessLines?: Array<{ name: string; order?: number }>;
  contracts?: Array<{ name: string }>;
  experiences?: Array<{
    description: string;
    order?: number;
    location?: string;
    company?: string;
    title?: string;
    dateStart?: string;
    dateEnd?: string;
    skills?: Array<{ name: string }>;
  }>;
  formations?: Array<{
    description: string;
    location?: string;
    institution?: string;
    title?: string;
    dateStart?: string;
    dateEnd?: string;
    skills?: Array<{ name: string }>;
  }>;
}
