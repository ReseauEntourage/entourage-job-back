import { Includeable } from 'sequelize';
import { UserCandidatAttributes } from './user-candidat.attributes';
import { UserCandidat } from './user-candidat.model';
import { UserAttributes } from './user.attributes';
import { User } from './user.model';

export const UserCandidatInclude: Includeable[] = [
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
