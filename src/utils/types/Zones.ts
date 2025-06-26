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
