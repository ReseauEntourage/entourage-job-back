import { User, UserAttribute, UserCandidatAttribute } from 'src/users/models';

type PayloadCandidateOrCoach = {
  coaches?: Omit<
    Pick<User['coaches'][number], UserCandidatAttribute | 'candidat'>,
    'note'
  >[];
  candidat?: Omit<
    Pick<User['candidat'], UserCandidatAttribute | 'coach'>,
    'note'
  >;
};

export type PayloadUser = Pick<User, UserAttribute> & PayloadCandidateOrCoach;

export interface LoggedUser {
  user: PayloadUser;
  token: string;
}

export type RequestWithAuthorizationHeader = Request & {
  headers: Request['headers'] & { authorization: string };
};
