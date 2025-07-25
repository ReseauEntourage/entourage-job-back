import { Op } from 'sequelize';
import { BusinessSectorFilters } from 'src/common/business-sectors/business-sectors.types';
import { BusinessSector } from 'src/common/business-sectors/models';

import {
  AdminZone,
  AdminZoneFilters,
  FilterConstant,
  Filters,
} from 'src/utils/types';

export const UserRoles = {
  CANDIDATE: 'Candidat',
  COACH: 'Coach',
  REFERER: 'Prescripteur',
  ADMIN: 'Admin',
} as const;

export type UserRole = (typeof UserRoles)[keyof typeof UserRoles];

export const Permissions = {
  REFERER: 'Prescripteur',
  CANDIDATE: 'Candidat',
  COACH: 'Coach',
  RESTRICTED_COACH: 'Restricted_Coach',
  ADMIN: 'Admin',
} as const;

export type Permission = (typeof Permissions)[keyof typeof Permissions];

export const UserPermissions: { [K in UserRole]: Permission | Permission[] } = {
  [UserRoles.CANDIDATE]: Permissions.CANDIDATE,
  [UserRoles.REFERER]: Permissions.REFERER,
  [UserRoles.COACH]: [Permissions.COACH, Permissions.RESTRICTED_COACH],
  [UserRoles.ADMIN]: Permissions.ADMIN,
};

export type NormalUserRole =
  | typeof UserRoles.CANDIDATE
  | typeof UserRoles.COACH;

export const NormalUserRoles: NormalUserRole[] = [
  UserRoles.CANDIDATE,
  UserRoles.COACH,
];

export type RegistrableUserRole =
  | typeof UserRoles.CANDIDATE
  | typeof UserRoles.COACH
  | typeof UserRoles.REFERER;

export const RegistrableUserRoles: RegistrableUserRole[] = [
  UserRoles.CANDIDATE,
  UserRoles.COACH,
  UserRoles.REFERER,
];

export const RolesWithOrganization: UserRole[] = [UserRoles.REFERER];

export const AllUserRoles = [
  UserRoles.CANDIDATE,
  UserRoles.COACH,
  UserRoles.REFERER,
];

export const AdminRoles = {
  CANDIDATES: 'Candidats',
  ENTREPRISES: 'Entreprises',
} as const;

export type AdminRole = (typeof AdminRoles)[keyof typeof AdminRoles];

export const UserRolesFilters = [
  { value: UserRoles.CANDIDATE, label: `${UserRoles.CANDIDATE} LKO` },
  { value: UserRoles.COACH, label: `${UserRoles.COACH} LKO` },
  { value: UserRoles.REFERER, label: UserRoles.REFERER },
  { value: UserRoles.ADMIN, label: UserRoles.ADMIN },
];

export const Genders = {
  MALE: 0,
  FEMALE: 1,
  OTHER: 2,
} as const;

export type Gender = (typeof Genders)[keyof typeof Genders];

export interface MemberOptions {
  role: { [Op.or]: UserRole[] };
  zone: { [Op.or]: AdminZone[] };
  businessSectorIds: { [Op.in]: string[] };
  employed: { [Op.or]: boolean[] };
}

export type MemberFilterKey = keyof MemberOptions;

export const EmployedFilters: FilterConstant<boolean>[] = [
  { label: 'En emploi', value: true },
  { label: "Recherche d'emploi", value: false },
];

export type MemberConstantType =
  | (typeof AdminZoneFilters)[number]['value']
  | (typeof BusinessSectorFilters)[number]['value']
  | (typeof EmployedFilters)[number]['value'];

export const MemberFilters = ({
  businessSectors,
}: {
  businessSectors: BusinessSector[];
}): Filters<MemberFilterKey> => [
  {
    key: 'role',
    constants: UserRolesFilters,
    title: 'Type',
  },
  {
    key: 'zone',
    constants: AdminZoneFilters,
    title: 'Zone',
  },
  {
    key: 'businessSectorIds',
    constants: businessSectors.map((sector) => ({
      value: sector.id,
      label: sector.name,
    })) as FilterConstant<string>[],
    title: 'Secteurs d’activité',
  },
  {
    key: 'employed',
    constants: EmployedFilters,
    title: 'En emploi',
  },
];

export const Programs = {
  BOOST: 'boost',
  THREE_SIXTY: 'three_sixty',
} as const;

export type Program = (typeof Programs)[keyof typeof Programs];

export const SequelizeUniqueConstraintError = 'SequelizeUniqueConstraintError';
