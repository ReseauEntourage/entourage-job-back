export interface LoggedUser {
  token: string;
}

export type RequestWithAuthorizationHeader = Request & {
  headers: Request['headers'] & { authorization: string };
};
