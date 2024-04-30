import { AdminZone, FilterConstant } from 'src/utils/types';

// je ne souhaite pas répondre
export const JNSPR = 'jnspr';

export const HeardAbout = {
  COMPANY: 'company',
  ENTOURAGE: 'entourage',
  PRESS: 'press',
  LINKEDIN: 'linkedin',
  SOCIAL: 'social',
  SPORTS: 'sports',
  VOLUNTEER: 'volunteer',
  CONTACT: 'contact',
  ORIENTATION: 'orientation',
  OTHER: 'other',
  POLE_EMPLOI: 'pole_emploi',
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
    label: 'Association / travailleur social',
    value: HeardAbout.ORIENTATION,
  },
  {
    label: 'Pôle Emploi',
    value: HeardAbout.POLE_EMPLOI,
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
  OTHER: 'other',
} as const;

export type CandidateGender =
  typeof CandidateGenders[keyof typeof CandidateGenders];

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
  JNSPR: JNSPR,
} as const;

export type CandidateAccommodation =
  typeof CandidateAccommodations[keyof typeof CandidateAccommodations];

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

export const CandidateResources = {
  SALARY: 'salary',
  UNEMPLOYMENT: 'unemployment',
  AAH: 'aah',
  RSA: 'rsa',
  INVALIDITY: 'invalidity',
  OTHER: 'other',
  NONE: 'none',
  JNSPR: 'jnspr',
} as const;

export type CandidateResource =
  typeof CandidateResources[keyof typeof CandidateResources];

export const CandidateYesNo = {
  YES: 'yes',
  NO: 'no',
} as const;

export type CandidateYesNoValue =
  typeof CandidateYesNo[keyof typeof CandidateYesNo];

export const CandidateYesNoNSPP = {
  ...CandidateYesNo,
  NSPP: 'dont_know',
} as const;

export type CandidateYesNoNSPPValue =
  typeof CandidateYesNoNSPP[keyof typeof CandidateYesNoNSPP];

export const YesNoJNSPR = {
  ...CandidateYesNo,
  JNSPR,
};

export type YesNoJNSPRValue = typeof YesNoJNSPR[keyof typeof YesNoJNSPR];

export const Nationalities = {
  FRENCH: 'french',
  EUROPEAN: 'european',
  EXTRA_EUROPEAN: 'extra_european',
  STATELESS: 'stateless',
  JNSPR: JNSPR,
} as const;
export type Nationality = typeof Nationalities[keyof typeof Nationalities];

export const JobSearchDurations = {
  LESS_THAN_3_MONTHS: 'less_than_3_months',
  BETWEEN_3_AND_6_MONTHS: 'between_3_and_6_months',
  BETWEEN_6_AND_12_MONTHS: 'between_6_and_12_months',
  BETWEEN_12_AND_24_MONTHS: 'between_12_and_24_months',
  BETWEEN_24_AND_36_MONTHS: 'between_24_and_36_months',
  MORE_THAN_36_MONTHS: 'more_than_36_months',
  JNSPR: JNSPR,
} as const;
export type JobSearchDuration =
  typeof JobSearchDurations[keyof typeof JobSearchDurations];

export const WorkingExperienceYears = {
  LESS_THAN_3_YEAR: 'less_than_3_year',
  BETWEEN_3_AND_10_YEARS: 'between_3_and_10_years',
  MORE_THAN_10_YEARS: 'more_than_10_years',
  JNSPR: JNSPR,
};
export type WorkingExperience =
  typeof WorkingExperienceYears[keyof typeof WorkingExperienceYears];

export const StudiesLevels = {
  NONE: 'none',
  CAP_BEP: 'cap_bep',
  BAC: 'bac',
  BAC_PLUS_2: 'bac_plus_2',
  BAC_PLUS_3: 'bac_plus_3',
  BAC_PLUS_5: 'bac_plus_5',
  BAC_PLUS_8: 'bac_plus_8',
  JNSPR: JNSPR,
} as const;

export type StudiesLevel = typeof StudiesLevels[keyof typeof StudiesLevels];
