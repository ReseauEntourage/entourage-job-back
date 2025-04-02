import _ from 'lodash';
import { Includeable, WhereOptions } from 'sequelize';
import { BusinessSector } from 'src/common/businessSectors/models';
import { Occupation } from 'src/common/occupations/models';
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
      attributes: ['id', 'value', 'order'],
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

export function getUserProfileInclude(
  role?: UserRole[],
  businessSectorsOptions: WhereOptions<BusinessSector> = {},
  helpsOptions: WhereOptions<HelpOffer | HelpNeed> = {}
): Includeable[] {
  return [
    ...getUserProfileOccupationsInclude(),
    ...getUserProfileBusinessSectorsInclude(role, businessSectorsOptions),
    ...getUserProfileHelpsInclude(role, helpsOptions),
  ];
}
