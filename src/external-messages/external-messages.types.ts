import { FilterConstant } from 'src/utils/types';

export const ExternalMessageContactTypes = {
  INDIVIDUAL: 'individual',
  COMPANY: 'company',
  COACH_CONNECTOR: 'coach_connector',
} as const;

export type ExternalMessageContactType =
  typeof ExternalMessageContactTypes[keyof typeof ExternalMessageContactTypes];

export const ExternalMessageContactTypeFilters: FilterConstant<ExternalMessageContactType>[] =
  [
    {
      label: 'un particulier',
      value: ExternalMessageContactTypes.INDIVIDUAL,
    },
    {
      label: 'une entreprise',
      value: ExternalMessageContactTypes.COMPANY,
    },
    {
      label: 'un coach/connecteur',
      value: ExternalMessageContactTypes.COACH_CONNECTOR,
    },
  ];

export const ExternalMessageSubjects = {
  HIRING: 'hiring',
  HELP: 'help',
  RELATION: 'relation',
  ADVICE: 'advice',
  CHEERING: 'cheering',
  OTHER: 'other',
} as const;

export type ExternalMessageSubject =
  typeof ExternalMessageSubjects[keyof typeof ExternalMessageSubjects];

export const ExternalMessageSubjectFilters: FilterConstant<ExternalMessageSubject>[] =
  [
    {
      label: "Proposition d'embauche",
      value: ExternalMessageSubjects.HIRING,
    },
    {
      label: 'Coup de pouce',
      value: ExternalMessageSubjects.HELP,
    },
    {
      label: 'Mise en relation',
      value: ExternalMessageSubjects.RELATION,
    },
    {
      label: 'Conseils',
      value: ExternalMessageSubjects.ADVICE,
    },
    {
      label: 'Encouragements',
      value: ExternalMessageSubjects.CHEERING,
    },
    {
      label: 'Autre',
      value: ExternalMessageSubjects.OTHER,
    },
  ];
