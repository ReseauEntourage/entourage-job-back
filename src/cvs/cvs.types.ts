import * as _ from 'lodash';
import { Op } from 'sequelize';
import {
  BusinessLineFilters,
  BusinessLineValue,
} from 'src/common/business-lines/business-lines.types';
import {
  Department,
  DepartmentFilters,
  RegionFilters,
} from 'src/common/locations/locations.types';
import { EmployedFilters, Gender } from 'src/users/users.types';
import { AdminZones, FilterConstant, Filters } from 'src/utils/types';

export const GenderFilters: FilterConstant<Gender>[] = [
  {
    label: 'Homme',
    value: 0,
  },
  {
    label: 'Femme',
    value: 1,
  },
  {
    label: 'Other',
    value: 2,
  },
];

export interface CVOptions {
  employed: { [Op.or]: boolean[] };
  locations: { [Op.or]: Department[] };
  businessLines: { [Op.or]: BusinessLineValue[] };
  gender: { [Op.or]: Gender[] };
}

export type CVFilterKey = keyof CVOptions;

export type CVConstantType =
  | (typeof DepartmentFilters)[number]['value']
  | (typeof BusinessLineFilters)[number]['value']
  | (typeof EmployedFilters)[number]['value'];

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
  {
    key: 'gender',
    constants: GenderFilters,
    title: 'Genre',
  },
];
