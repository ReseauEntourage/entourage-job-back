import { Includeable, Op } from 'sequelize';
import { OfferStatus } from '../opportunities.types';
import { BusinessLine } from 'src/common/businessLines/models';
import { Contract } from 'src/common/contracts/models';
import { User, UserCandidat } from 'src/users/models';
import { FilterConstant } from 'src/utils/types';
import { OpportunityUserEvent } from './opportunity-user-event.model';
import { OpportunityUser } from './opportunity-user.model';

export const OpportunityCandidateInclude: Includeable[] = [
  {
    model: OpportunityUserEvent,
    as: 'events',
    include: [
      {
        model: Contract,
        as: 'contract',
      },
    ],
  },
  {
    model: User,
    as: 'user',
    attributes: [
      'id',
      'email',
      'firstName',
      'lastName',
      'gender',
      'zone',
      'phone',
      'role',
    ],
    include: [
      {
        model: UserCandidat,
        as: 'candidat',
        attributes: ['employed', 'hidden', 'url'],
        include: [
          {
            model: User,
            as: 'coach',
            attributes: [
              'id',
              'email',
              'firstName',
              'lastName',
              'zone',
              'role',
            ],
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
      'OpportunityId',
      'status',
      'seen',
      'bookmarked',
      'archived',
      'note',
      'updatedAt',
      'createdAt',
      'recommended',
    ],
    include: OpportunityCandidateInclude,
  },
];

export function renderOpportunityCompleteWithoutBusinessLinesInclude(
  statusParams: FilterConstant<OfferStatus>[],
  candidateId: string
): Includeable[] {
  return [
    {
      model: OpportunityUser,
      as: 'opportunityUsers',
      attributes: [
        'id',
        'UserId',
        'OpportunityId',
        'status',
        'seen',
        'bookmarked',
        'archived',
        'note',
        'updatedAt',
        'createdAt',
        'recommended',
      ],
      include: OpportunityCandidateInclude,
      required: !!statusParams,
      where: {
        UserId: { [Op.eq]: candidateId },
        ...(statusParams &&
        statusParams.length > 0 &&
        !statusParams?.map((status) => status.value).includes(3)
          ? {
              status: { [Op.or]: statusParams.map((status) => status.value) },
              archived: false,
            }
          : // special case, for "refus avant/après entretien" (status 3 which goes with 4): include Offer archived by user
            {
              ...(statusParams && statusParams?.length > 0
                ? {
                    [Op.or]: {
                      status: {
                        [Op.or]: statusParams.map((status) => status.value),
                      },
                      archived: true,
                    },
                  }
                : {}),
            }),
        // for "à traiter", specify : bookmarked and recommended if public, all if private
        ...(statusParams?.map((status) => status.value).includes(-1)
          ? {
              [Op.or]: {
                [Op.and]: {
                  [Op.or]: {
                    bookmarked: true,
                    recommended: true,
                  },
                  '$Opportunity.isPublic$': true,
                },
                '$Opportunity.isPublic$': false,
              },
            }
          : {}),
      },
    },
  ];
}

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
        'OpportunityId',
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
