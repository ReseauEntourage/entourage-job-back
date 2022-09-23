import { Department } from 'src/common/locations/locations.types';
import { AdminZone } from 'src/utils/types';
import {
  getZoneSuffix,
  getZoneSuffixFromDepartment,
} from './getZoneFromDepartment';

export function getAdminMailsFromDepartment(dep: Department) {
  const zoneSuffix = getZoneSuffixFromDepartment(dep);
  return {
    candidatesAdminMail: process.env[`ADMIN_CANDIDATES_${zoneSuffix}`],
    companiesAdminMail: process.env[`ADMIN_COMPANIES_${zoneSuffix}`],
  };
}

export function getAdminMailsFromZone(zone: AdminZone) {
  const zoneSuffix = getZoneSuffix(zone);
  return {
    candidatesAdminMail: process.env[`ADMIN_CANDIDATES_${zoneSuffix}`],
    companiesAdminMail: process.env[`ADMIN_COMPANIES_${zoneSuffix}`],
  };
}
