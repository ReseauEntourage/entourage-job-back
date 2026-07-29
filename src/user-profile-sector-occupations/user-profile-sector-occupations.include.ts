import _ from 'lodash';
import { Includeable, WhereOptions } from 'sequelize';
import { BusinessSector } from 'src/business-sectors/models';
import { Occupation } from 'src/occupations/models';
import { UserProfileSectorOccupation } from 'src/user-profiles/models';

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
