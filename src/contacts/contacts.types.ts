import { AdminZone, FilterConstant } from 'src/utils/types';

export const HeardAbout = {
  COMPANY: 'company',
  ENTOURAGE: 'entourage',
  PRESS: 'press',
  LINKEDIN: 'linkedin',
  SOCIAL: 'social',
  SPORTS: 'sports',
  VOLUNTEER: 'volunteer',
  CONTACT: 'contact',
  OTHER: 'other',
} as const;

export type HeardAboutValue = typeof HeardAbout[keyof typeof HeardAbout];

export const HeardAboutFilters: FilterConstant<HeardAboutValue>[] = [
  {
    label: 'Mon entreprise',
    value: HeardAbout.COMPANY,
  },
  {
    label: 'Le réseau Entourage',
    value: HeardAbout.ENTOURAGE,
  },
  {
    label: 'Les médias (presse, web, TV)',
    value: HeardAbout.PRESS,
  },
  {
    label: 'LinkedIn',
    value: HeardAbout.LINKEDIN,
  },
  {
    label: 'Autres réseaux (Facebook, Twitter, Instagram...)',
    value: HeardAbout.SOCIAL,
  },
  {
    label: 'Un partenariat sportif',
    value: HeardAbout.SPORTS,
  },
  {
    label: 'Un site de bénévolat',
    value: HeardAbout.VOLUNTEER,
  },
  {
    label: 'Le bouche à oreille',
    value: HeardAbout.CONTACT,
  },
  {
    label: 'Autre',
    value: HeardAbout.OTHER,
  },
];

export const CompanyApproaches = {
  RECRUITMENT: 'recruitment',
  INFORMATION: 'information',
  MOBILIZATION: 'mobilization',
  DONATION: 'donation',
} as const;

export type CompanyApproach =
  typeof CompanyApproaches[keyof typeof CompanyApproaches];

export type CompanyZone = AdminZone | 'NATIONAL';

export const CandidateHelpWith = {
  WORK: 'work',
  SOCIAL: 'social',
  ACCOMMODATION: 'accommodation',
  HEALTH: 'health',
  RIGHTS: 'rights',
  OTHER: 'other',
} as const;

export type CandidateHelpWithValue =
  typeof CandidateHelpWith[keyof typeof CandidateHelpWith];

export const CandidateGenders = {
  MALE: 'male',
  FEMALE: 'female',
} as const;

export type CandidateGender =
  typeof CandidateGenders[keyof typeof CandidateGenders];

export const CandidateResources = {
  SALARY: 'salary',
  UNEMPLOYMENT: 'unemployment',
  AAH: 'aah',
  RSA: 'rsa',
  INVALIDITY: 'invalidity',
  OTHER: 'other',
  NONE: 'none',
} as const;

export type CandidateResource =
  typeof CandidateResources[keyof typeof CandidateResources];

export const CandidateProfessionalSituations = {
  UNEMPLOYED: 'unemployed',
  CDI: 'cdi',
  CDD: 'cdd',
  FORM: 'form',
  INTE: 'inte',
  STUDENT: 'student',
  CDDI: 'cddi',
  OTHER: 'other',
} as const;

export type CandidateProfessionalSituation =
  typeof CandidateProfessionalSituations[keyof typeof CandidateProfessionalSituations];

export const CandidateAdministrativeSituations = {
  ID_CARD_FR: 'id_card_fr',
  PASSPORT: 'passport',
  RESIDENCE_PERMIT: 'residence_permit',
  RESIDENCE_PERMIT_RECEIPT: 'residence_permit_receipt',
  RESIDENT_CARD: 'resident_card',
  ASYLUM: 'asylum',
  ASYLUM_DISMISSED: 'asylum_dismissed',
} as const;

export type CandidateAdministrativeSituation =
  typeof CandidateAdministrativeSituations[keyof typeof CandidateAdministrativeSituations];

export const CandidateAccommodations = {
  PERSONAL: 'personal',
  SOMEONE: 'someone',
  URGENCY: 'urgency',
  INSERTION: 'insertion',
  STREET: 'street',
  OTHER: 'other',
} as const;

export type CandidateAccommodation =
  typeof CandidateAccommodations[keyof typeof CandidateAccommodations];

export const CandidateYesNo = {
  YES: 'yes',
  NO: 'no',
} as const;

export type CandidateYesNoValue =
  typeof CandidateYesNo[keyof typeof CandidateYesNo];
