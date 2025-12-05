import { Op } from 'sequelize';
import { BusinessSectorFilters } from 'src/common/business-sectors/business-sectors.types';
import { BusinessSector } from 'src/common/business-sectors/models';

import { FilterConstant, Filters } from 'src/utils/types';
import { ZoneName, ZoneNameFilters } from 'src/utils/types/zones.types';
import { User } from './models/user.model';
import { JWTUserPayloadAttributes } from './users.attributes';

export type JWTUserPayloadAttribute = (typeof JWTUserPayloadAttributes)[number];

export type JWTUserPayload = Pick<User, JWTUserPayloadAttribute>;

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
  zone: { [Op.or]: ZoneName[] };
  businessSectorIds: { [Op.in]: string[] };
}

export type MemberFilterKey = keyof MemberOptions;

export type MemberConstantType =
  | (typeof ZoneNameFilters)[number]['value']
  | (typeof BusinessSectorFilters)[number]['value'];

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
    constants: ZoneNameFilters,
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
];

export const SequelizeUniqueConstraintError = 'SequelizeUniqueConstraintError';
