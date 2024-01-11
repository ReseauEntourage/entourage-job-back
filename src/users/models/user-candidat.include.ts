import { Includeable } from 'sequelize';
import { UserProfile } from 'src/user-profiles/models';
import { getUserProfileInclude } from 'src/user-profiles/models/user-profile.include';
import { UserAttributes } from './user.attributes';
import { User } from './user.model';

export const UserInclude: Includeable[] = [
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
];
