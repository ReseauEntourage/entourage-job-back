import { FilterConstant } from 'src/utils/types';

export const MessageContactTypes = {
  INDIVIDUAL: 'individual',
  COMPANY: 'company',
  COACH_CONNECTOR: 'coach_connector',
} as const;

export type MessageContactType =
  typeof MessageContactTypes[keyof typeof MessageContactTypes];

export const MessageContactTypeFilters: FilterConstant<MessageContactType>[] = [
  {
    label: 'un particulier',
    value: MessageContactTypes.INDIVIDUAL,
  },
  {
    label: 'une entreprise',
    value: MessageContactTypes.COMPANY,
  },
  {
    label: 'un coach/connecteur',
    value: MessageContactTypes.COACH_CONNECTOR,
  },
];

export const MessageSubjects = {
  HIRING: 'hiring',
  HELP: 'help',
  RELATION: 'relation',
  ADVICE: 'advice',
  CHEERING: 'cheering',
  OTHER: 'other',
} as const;

export type MessageSubject =
  typeof MessageSubjects[keyof typeof MessageSubjects];

export const MessageSubjectFilters: FilterConstant<MessageSubject>[] = [
  {
    label: "Proposition d'embauche",
    value: MessageSubjects.HIRING,
  },
  {
    label: 'Coup de pouce',
    value: MessageSubjects.HELP,
  },
  {
    label: 'Mise en relation',
    value: MessageSubjects.RELATION,
  },
  {
    label: 'Conseils',
    value: MessageSubjects.ADVICE,
  },
  {
    label: 'Encouragements',
    value: MessageSubjects.CHEERING,
  },
  {
    label: 'Autre',
    value: MessageSubjects.OTHER,
  },
];
