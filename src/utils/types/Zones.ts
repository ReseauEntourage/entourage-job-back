import * as _ from 'lodash';
import { FilterConstant } from './Filters';

export const AdminZones = {
  PARIS: 'PARIS',
  LYON: 'LYON',
  LILLE: 'LILLE',
  LORIENT: 'LORIENT',
  RENNES: 'RENNES',
  SUDOUEST: 'SUDOUEST',
  HZ: 'HORS ZONE',
} as const;

export enum LocalBranches {
  NATIONAL = 'National',
  PARIS = 'Paris',
  LILLE = 'Lille',
  LYON = 'Lyon',
  RENNES = 'Rennes',
  SEINE_SAINT_DENIS = 'Seine-Saint-Denis',
  HAUTS_DE_SEINE = 'Hauts-de-Seine',
  MARSEILLE = 'Marseille',
  HZ = 'Hors zone',
  IDF = 'IDF',
  LORIENT = 'Lorient',
  NANTES = 'Nantes',
  BORDEAUX = 'Bordeaux',
  AUTRE_REGION = 'Autre région',
  BRETAGNE = 'Bretagne',
  SAINT_ETIENNE = 'Saint-Étienne',
  TOULOUSE = 'Toulouse',
  SAINT_MALO = 'Saint-Malo',
  GRENOBLE = 'Grenoble',
  ROUBAIX = 'Roubaix',
}

export type AdminZone = (typeof AdminZones)[keyof typeof AdminZones];

export const AdminZoneFilters: FilterConstant<AdminZone>[] = [
  { value: AdminZones.PARIS, label: _.capitalize(AdminZones.PARIS) },
  { value: AdminZones.LILLE, label: _.capitalize(AdminZones.LILLE) },
  { value: AdminZones.LYON, label: _.capitalize(AdminZones.LYON) },
  { value: AdminZones.LORIENT, label: _.capitalize(AdminZones.LORIENT) },
  { value: AdminZones.RENNES, label: _.capitalize(AdminZones.RENNES) },
  { value: AdminZones.SUDOUEST, label: _.capitalize(AdminZones.SUDOUEST) },
  { value: AdminZones.HZ, label: _.capitalize(AdminZones.HZ) },
];

export type AdminZoneFilter = (typeof AdminZoneFilters)[number];

export const LOCAL_BRANCHES_ZONES: { [key in AdminZone]: LocalBranches[] } = {
  [AdminZones.PARIS]: [LocalBranches.NATIONAL, LocalBranches.PARIS],
  [AdminZones.LILLE]: [LocalBranches.NATIONAL, LocalBranches.LILLE],
  [AdminZones.LYON]: [LocalBranches.NATIONAL, LocalBranches.LYON],
  [AdminZones.RENNES]: [LocalBranches.NATIONAL, LocalBranches.RENNES],
  [AdminZones.LORIENT]: [LocalBranches.NATIONAL, LocalBranches.LORIENT],
  [AdminZones.SUDOUEST]: [
    LocalBranches.NATIONAL,
    LocalBranches.BORDEAUX,
    LocalBranches.NANTES,
  ],
  [AdminZones.HZ]: [LocalBranches.NATIONAL, LocalBranches.HZ],
};
