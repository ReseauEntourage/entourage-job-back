import { Includeable, Order, WhereOptions } from 'sequelize';
import { BusinessSector } from 'src/business-sectors/models';
import { Nudge } from 'src/nudge/models';
import { getUserProfileNudgesInclude } from 'src/user-profile-nudges/user-profile-nudges.include';
import { getUserProfileSectorOccupationsInclude } from 'src/user-profile-sector-occupations/user-profile-sector-occupations.include';
import { UserProfileSectorOccupation } from './user-profile-sector-occupation.model';

export { getUserProfileNudgesInclude, getUserProfileSectorOccupationsInclude };

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
