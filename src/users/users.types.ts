import { Op } from 'sequelize';
import {
  BusinessLineFilters,
  BusinessLineValue,
} from 'src/common/businessLines/businessLines.types';

import {
  AdminZone,
  AdminZoneFilters,
  FilterConstant,
  Filters,
} from 'src/utils/types';

export const UserRoles = {
  CANDIDAT: 'Candidat',
  COACH: 'Coach',
  ADMIN: 'Admin',
} as const;
export type UserRole = typeof UserRoles[keyof typeof UserRoles];

export const AdminRoles = {
  CANDIDATS: 'Candidats',
  ENTREPRISES: 'Entreprises',
} as const;

export type AdminRole = typeof AdminRoles[keyof typeof AdminRoles];

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

export interface MemberOptions {
  zone: { [Op.or]: AdminZone[] };
  businessLines: { [Op.or]: BusinessLineValue[] };
  associatedUser: { [Op.or]: boolean[] };
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
