import { Op } from 'sequelize';
import {
  BusinessSectorFilters,
  BusinessSectorValue,
} from 'src/common/business-sectors/business-sectors.types';

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

type AssociatedUserWhereOptions = {
  [K in string]: { [Op.is]: null } | { [Op.not]: null };
};

export interface MemberOptions {
  role: { [Op.or]: UserRole[] };
  zone: { [Op.or]: AdminZone[] };
  businessSectors: { [Op.in]: BusinessSectorValue[] };
  associatedUser: {
    candidat: {
      [Op.or]: AssociatedUserWhereOptions[];
    };
    coach: {
      [Op.or]: AssociatedUserWhereOptions[];
    };
  };
  employed: { [Op.or]: boolean[] };
}

export type MemberFilterKey = keyof MemberOptions;

const AssociatedUserFilters: FilterConstant<boolean>[] = [
  { label: 'Binôme en cours', value: true },
  { label: 'Sans binôme', value: false },
];

export const EmployedFilters: FilterConstant<boolean>[] = [
  { label: 'En emploi', value: true },
  { label: "Recherche d'emploi", value: false },
];

export type MemberConstantType =
  | (typeof AdminZoneFilters)[number]['value']
  | (typeof BusinessSectorFilters)[number]['value']
  | (typeof AssociatedUserFilters)[number]['value']
  | (typeof EmployedFilters)[number]['value'];

export const MemberFilters: Filters<MemberFilterKey> = [
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
    key: 'businessSectors',
    constants: BusinessSectorFilters,
    title: 'Métiers',
  },
  {
    key: 'associatedUser',
    constants: AssociatedUserFilters,
    title: 'Membre associé',
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
