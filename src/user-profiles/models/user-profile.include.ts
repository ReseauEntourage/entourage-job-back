import _ from 'lodash';
import { Includeable, WhereOptions } from 'sequelize';
import { BusinessSector } from 'src/common/business-sectors/models';
import { Contract } from 'src/common/contracts/models';
import { Experience } from 'src/common/experiences/models';
import { Formation } from 'src/common/formations/models';
import { Language } from 'src/common/languages/models';
import { Occupation } from 'src/common/occupations/models';
import { Review } from 'src/common/reviews/models';
import { Skill } from 'src/common/skills/models';
import { UserRole, UserRoles } from 'src/users/users.types';
import { isRoleIncluded } from 'src/users/users.utils';
import { HelpNeed } from './help-need.model';
import { HelpOffer } from './help-offer.model';

export function getUserProfileHelpsInclude(
  role?: UserRole[],
  helpsOptions: WhereOptions<HelpOffer | HelpNeed> = {}
) {
  const isHelpsRequired = role && !_.isEmpty(helpsOptions);
  const isCandidateHelps =
    isHelpsRequired && isRoleIncluded([UserRoles.CANDIDATE], role);
  const isCoachHelps =
    isHelpsRequired && isRoleIncluded([UserRoles.COACH], role);

  return [
    {
      model: HelpNeed,
      as: 'helpNeeds',
      required: isCandidateHelps,
      attributes: ['id', 'name'],
      ...(isCandidateHelps ? { where: helpsOptions } : {}),
    },
    {
      model: HelpOffer,
      as: 'helpOffers',
      required: isCoachHelps,
      attributes: ['id', 'name'],
      ...(isCoachHelps ? { where: helpsOptions } : {}),
    },
  ];
}

export function getUserProfileBusinessSectorsInclude(
  role?: UserRole[],
  businessSectorsOptions: WhereOptions<BusinessSector> = {}
) {
  const isBusinessSectorsRequired = role && !_.isEmpty(businessSectorsOptions);
  return [
    {
      model: BusinessSector,
      as: 'businessSectors',
      required: isBusinessSectorsRequired,
      attributes: ['id', 'name'],
      ...(isBusinessSectorsRequired ? { where: businessSectorsOptions } : {}),
      through: {
        attributes: ['id'],
        as: 'userProfileBusinessSectors',
      },
    },
  ];
}

export function getUserProfileOccupationsInclude() {
  return [
    {
      model: Occupation,
      as: 'occupations',
      required: false,
      attributes: ['id', 'name', 'prefix'],
      through: {
        attributes: ['id'],
        as: 'userProfileOccupations',
      },
    },
  ];
}

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

export function getUserProfileInclude(
  role?: UserRole[],
  businessSectorsOptions: WhereOptions<BusinessSector> = {},
  helpsOptions: WhereOptions<HelpOffer | HelpNeed> = {}
): Includeable[] {
  return [
    ...getUserProfileOccupationsInclude(),
    ...getUserProfileBusinessSectorsInclude(role, businessSectorsOptions),
    ...getUserProfileHelpsInclude(role, helpsOptions),
    ...getUserProfileLanguagesInclude(),
    ...getUserProfileContractsInclude(),
    ...getUserProfileSkillsInclude(),
    ...getUserProfileExperiencesInclude(),
    ...getUserProfileFormationsInclude(),
    ...getUserProfileReviewsInclude(),
  ];
}
