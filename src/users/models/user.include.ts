import { UserCandidatAttribute } from './user-candidat.attribute';
import { User } from './user.model';
import { UserAttribute } from './user.attribute';
import { UserCandidat } from './user-candidat.model';

export const UserCandidatInclude = [
  {
    model: UserCandidat,
    as: 'candidat',
    attributes: [...UserCandidatAttribute],
    include: [
      {
        model: User,
        as: 'coach',
        attributes: [...UserAttribute],
        paranoid: false,
      },
    ],
  },
  {
    model: UserCandidat,
    as: 'coach',
    attributes: [...UserCandidatAttribute],
    include: [
      {
        model: User,
        as: 'candidat',
        attributes: [...UserAttribute],
        paranoid: false,
      },
    ],
  },
];
