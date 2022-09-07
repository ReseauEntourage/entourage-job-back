import { Department, Departments } from 'src/locations/locations.types';
import { AdminZone, AdminZones } from 'src/utils/types';

export function getZoneSuffix(zone: AdminZone) {
  return zone && zone !== AdminZones.HZ ? zone : 'HZ';
}

export function getZoneSuffixFromDepartment(dept: Department) {
  const department = Departments.find((deptObj) => {
    return deptObj.name === dept;
  });
  return getZoneSuffix(department ? department.zone : null);
}

export function getZoneFromDepartment(dept: Department) {
  const { zone } = Departments.find((deptObj) => {
    return deptObj.name === dept;
  });
  return zone;
}
