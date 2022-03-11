import { UserCandidatAttributes } from './user-candidat.attributes';
import { User } from './user.model';
import { UserAttributes } from './user.attributes';
import { UserCandidat } from './user-candidat.model';

export const INCLUDE_USER_CANDIDAT = [
  {
    model: UserCandidat,
    as: 'candidat',
    attributes: [...UserCandidatAttributes],
    include: [
      {
        model: User,
        as: 'coach',
        attributes: [...UserAttributes],
        paranoid: false,
      },
    ],
  },
  {
    model: UserCandidat,
    as: 'coach',
    attributes: [...UserCandidatAttributes],
    include: [
      {
        model: User,
        as: 'candidat',
        attributes: [...UserAttributes],
        paranoid: false,
      },
    ],
  },
];
