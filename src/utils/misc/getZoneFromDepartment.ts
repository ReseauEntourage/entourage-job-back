import { ZoneName } from '../types/zones.types';
import { Department, Departments } from 'src/locations/locations.types';

export function getZoneNameFromDepartment(dept: Department) {
  const deptObj = Departments.find((deptObj) => {
    return deptObj.name === dept;
  });
  return deptObj ? deptObj.zone : ZoneName.HZ;
}
