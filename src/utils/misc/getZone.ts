import { AdminZone, AdminZones, Department, Departments } from '../types';

export function getZoneSuffix(zone: AdminZone) {
  return zone && zone !== AdminZones.HZ ? zone : 'HZ';
}

export function getZone(dept: Department['name']) {
  const department = Departments.find((deptObj) => {
    return deptObj.name === dept;
  });
  return getZoneSuffix(department ? department.zone : null);
}
