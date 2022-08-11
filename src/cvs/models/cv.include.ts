import { BusinessLine } from 'src/businessLines/models';
import { Location } from 'src/locations/models';
import { User, UserCandidat } from 'src/users/models';

export const UserAllInclude = {
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

export const UserNotHiddenInclude = {
  ...UserAllInclude,
  where: { hidden: false },
};

export const CVCompleteWithoutUserInclude = [
  /*  {
    models: models.Contract,
    as: 'contracts',
    through: { attributes: [] },
    attributes: ['id', 'name'],
  },
  {
    models: models.Language,
    as: 'languages',
    through: { attributes: [] },
    attributes: ['id', 'name'],
  },
  {
    models: models.Passion,
    as: 'passions',
    through: { attributes: [] },
    attributes: ['id', 'name'],
  },
  {
    models: models.Skill,
    as: 'skills',
    through: { attributes: [] },
    attributes: ['id', 'name'],
  },
  {
    models: models.Ambition,
    as: 'ambitions',
    through: { attributes: [] },
    attributes: ['id', 'name', 'prefix', 'order'],
  },*/
  {
    model: BusinessLine,
    as: 'businessLines',
    /* through: { attributes: [] },*/
    attributes: ['id', 'name', 'order'],
  },
  {
    model: Location,
    as: 'locations',
    /* through: { attributes: [] },*/
    attributes: ['id', 'name'],
  },
  /*{
    models: models.Experience,
    as: 'experiences',
    attributes: ['id', 'description', 'order'],
    include: [
      {
        models: models.Skill,
        as: 'skills',
        through: { attributes: [] },
        attributes: ['id', 'name'],
      },
    ],
    order: [['order', 'ASC']],
  },
  {
    models: models.Review,
    as: 'reviews',
    attributes: ['id', 'text', 'status', 'name'],
  },*/
];

export const CVCompleteWithNotHiddenUserInclude = [
  ...CVCompleteWithoutUserInclude,
  UserNotHiddenInclude,
];

export const CVCompleteWithAllUserInclude = [
  ...CVCompleteWithoutUserInclude,
  UserAllInclude,
];

export const CVCompleteWithAllUserPrivateInclude = [
  ...CVCompleteWithoutUserInclude,
  UserAllPrivateInclude,
];
