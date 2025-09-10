import _ from 'lodash';
import { Includeable, Order, WhereOptions } from 'sequelize';
import { BusinessSector } from 'src/common/business-sectors/models';
import { Nudge } from 'src/common/nudge/models';
import { Occupation } from 'src/common/occupations/models';
import { UserProfileSectorOccupation } from './user-profile-sector-occupation.model';

export const getUserProfileNudgesInclude = (
  nudgesOptions: WhereOptions<Nudge> = {},
  withAttributes = true
): Includeable[] => {
  const isNudgesRequired = !_.isEmpty(nudgesOptions);

  return [
    {
      model: Nudge,
      as: 'nudges',
      required: isNudgesRequired,
      attributes: withAttributes
        ? ['id', 'value', 'nameRequest', 'nameOffer', 'order']
        : [],
      where: nudgesOptions,
      through: {
        attributes: [] as string[],
        as: 'userProfileNudges',
      },
    },
  ];
};

export const getUserProfileSectorOccupationsInclude = (
  businessSectorsOptions: WhereOptions<BusinessSector> = {},
  withAttributes = true
): Includeable[] => {
  const isBusinessSectorsRequired = !_.isEmpty(businessSectorsOptions);

  return [
    {
      model: UserProfileSectorOccupation,
      as: 'sectorOccupations',
      required: isBusinessSectorsRequired,
      attributes: withAttributes ? ['id', 'order'] : [],
      include: [
        {
          model: BusinessSector,
          as: 'businessSector',
          required: isBusinessSectorsRequired,
          ...(businessSectorsOptions ? { where: businessSectorsOptions } : {}),
          attributes: withAttributes ? ['id', 'name', 'prefixes'] : [],
        },
        {
          model: Occupation,
          as: 'occupation',
          required: false,
          attributes: withAttributes ? ['id', 'name'] : [],
        },
      ],
    },
  ];
};

export const getUserProfileInclude = (
  businessSectorsOptions: WhereOptions<BusinessSector> = {},
  nudgesOptions: WhereOptions<Nudge> = {},
  withAttributes = true
): Includeable[] => {
  return [
    ...getUserProfileSectorOccupationsInclude(
      businessSectorsOptions,
      withAttributes
    ),
    ...getUserProfileNudgesInclude(nudgesOptions, withAttributes),
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
