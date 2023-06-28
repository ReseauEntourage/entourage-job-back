import { Includeable } from 'sequelize/types';
import { Ambition } from 'src/common/ambitions/models';
import { BusinessLine } from 'src/common/businessLines/models';
import { Contract } from 'src/common/contracts/models';
import { Experience } from 'src/common/experiences/models/experience.model';
import { Language } from 'src/common/languages/models';
import { Location } from 'src/common/locations/models';
import { Passion } from 'src/common/passions/models';
import { Review } from 'src/common/reviews/models/review.model';
import { Skill } from 'src/common/skills/models';
import { User, UserCandidat } from 'src/users/models';

export const UserAllInclude: Includeable = {
  model: UserCandidat,
  as: 'user',
  attributes: ['employed', 'hidden', 'url', 'endOfContract'],
  include: [
    {
      model: User,
      as: 'coach',
      attributes: ['id', 'firstName', 'lastName', 'gender'],
    },
    {
      model: User,
      as: 'candidat',
      attributes: ['id', 'firstName', 'lastName', 'gender'],
    },
  ],
};

export const UserAllPrivateInclude = {
  model: UserCandidat,
  as: 'user',
  attributes: ['employed', 'hidden', 'url'],
  include: [
    {
      model: User,
      as: 'coach',
      attributes: ['id', 'firstName', 'lastName', 'gender', 'email'],
    },
    {
      model: User,
      as: 'candidat',
      attributes: [
        'id',
        'firstName',
        'lastName',
        'gender',
        'email',
        'phone',
        'address',
        'zone',
      ],
    },
  ],
};

export const UserNotHiddenInclude: Includeable = {
  ...UserAllInclude,
  where: { hidden: false },
};

export const CVCompleteWithoutUserInclude: Includeable[] = [
  {
    model: Contract,
    as: 'contracts',
    attributes: ['id', 'name'],
  },
  {
    model: Language,
    as: 'languages',
    attributes: ['id', 'name'],
  },
  {
    model: Passion,
    as: 'passions',
    attributes: ['id', 'name'],
  },
  {
    model: Skill,
    as: 'skills',
    attributes: ['id', 'name'],
  },
  {
    model: Ambition,
    as: 'ambitions',
    attributes: ['id', 'name', 'prefix', 'order'],
  },
  {
    model: BusinessLine,
    as: 'businessLines',
    attributes: ['id', 'name', 'order'],
  },
  {
    model: Location,
    as: 'locations',
    attributes: ['id', 'name', 'order'],
    order: [['locations.order', 'ASC']],
  },
  {
    model: Experience,
    as: 'experiences',
    separate: true,
    attributes: ['id', 'description', 'order'],
    include: [
      {
        model: Skill,
        as: 'skills',
        attributes: ['id', 'name'],
      },
    ],
    order: [['order', 'ASC']],
  },
  {
    model: Review,
    as: 'reviews',
    separate: true,
    attributes: ['id', 'text', 'status', 'name'],
  },
];

export const CVCompleteWithNotHiddenUserInclude: Includeable[] = [
  ...CVCompleteWithoutUserInclude,
  UserNotHiddenInclude,
];

export const CVCompleteWithAllUserInclude: Includeable[] = [
  ...CVCompleteWithoutUserInclude,
  UserAllInclude,
];

export const CVCompleteWithAllUserPrivateInclude: Includeable[] = [
  ...CVCompleteWithoutUserInclude,
  UserAllPrivateInclude,
];
