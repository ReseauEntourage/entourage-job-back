import { User } from 'src/users/models';

export interface LoggedUser {
  user: User;
  token: string;
}

export type RequestWithAuthorizationHeader = Request & {
  headers: Request['headers'] & { authorization: string };
};
