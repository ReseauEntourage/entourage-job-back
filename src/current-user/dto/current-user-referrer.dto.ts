import { User } from 'src/users/models';

export interface CurrentUserReferrerDto {
  referer: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
}

export const generateCurrentUserReferrerDto = (
  user: User
): CurrentUserReferrerDto => ({
  referer: user.referer
    ? {
        id: user.referer.id,
        firstName: user.referer.firstName,
        lastName: user.referer.lastName,
      }
    : null,
});
