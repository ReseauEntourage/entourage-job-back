import { User, UserAttribute } from 'src/users/models';

export type PayloadUser = Pick<User, UserAttribute | 'candidat' | 'coach'>;

export interface LoggedUser {
  user: PayloadUser;
  token: string;
}

export type RequestWithAuthorizationHeader = Request & {
  headers: Request['headers'] & { authorization: string };
};
