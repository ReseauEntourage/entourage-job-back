import { User } from 'src/users/models';

export interface CurrentUserOrganizationDto {
  address: string | null;
  id: string;
  name: string;
  zone: string;
}

export const generateCurrentUserOrganizationDto = (
  user: User
): CurrentUserOrganizationDto | null => {
  if (!user.organization) {
    return null;
  }
  return {
    id: user.organization.id,
    name: user.organization.name,
    address: user.organization.address || null,
    zone: user.organization.zone,
  };
};
