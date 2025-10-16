import { CurrentUserDto } from './dto/current-user.dto';

export interface LoggedUser {
  user: CurrentUserDto;
  token: string;
}

export type RequestWithAuthorizationHeader = Request & {
  headers: Request['headers'] & { authorization: string };
};
