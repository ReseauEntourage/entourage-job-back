import { Includeable } from 'sequelize';
import { BusinessLine } from 'src/businessLines/models';
import { User, UserCandidat } from 'src/users/models';
import { OpportunityUser } from './opportunity-user.model';

export const OpportunityCandidateInclude: Includeable[] = [
  {
    model: User,
    attributes: [
      'id',
      'email',
      'firstName',
      'lastName',
      'gender',
      'zone',
      'phone',
    ],
    include: [
      {
        model: UserCandidat,
        as: 'candidat',
        attributes: ['employed', 'hidden', 'note', 'url'],
        include: [
          {
            model: User,
            as: 'coach',
            attributes: ['id', 'email', 'firstName', 'lastName', 'zone'],
          },
        ],
      },
    ],
  },
];

export const OpportunityCompleteWithoutBusinessLinesInclude: Includeable[] = [
  {
    model: OpportunityUser,
    as: 'opportunityUsers',
    attributes: [
      'id',
      'UserId',
      'status',
      'seen',
      'bookmarked',
      'archived',
      'note',
      'updatedAt',
      'recommended',
    ],
    include: OpportunityCandidateInclude,
  },
];

export const OpportunityCompleteInclude: Includeable[] = [
  ...OpportunityCompleteWithoutBusinessLinesInclude,
  {
    model: BusinessLine,
    as: 'businessLines',
    attributes: ['name', 'order'],
    through: { attributes: [] },
  },
];

export const OpportunityCompleteWithoutOpportunityUsersInclude: Includeable[] =
  [
    {
      model: BusinessLine,
      as: 'businessLines',
      attributes: ['name', 'order'],
      through: { attributes: [] },
    },
  ];

export const OpportunityCompleteAdminWithoutBusinessLinesInclude: Includeable[] =
  [
    {
      model: OpportunityUser,
      as: 'opportunityUsers',
      include: [
        {
          model: User,
          attributes: [
            'id',
            'email',
            'firstName',
            'lastName',
            'gender',
            'email',
            'zone',
          ],
          paranoid: false,
        },
      ],
      attributes: [
        'id',
        'UserId',
        'status',
        'bookmarked',
        'archived',
        'note',
        'seen',
        'recommended',
      ],
    },
  ];

export const OpportunityCompleteAdminInclude: Includeable[] = [
  ...OpportunityCompleteAdminWithoutBusinessLinesInclude,
  {
    model: BusinessLine,
    as: 'businessLines',
    attributes: ['name', 'order'],
    through: { attributes: [] },
  },
];
