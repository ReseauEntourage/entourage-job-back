import _ from 'lodash';
import { Includeable, WhereOptions } from 'sequelize';
import { Ambition } from 'src/common/ambitions/models';
import { BusinessLine } from 'src/common/business-lines/models';
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

export function getUserProfileBusinessLinesInclude(
  role?: UserRole[],
  businessLinesOptions: WhereOptions<BusinessLine> = {}
) {
  const isBusinessLinesRequired = role && !_.isEmpty(businessLinesOptions);
  const isCandidateBusinessLines =
    isBusinessLinesRequired && isRoleIncluded([UserRoles.CANDIDATE], role);
  const isCoachBusinessLines =
    isBusinessLinesRequired && isRoleIncluded([UserRoles.CANDIDATE], role);

  return [
    {
      model: BusinessLine,
      as: 'searchBusinessLines',
      required: isCandidateBusinessLines,
      attributes: ['id', 'name', 'order'],
      ...(isCandidateBusinessLines ? { where: businessLinesOptions } : {}),
    },
    {
      model: BusinessLine,
      as: 'networkBusinessLines',
      required: isCoachBusinessLines,
      attributes: ['id', 'name', 'order'],
      ...(isCoachBusinessLines ? { where: businessLinesOptions } : {}),
    },
  ];
}

export function getUserProfileAmbitionsInclude() {
  return [
    {
      model: Ambition,
      as: 'searchAmbitions',
      required: false,
      attributes: ['id', 'name', 'prefix', 'order'],
    },
  ];
}

export function getUserProfileInclude(
  role?: UserRole[],
  businessLinesOptions: WhereOptions<BusinessLine> = {},
  helpsOptions: WhereOptions<HelpOffer | HelpNeed> = {}
): Includeable[] {
  return [
    ...getUserProfileAmbitionsInclude(),
    ...getUserProfileBusinessLinesInclude(role, businessLinesOptions),
    ...getUserProfileHelpsInclude(role, helpsOptions),
  ];
}
