import { Op } from 'sequelize';
import {
  BusinessLineFilters,
  BusinessLineValue,
} from 'src/common/business-lines/business-lines.types';

import {
  AdminZone,
  AdminZoneFilters,
  FilterConstant,
  Filters,
} from 'src/utils/types';

export const UserRoles = {
  CANDIDATE: 'Candidat',
  CANDIDATE_EXTERNAL: 'Candidat externe',
  COACH: 'Coach',
  COACH_EXTERNAL: 'Coach externe',
  ADMIN: 'Admin',
} as const;

export type UserRole = typeof UserRoles[keyof typeof UserRoles];

export const Permissions = {
  CANDIDATE: 'Candidat',
  COACH: 'Coach',
  RESTRICTED_COACH: 'Restricted_Coach',
  ADMIN: 'Admin',
} as const;

export type Permission = typeof Permissions[keyof typeof Permissions];

export const UserPermissions: { [K in UserRole]: Permission | Permission[] } = {
  [UserRoles.CANDIDATE]: Permissions.CANDIDATE,
  [UserRoles.CANDIDATE_EXTERNAL]: Permissions.CANDIDATE,
  [UserRoles.COACH]: [Permissions.COACH, Permissions.RESTRICTED_COACH],
  [UserRoles.COACH_EXTERNAL]: Permissions.COACH,
  [UserRoles.ADMIN]: Permissions.ADMIN,
};

export const NormalUserRoles = [UserRoles.CANDIDATE, UserRoles.COACH];
export const ExternalUserRoles = [
  UserRoles.CANDIDATE_EXTERNAL,
  UserRoles.COACH_EXTERNAL,
];

export const CandidateUserRoles = [
  UserRoles.CANDIDATE,
  UserRoles.CANDIDATE_EXTERNAL,
];
export const CoachUserRoles = [UserRoles.COACH, UserRoles.COACH_EXTERNAL];
export const AllUserRoles = [...CandidateUserRoles, ...CoachUserRoles];

export const AdminRoles = {
  CANDIDATES: 'Candidats',
  ENTREPRISES: 'Entreprises',
} as const;

export type AdminRole = typeof AdminRoles[keyof typeof AdminRoles];

export const UserRolesFilters = [
  { value: UserRoles.CANDIDATE, label: `${UserRoles.CANDIDATE} LKO` },
  {
    value: UserRoles.CANDIDATE_EXTERNAL,
    label: UserRoles.CANDIDATE_EXTERNAL,
  },
  { value: UserRoles.COACH, label: `${UserRoles.COACH} LKO` },
  { value: UserRoles.COACH_EXTERNAL, label: UserRoles.COACH_EXTERNAL },
  { value: UserRoles.ADMIN, label: UserRoles.ADMIN },
];

export const Genders = {
  MALE: 0,
  FEMALE: 1,
} as const;

export type Gender = typeof Genders[keyof typeof Genders];

export const CVStatuses = {
  PUBLISHED: {
    label: 'Publié',
    value: 'Published',
    style: 'success',
  },
  PENDING: {
    label: 'En attente',
    value: 'Pending',
    style: 'danger',
  },
  PROGRESS: {
    label: 'En cours',
    value: 'Progress',
    style: 'muted',
  },
  NEW: {
    label: 'Nouveau',
    value: 'New',
    style: 'muted',
  },
  DRAFT: {
    label: 'Brouillon',
    value: 'Draft',
    style: 'warning',
  },
  UNKNOWN: {
    label: 'Inconnu',
    value: 'Unknown',
    style: '',
  },
} as const;

export type CVStatusKey = keyof typeof CVStatuses;
export type CVStatus = typeof CVStatuses[CVStatusKey]['value'];

export const CVStatusFilters: FilterConstant<CVStatus>[] = [
  CVStatuses.PUBLISHED,
  CVStatuses.PENDING,
  CVStatuses.PROGRESS,
  CVStatuses.NEW,
];

type AssociatedUserWhereOptions = {
  [K in string]: { [Op.is]: null } | { [Op.not]: null };
};

export interface MemberOptions {
  role: { [Op.or]: UserRole[] };
  zone: { [Op.or]: AdminZone[] };
  businessLines: { [Op.in]: BusinessLineValue[] };
  associatedUser: {
    candidat: {
      [Op.or]: AssociatedUserWhereOptions[];
    };
    coach: {
      [Op.or]: AssociatedUserWhereOptions[];
    };
  };
  hidden: { [Op.or]: boolean[] };
  employed: { [Op.or]: boolean[] };
  cvStatus: { [Op.or]: CVStatus[] };
}

export type MemberFilterKey = keyof MemberOptions;

const AssociatedUserFilters: FilterConstant<boolean>[] = [
  { label: 'Binôme en cours', value: true },
  { label: 'Sans binôme', value: false },
];

const HiddenFilters: FilterConstant<boolean>[] = [
  { label: 'CV masqués', value: true },
  { label: 'CV visibles', value: false },
];

export const EmployedFilters: FilterConstant<boolean>[] = [
  { label: 'En emploi', value: true },
  { label: "Recherche d'emploi", value: false },
];

export type MemberConstantType =
  | typeof AdminZoneFilters[number]['value']
  | typeof BusinessLineFilters[number]['value']
  | typeof AssociatedUserFilters[number]['value']
  | typeof HiddenFilters[number]['value']
  | typeof EmployedFilters[number]['value']
  | typeof CVStatusFilters[number]['value'];

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
    key: 'businessLines',
    constants: BusinessLineFilters,
    title: 'Métiers',
  },
  {
    key: 'associatedUser',
    constants: AssociatedUserFilters,
    title: 'Membre associé',
  },
  {
    key: 'hidden',
    constants: HiddenFilters,
    title: 'CV masqué',
  },
  {
    key: 'employed',
    constants: EmployedFilters,
    title: 'En emploi',
  },
  {
    key: 'cvStatus',
    constants: CVStatusFilters,
    title: 'Statut du CV',
  },
];

export const SequelizeUniqueConstraintError = 'SequelizeUniqueConstraintError';
