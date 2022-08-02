import * as _ from 'lodash';
import { FilterConstant } from './Filters';

export const AdminZones = {
  PARIS: 'PARIS',
  LYON: 'LYON',
  LILLE: 'LILLE',
  HZ: 'HORS ZONE',
} as const;

export type AdminZone = typeof AdminZones[keyof typeof AdminZones];

export const AdminZoneFilters: FilterConstant<AdminZone>[] = [
  { value: AdminZones.PARIS, label: _.capitalize(AdminZones.PARIS) },
  { value: AdminZones.LILLE, label: _.capitalize(AdminZones.LILLE) },
  { value: AdminZones.LYON, label: _.capitalize(AdminZones.LYON) },
  { value: AdminZones.HZ, label: _.capitalize(AdminZones.HZ) },
];

export type AdminZoneFilter = typeof AdminZoneFilters[number];
