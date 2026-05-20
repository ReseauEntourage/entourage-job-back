import { Departments } from 'src/common/locations/locations.types';

/**
 * Returns the grammatically correct locative phrase for a department.
 * Accepts the raw `profile.department` value (e.g. "Pas-de-Calais (62)").
 * Falls back to "dans sa région" if the department is unknown.
 */
export function getDepartmentLocative(rawDepartment: string | null): string {
  if (!rawDepartment) return 'dans sa région';
  return (
    Departments.find((d) => d.name === rawDepartment)?.locative ??
    'dans sa région'
  );
}
