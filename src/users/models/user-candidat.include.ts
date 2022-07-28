import { UserAttributes } from './user.attributes';
import { User } from './user.model';

export const UserInclude = [
  {
    model: User,
    as: 'coach',
    attributes: [...UserAttributes],
    paranoid: false,
  },
  {
    model: User,
    as: 'candidat',
    attributes: [...UserAttributes],
    paranoid: false,
  },
];
