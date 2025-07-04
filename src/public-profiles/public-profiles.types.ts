import _ from 'lodash';
import { Op } from 'sequelize';
import { BusinessSectorFilters } from 'src/common/business-sectors/business-sectors.types';
import {
  Department,
  DepartmentFilters,
  RegionFilters,
} from 'src/common/locations/locations.types';
import { EmployedFilters, Gender } from 'src/users/users.types';
import { AdminZones, Filters } from 'src/utils/types';

export interface PublicProfileOptions {
  employed: { [Op.or]: boolean[] };
  locations: { [Op.or]: Department[] };
  businessSectorIds: { [Op.or]: string[] };
  gender: { [Op.or]: Gender[] };
}

export type PublicProfileFilterKey = keyof PublicProfileOptions;

export type PublicProfileConstantType =
  | (typeof DepartmentFilters)[number]['value']
  | (typeof BusinessSectorFilters)[number]['value']
  | (typeof EmployedFilters)[number]['value'];

export const PublicProfileFilters: Filters<PublicProfileFilterKey> = [
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
    key: 'businessSectorIds',
    constants: BusinessSectorFilters,
    title: 'Métiers',
  },
];
