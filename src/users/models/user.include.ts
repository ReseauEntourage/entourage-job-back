import { UserCandidatAttribute } from './user-candidat.attribute';
import { UserCandidat } from './user-candidat.model';
import { UserAttribute } from './user.attribute';
import { User } from './user.model';

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
