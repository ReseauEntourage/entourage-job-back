import _ from 'lodash';
import { Includeable, WhereOptions } from 'sequelize';
import { BusinessSector } from 'src/common/business-sectors/models';
import { Contract } from 'src/common/contracts/models';
import { Experience } from 'src/common/experiences/models';
import { Formation } from 'src/common/formations/models';
import { Language } from 'src/common/languages/models';
import { Nudge } from 'src/common/nudge/models';
import { Occupation } from 'src/common/occupations/models';
import { Review } from 'src/common/reviews/models';
import { Skill } from 'src/common/skills/models';
import { UserRole } from 'src/users/users.types';
import { UserProfileNudge } from './user-profile-nudge.model';
import { UserProfileSectorOccupation } from './user-profile-sector-occupation.model';

export const getUserProfileNudgesInclude = (
  nudgesOptions: WhereOptions<Nudge> = {}
) => {
  return [
    {
      model: UserProfileNudge,
      as: 'userProfileNudges',
      attributes: ['id', 'content', 'createdAt'],
      where: nudgesOptions,
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
  role?: UserRole[],
  businessSectorsOptions: WhereOptions<BusinessSector> = {}
) => {
  const isBusinessSectorsRequired = role && !_.isEmpty(businessSectorsOptions);

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
          attributes: ['id', 'name', 'prefix'],
        },
      ],
    },
  ];
};

export const getUserProfileLanguagesInclude = () => [
  {
    model: Language,
    as: 'languages',
    required: false,
    attributes: ['id', 'value'],
    through: {
      attributes: ['id', 'level'],
      as: 'userProfileLanguages',
    },
  },
];

export const getUserProfileContractsInclude = () => [
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

export const getUserProfileSkillsInclude = () => [
  {
    model: Skill,
    as: 'skills',
    required: false,
    attributes: ['id', 'name'],
    through: {
      attributes: ['id', 'order'],
      as: 'userProfileSkills',
    },
  },
];

export const getUserProfileExperiencesInclude = () => [
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
    through: {
      attributes: [] as string[],
      as: 'userProfileExperiences',
    },
  },
];

export const getUserProfileFormationsInclude = () => [
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
    through: {
      attributes: [] as string[],
      as: 'userProfileFormations',
    },
  },
];

export const getUserProfileReviewsInclude = () => [
  {
    model: Review,
    as: 'reviews',
    required: false,
    attributes: ['id', 'authorName', 'authorLabel', 'content'],
  },
];

export const getUserProfileInclude = (
  complete = false,
  role?: UserRole[],
  businessSectorsOptions: WhereOptions<BusinessSector> = {},
  nudgesOptions: WhereOptions<Nudge> = {}
): Includeable[] => {
  const additionalIncludes = [
    ...getUserProfileLanguagesInclude(),
    ...getUserProfileContractsInclude(),
    ...getUserProfileSkillsInclude(),
    ...getUserProfileExperiencesInclude(),
    ...getUserProfileFormationsInclude(),
    ...getUserProfileReviewsInclude(),
  ];

  return [
    ...(complete ? additionalIncludes : []),
    ...getUserProfileSectorOccupationsInclude(role, businessSectorsOptions),
    ...getUserProfileNudgesInclude(nudgesOptions),
  ];
};
