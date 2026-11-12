// Increment schema version on changes to make sure we dont reuse old saved schemas
export const SCHEMA_VERSION = 9;

// Increment when the instructions of the reading pass change, so that a text
// read with older instructions is not reused to build a profile
export const TRANSCRIPT_VERSION = 1;

// Définition du schéma JSON pour la sortie structurée
export const cvSchema = {
  type: 'object',
  properties: {
    description: {
      type: 'string',
      // Not enforced by the model: the service also cuts the text on import.
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
              "Date de début de l'expérience au format ISO YYYY-MM-DD. Si seule l'année est connue, utiliser le 1er janvier (YYYY-01-01) ; si seuls le mois et l'année sont connus, utiliser le 1er du mois (YYYY-MM-01). Ne jamais inventer de date : ne pas remplir si elle n'apparaît pas dans le CV.",
          },
          endDate: {
            type: 'string',
            pattern: '^([0-9]{4})-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$',
            description:
              "Date de fin de l'expérience au format ISO YYYY-MM-DD. Si seule l'année est connue, utiliser le 1er janvier (YYYY-01-01) ; si seuls le mois et l'année sont connus, utiliser le 1er du mois (YYYY-MM-01). Ne jamais inventer de date : ne pas remplir si elle n'apparaît pas dans le CV. Ne pas remplir si le CV ne donne pas de date de fin, notamment si l'expérience est en cours (ex. « depuis », « présent », « en cours ») ; ne jamais en déduire ni en estimer une. Si le CV ne mentionne qu'une seule date (ex. année d'obtention d'un diplôme), la renseigner ici et laisser la date de début vide.",
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
              "Date de début de la formation au format ISO YYYY-MM-DD. Si seule l'année est connue, utiliser le 1er janvier (YYYY-01-01) ; si seuls le mois et l'année sont connus, utiliser le 1er du mois (YYYY-MM-01). Ne jamais inventer de date : ne pas remplir si elle n'apparaît pas dans le CV.",
          },
          endDate: {
            type: 'string',
            pattern: '^([0-9]{4})-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$',
            description:
              "Date de fin de la formation au format ISO YYYY-MM-DD. Si seule l'année est connue, utiliser le 1er janvier (YYYY-01-01) ; si seuls le mois et l'année sont connus, utiliser le 1er du mois (YYYY-MM-01). Ne jamais inventer de date : ne pas remplir si elle n'apparaît pas dans le CV. Ne pas remplir si le CV ne donne pas de date de fin, notamment si la formation est en cours (ex. « depuis », « présent », « en cours ») ; ne jamais en déduire ni en estimer une. Si le CV ne mentionne qu'une seule date (ex. année d'obtention d'un diplôme), la renseigner ici et laisser la date de début vide.",
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
            description:
              "Niveau de maîtrise de la langue, à déduire uniquement de ce que dit le CV. Ne pas remplir si aucun niveau, score ou diplôme n'est précisé. Un score de test de langue ou le niveau d'un diplôme prime sur toute formulation ambiguë (« compétence professionnelle », « opérationnel », « très bon niveau ») ou contradictoire. Seuils : TOEIC Listening & Reading 941 et plus = FLUENT, 550 à 940 = INTERMEDIATE, moins de 550 = NOTIONS ; IELTS 7.0 et plus = FLUENT, 5.0 à 6.5 = INTERMEDIATE, moins de 5.0 = NOTIONS ; TOEFL iBT 95 et plus = FLUENT, 42 à 94 = INTERMEDIATE, moins de 42 = NOTIONS ; DELF, DALF, Cambridge (C1 Advanced, C2 Proficiency, B2 First…) = niveau CECRL du diplôme. Sans score ni diplôme, échelle : NATIVE uniquement si le CV dit expressément que c'est la langue maternelle (« langue maternelle », « natif », « native », « native speaker », « mother tongue ») ; « bilingue » ne veut pas dire langue maternelle. FLUENT : « bilingue », « bilingual », « courant », « couramment », « fluent », « maîtrise », « excellent », « professionnel complet », CECRL C1-C2. INTERMEDIATE : « intermédiaire », « bon niveau », « conversationnel », « good command », CECRL B1-B2. NOTIONS : « notions », « débutant », « bases », « scolaire », « élémentaire », « basic », « beginner », CECRL A1-A2.",
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

// Result of the extraction of a CV: the profile data, and the text read from
// the CV when it was extracted in two passes (null for the single call)
export interface CvExtractionResult {
  data: CvSchemaType;
  transcript: string | null;
}

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
    level?: string;
    // Nom de la langue en français
    name: string;
    // Code ISO 639-1 de la langue
    value: string;
  }>;

  //Nudges
  nudges?: Array<{ name: string; order?: number }>;

  schemaVersion: number;

  //Skills
  skills?: Array<{ name: string; order?: number }>;

  // contracts?: Array<{ name: string }>;
}
