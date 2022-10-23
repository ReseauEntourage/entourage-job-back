import _ from 'lodash';
import { AdminZone, AdminZones, FilterConstant } from 'src/utils/types';

export interface PleziTrackingData {
  visit?: string;
  visitor?: string;
  urlParams?: {
    utm?: string;
    utm_medium?: string;
    utm_source?: string;
    gclid?: string;
    referer?: string;
  };
}

export type HeardAbout =
  | 'contact'
  | 'search'
  | 'socialAdd'
  | 'otherAdd'
  | 'press'
  | 'other';

export const HeardAboutFilters: FilterConstant<HeardAbout>[] = [
  {
    label: 'Par un de mes contacts',
    value: 'contact',
  },
  {
    label: 'Recherche internet',
    value: 'search',
  },
  {
    label: 'Publicité sur les réseaux sociaux',
    value: 'socialAdd',
  },
  {
    label: 'Autre publicité',
    value: 'otherAdd',
  },
  {
    label: 'Press',
    value: 'press',
  },
  {
    label: 'Autre',
    value: 'other',
  },
];

export const ContactStatuses = {
  INDIVIDUAL: 'PARTICULIER',
  COMPANY: 'ENTREPRISE',
  STRUCTURE: 'STRUCTURE_INSERTION',
  CANDIDATE: 'CANDIDAT_POTENTIEL',
} as const;

export type ContactStatus =
  typeof ContactStatuses[keyof typeof ContactStatuses];

export const PleziContactRegions: { [K in AdminZone]: string } = {
  [AdminZones.LYON]: AdminZones.LYON.toLowerCase(),
  [AdminZones.PARIS]: AdminZones.PARIS.toLowerCase(),
  [AdminZones.LILLE]: AdminZones.LILLE.toLowerCase(),
  [AdminZones.LORIENT]: 'rennes',
  [AdminZones.HZ]: AdminZones.HZ.toLowerCase(),
} as const;

export const PleziContactStatuses: { [K in ContactStatus]: string } = {
  PARTICULIER: 'un-particulier',
  ENTREPRISE: 'une-entreprise',
  STRUCTURE_INSERTION: 'une-structure-d-insertion',
  CANDIDAT_POTENTIEL: 'un-candidat-potentiel',
} as const;

export const PleziNewsletter = 'linkedout-newsletter' as const;
