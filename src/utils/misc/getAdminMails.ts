import { AdminZone, Department } from 'src/utils/types';
import { getZone, getZoneSuffix } from './getZone';

export function getAdminMailsFromDepartment(dep: Department['name']) {
  const zone = getZone(dep);
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
