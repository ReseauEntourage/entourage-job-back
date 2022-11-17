import { AdminZone, AdminZones } from 'src/utils/types';

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
  [AdminZones.LORIENT]: AdminZones.LORIENT.toLowerCase(),
  [AdminZones.RENNES]: AdminZones.RENNES.toLowerCase(),
  [AdminZones.HZ]: AdminZones.HZ.toLowerCase(),
} as const;

export const PleziContactStatuses: { [K in ContactStatus]: string } = {
  PARTICULIER: 'un-particulier',
  ENTREPRISE: 'une-entreprise',
  STRUCTURE_INSERTION: 'une-structure-d-insertion',
  CANDIDAT_POTENTIEL: 'un-candidat-potentiel',
} as const;

export const PleziNewsletterId = '6311128ae317a70f550b73fc' as const;

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
