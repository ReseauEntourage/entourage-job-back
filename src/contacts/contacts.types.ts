import { FilterConstant } from 'src/utils/types';

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
    label: 'Le réseau Entourage (newsletter, application...)',
    value: HeardAbout.ENTOURAGE,
  },
  {
    label: 'Un article dans la presse, une newsletter',
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
    label: 'Un partenariat sportif (Bateau LinkedOut, Red Star)',
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

export const CompanyApproachFilters: FilterConstant<CompanyApproach>[] = [
  {
    label: 'Recruter inclusif',
    value: CompanyApproaches.RECRUITMENT,
  },
  {
    label: "Avoir plus d'informations sur LinkedOut",
    value: CompanyApproaches.INFORMATION,
  },
  {
    label: 'Mobiliser mes collaborateurs',
    value: CompanyApproaches.MOBILIZATION,
  },
  {
    label: 'Soutenir le projet (mécénat)',
    value: CompanyApproaches.DONATION,
  },
];
