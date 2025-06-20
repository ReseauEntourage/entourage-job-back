import _ from 'lodash';
import { Includeable, Op, Order, WhereOptions } from 'sequelize';
import { BusinessSector } from 'src/common/business-sectors/models';
import { Contract } from 'src/common/contracts/models';
import { Experience } from 'src/common/experiences/models';
import { Formation } from 'src/common/formations/models';
import { Interest } from 'src/common/interests/models';
import { Language } from 'src/common/languages/models';
import { Nudge } from 'src/common/nudge/models';
import { Occupation } from 'src/common/occupations/models';
import { Review } from 'src/common/reviews/models';
import { Skill } from 'src/common/skills/models';
import { UserProfileLanguage } from './user-profile-language.model';
import { UserProfileNudge } from './user-profile-nudge.model';
import { UserProfileSectorOccupation } from './user-profile-sector-occupation.model';

export const getUserProfileNudgesInclude = (
  nudgesOptions: WhereOptions<Nudge> = {}
): Includeable[] => {
  const isNudgesRequired = !_.isEmpty(nudgesOptions);

  return [
    {
      model: Nudge,
      as: 'nudges',
      required: isNudgesRequired,
      attributes: ['id', 'value', 'nameRequest', 'nameOffer', 'order'],
      where: nudgesOptions,
      through: {
        attributes: [] as string[],
        as: 'userProfileNudges',
      },
    },
  ];
};

export const getUserProfileCustomNudgesInclude = (): Includeable[] => {
  return [
    {
      model: UserProfileNudge,
      as: 'customNudges',
      attributes: ['id', 'content', 'createdAt'],
      required: false,
      include: [
        {
          model: Nudge,
          as: 'nudge',
          required: false,
          attributes: ['id', 'value', 'nameRequest', 'nameOffer', 'order'],
        },
      ],
    },
  ];
};

export const getUserProfileSectorOccupationsInclude = (
  businessSectorsOptions: WhereOptions<BusinessSector> = {}
): Includeable[] => {
  const isBusinessSectorsRequired = !_.isEmpty(businessSectorsOptions);

  return [
    {
      model: UserProfileSectorOccupation,
      as: 'sectorOccupations',
      required: false,
      attributes: ['id', 'order'],
      include: [
        {
          model: BusinessSector,
          as: 'businessSector',
          required: isBusinessSectorsRequired,
          ...(isBusinessSectorsRequired
            ? { where: businessSectorsOptions }
            : {}),
          attributes: ['id', 'name'],
        },
        {
          model: Occupation,
          as: 'occupation',
          required: false,
          attributes: ['id', 'name'],
        },
      ],
    },
  ];
};

export const getUserProfileLanguagesInclude = (): Includeable[] => [
  {
    model: UserProfileLanguage,
    as: 'userProfileLanguages',
    required: false,
    attributes: ['id', 'level'],
    include: [
      {
        model: Language,
        as: 'language',
        required: false,
        attributes: ['id', 'name'],
      },
    ],
  },
];

export const getUserProfileContractsInclude = (): Includeable[] => [
  {
    model: Contract,
    as: 'contracts',
    required: false,
    attributes: ['id', 'name'],
    through: {
      attributes: ['id'],
      as: 'userProfileContracts',
    },
  },
];

export const getUserProfileSkillsInclude = (): Includeable[] => [
  {
    model: Skill,
    as: 'skills',
    required: false,
    attributes: ['id', 'name', 'order'],
    order: [['order', 'ASC']],
    where: {
      order: {
        [Op.ne]: -1,
      },
    },
  },
];

export const getUserProfileExperiencesInclude = (): Includeable[] => [
  {
    model: Experience,
    as: 'experiences',
    required: false,
    attributes: [
      'id',
      'title',
      'company',
      'description',
      'location',
      'startDate',
      'endDate',
    ],
    order: [['startDate', 'DESC']],
    include: [
      {
        model: Skill,
        as: 'skills',
        required: false,
        attributes: ['id', 'name'],
        through: {
          attributes: ['order'] as string[],
          as: 'experienceSkills',
        },
      },
    ],
  },
];

export const getUserProfileFormationsInclude = (): Includeable[] => [
  {
    model: Formation,
    as: 'formations',
    required: false,
    attributes: [
      'id',
      'title',
      'institution',
      'description',
      'location',
      'startDate',
      'endDate',
    ],
    order: [['startDate', 'DESC']],
    include: [
      {
        model: Skill,
        as: 'skills',
        required: false,
        attributes: ['id', 'name'],
        through: {
          attributes: ['order'] as string[],
          as: 'formationSkills',
        },
      },
    ],
  },
];

export const getUserProfileReviewsInclude = (): Includeable[] => [
  {
    model: Review,
    as: 'reviews',
    required: false,
    attributes: ['id', 'authorName', 'authorLabel', 'content'],
  },
];

export const getUserProfileInterestsInclude = (): Includeable[] => [
  {
    model: Interest,
    as: 'interests',
    required: false,
    attributes: ['id', 'name', 'order'],
    order: [['order', 'ASC']],
  },
];

export const getUserProfileInclude = (
  complete = false,
  businessSectorsOptions: WhereOptions<BusinessSector> = {},
  nudgesOptions: WhereOptions<Nudge> = {}
): Includeable[] => {
  // Always included
  const baseIncludes = [
    ...getUserProfileSectorOccupationsInclude(businessSectorsOptions),
    ...getUserProfileNudgesInclude(nudgesOptions),
  ];

  // Conditionally included based on the complete flag
  const additionalIncludes = [
    ...getUserProfileCustomNudgesInclude(),
    ...getUserProfileLanguagesInclude(),
    ...getUserProfileContractsInclude(),
    ...getUserProfileSkillsInclude(),
    ...getUserProfileExperiencesInclude(),
    ...getUserProfileFormationsInclude(),
    ...getUserProfileReviewsInclude(),
    ...getUserProfileInterestsInclude(),
  ];

  return [...(complete ? additionalIncludes : []), ...baseIncludes];
};

export const getUserProfileOrder = (complete = false): Order => {
  return complete
    ? [
        [{ model: Experience, as: 'experiences' }, 'endDate', 'DESC'],
        [{ model: Experience, as: 'experiences' }, 'startDate', 'ASC'],
        [{ model: Formation, as: 'formations' }, 'endDate', 'DESC'],
        [{ model: Formation, as: 'formations' }, 'startDate', 'ASC'],
        [
          { model: UserProfileSectorOccupation, as: 'sectorOccupations' },
          'order',
          'ASC',
        ],
        [{ model: Nudge, as: 'nudges' }, 'order', 'ASC'],
        [{ model: Skill, as: 'skills' }, 'order', 'ASC'],
        [{ model: Interest, as: 'interests' }, 'order', 'ASC'],
      ]
    : [
        [
          { model: UserProfileSectorOccupation, as: 'sectorOccupations' },
          'order',
          'ASC',
        ],
        [{ model: Nudge, as: 'nudges' }, 'order', 'ASC'],
      ];
};
