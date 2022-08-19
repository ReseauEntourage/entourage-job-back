import * as _ from 'lodash';
import { Op } from 'sequelize';
import {
  BusinessLineFilters,
  BusinessLineValue,
} from 'src/businessLines/businessLines.types';
import {
  Department,
  DepartmentFilters,
  RegionFilters,
} from 'src/locations/locations.types';
import { EmployedFilters } from 'src/users/users.types';
import { AdminZones, Filters } from 'src/utils/types';

export interface CVOptions {
  employed: { [Op.or]: boolean[] };
  locations: { [Op.or]: Department[] };
  businessLines: { [Op.or]: BusinessLineValue[] };
}

export type CVFilterKey = keyof CVOptions;

export type CVConstantType =
  | typeof DepartmentFilters[number]['value']
  | typeof BusinessLineFilters[number]['value']
  | typeof EmployedFilters[number]['value'];

export const CVFilters: Filters<CVFilterKey> = [
  {
    key: 'employed',
    constants: EmployedFilters,
    title: 'Masquer les candidats en emploi',
  },
  {
    key: 'locations',
    constants: RegionFilters,
    priority: _.orderBy(
      RegionFilters.filter((region) => {
        return region.zone !== AdminZones.HZ;
      }),
      'label',
      'desc'
    ),
    title: 'Où ?',
  },
  {
    key: 'businessLines',
    constants: BusinessLineFilters,
    title: 'Métiers',
  },
];
