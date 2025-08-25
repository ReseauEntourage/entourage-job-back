import _ from 'lodash';
import { Includeable, Order, WhereOptions } from 'sequelize';
import { BusinessSector } from 'src/common/business-sectors/models';
import { Nudge } from 'src/common/nudge/models';
import { Occupation } from 'src/common/occupations/models';
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

export const getUserProfileSectorOccupationsInclude = (
  businessSectorsOptions: WhereOptions<BusinessSector> = {}
): Includeable[] => {
  const isBusinessSectorsRequired = !_.isEmpty(businessSectorsOptions);

  return [
    {
      model: UserProfileSectorOccupation,
      as: 'sectorOccupations',
      required: isBusinessSectorsRequired,
      attributes: ['id', 'order'],
      include: [
        {
          model: BusinessSector,
          as: 'businessSector',
          required: isBusinessSectorsRequired,
          ...(businessSectorsOptions ? { where: businessSectorsOptions } : {}),
          attributes: ['id', 'name', 'prefixes'],
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

export const getUserProfileInclude = (
  businessSectorsOptions: WhereOptions<BusinessSector> = {},
  nudgesOptions: WhereOptions<Nudge> = {}
): Includeable[] => {
  return [
    ...getUserProfileSectorOccupationsInclude(businessSectorsOptions),
    ...getUserProfileNudgesInclude(nudgesOptions),
  ];
};

export const getUserProfileOrder = (): Order => {
  return [
    [
      { model: UserProfileSectorOccupation, as: 'sectorOccupations' },
      'order',
      'ASC',
    ],
    [{ model: Nudge, as: 'nudges' }, 'order', 'ASC'],
  ];
};
