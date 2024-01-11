import { Includeable } from 'sequelize';
import { Organization } from 'src/organizations/models';
import { UserProfile } from 'src/user-profiles/models';
import { getUserProfileInclude } from 'src/user-profiles/models/user-profile.include';
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
        include: [
          {
            model: UserProfile,
            as: 'userProfile',
            attributes: ['description', 'currentJob'],
            include: getUserProfileInclude(),
          },
        ],
      },
    ],
  },
  {
    model: UserCandidat,
    as: 'coaches',
    attributes: [...UserCandidatAttributes],
    include: [
      {
        model: User,
        as: 'candidat',
        attributes: [...UserAttributes],
        paranoid: false,
        include: [
          {
            model: UserProfile,
            as: 'userProfile',
            attributes: ['description', 'currentJob'],
            include: getUserProfileInclude(),
          },
        ],
      },
    ],
  },
  {
    model: Organization,
    as: 'organization',
    attributes: ['name', 'address', 'zone', 'id'],
  },
  {
    model: UserProfile,
    as: 'userProfile',
    attributes: ['description', 'currentJob'],
    include: getUserProfileInclude(),
  },
];
