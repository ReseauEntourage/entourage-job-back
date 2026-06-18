export enum CompanyUserRole {
  EMPLOYEE = 'employee',
  EXECUTIVE = 'executive',
  MANAGER = 'manager',
  RH = 'rh',
  RSE = 'rse',
}

export const COMPANY_ROLES = [
  {
    name: 'Dirigeant.e',
    value: CompanyUserRole.EXECUTIVE,
  },
  {
    name: "Responsable d'équipe",
    value: CompanyUserRole.MANAGER,
  },
  {
    name: 'Responsable RSE',
    value: CompanyUserRole.RSE,
  },
  {
    name: 'RH - Chargé.e de recrutement',
    value: CompanyUserRole.RH,
  },
  {
    name: 'Autre',
    value: CompanyUserRole.EMPLOYEE,
  },
];

export const COMPANY_USER_ROLE_CAN_BE_ADMIN = [
  CompanyUserRole.EXECUTIVE,
  CompanyUserRole.MANAGER,
  CompanyUserRole.RSE,
  CompanyUserRole.RH,
];
