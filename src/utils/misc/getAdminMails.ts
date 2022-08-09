import { Department } from 'src/locations/locations.types';
import { AdminZone } from 'src/utils/types';
import { getZoneFromDepartment, getZoneSuffix } from './getZoneFromDepartment';

export function getAdminMailsFromDepartment(dep: Department) {
  const zone = getZoneFromDepartment(dep);
  return {
    candidatesAdminMail: process.env[`ADMIN_CANDIDATES_${zone}`],
    companiesAdminMail: process.env[`ADMIN_COMPANIES_${zone}`],
  };
}

export function getAdminMailsFromZone(zone: AdminZone) {
  const zoneSuffix = getZoneSuffix(zone);
  return {
    candidatesAdminMail: process.env[`ADMIN_CANDIDATES_${zoneSuffix}`],
    companiesAdminMail: process.env[`ADMIN_COMPANIES_${zoneSuffix}`],
  };
}
