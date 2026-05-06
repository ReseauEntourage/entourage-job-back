import { User } from 'src/users/models';

export interface CurrentUserCompanyBusinessSector {
  id: string;
  name: string;
  value: string;
}

export interface CurrentUserCompanyDepartment {
  id: string;
  name: string;
  value: string;
}

export interface CurrentUserCompanyDto {
  id: string;
  name: string;
  description: string | null;
  goal: string | null;
  url: string | null;
  hiringUrl: string | null;
  linkedInUrl: string | null;
  logoUrl: string | null;
  businessSectors: CurrentUserCompanyBusinessSector[];
  department: CurrentUserCompanyDepartment | null;
  companyUser: {
    isAdmin: boolean;
    role: string | null;
  };
}

export const generateCurrentUserCompanyDto = (
  user: User
): CurrentUserCompanyDto | null => {
  const company = user.companies?.[0];
  if (!company) {
    return null;
  }
  return {
    id: company.id,
    name: company.name,
    description: company.description ?? null,
    goal: company.goal || null,
    url: company.url ?? null,
    hiringUrl: company.hiringUrl ?? null,
    linkedInUrl: company.linkedInUrl ?? null,
    logoUrl: company.logoUrl ?? null,
    businessSectors: (company.businessSectors ?? []).map((bs) => ({
      id: bs.id,
      name: bs.name,
      value: bs.value,
    })),
    department: company.department
      ? {
          id: company.department.id,
          name: company.department.name,
          value: company.department.value,
        }
      : null,
    companyUser: {
      isAdmin: company.companyUser?.isAdmin ?? false,
      role: company.companyUser?.role || null,
    },
  };
};
