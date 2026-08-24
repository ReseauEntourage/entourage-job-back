import { Includeable, Order, WhereOptions } from 'sequelize';
import { BusinessSector } from 'src/business-sectors/models';
import { ExternalCv } from 'src/external-cvs/models/external-cv.model';
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
    // Only the ids are needed: the DTOs derive `hasExternalCv` from the
    // presence of at least one active link. Skipped when attributes are not
    // requested, because those queries only filter/group on profile ids.
    ...(withAttributes
      ? [
          {
            model: ExternalCv,
            as: 'externalCvs',
            attributes: ['id'],
            required: false,
          },
        ]
      : []),
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
