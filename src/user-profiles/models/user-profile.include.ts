import _ from 'lodash';
import { Includeable, WhereOptions } from 'sequelize';
import { Ambition } from 'src/common/ambitions/models';
import { BusinessLine } from 'src/common/business-lines/models';
import {
  CandidateUserRoles,
  CoachUserRoles,
  UserRole,
} from 'src/users/users.types';
import { isRoleIncluded } from 'src/users/users.utils';
import { HelpNeed } from './help-need.model';
import { HelpOffer } from './help-offer.model';

export function getUserProfileInclude(
  role?: UserRole[],
  businessLinesOptions: WhereOptions<BusinessLine> = {},
  helpsOptions: WhereOptions<HelpOffer | HelpNeed> = {}
): Includeable[] {
  const businessLinesRequired = role && !_.isEmpty(businessLinesOptions);
  const isCandidateBusinessLines =
    businessLinesRequired && isRoleIncluded(CandidateUserRoles, role);
  const isCoachBusinessLines =
    businessLinesRequired && isRoleIncluded(CoachUserRoles, role);

  const helpsRequired = role && !_.isEmpty(helpsOptions);
  const isCandidateHelps =
    helpsRequired && isRoleIncluded(CandidateUserRoles, role);
  const isCoachHelps = helpsRequired && isRoleIncluded(CoachUserRoles, role);

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
    {
      model: Ambition,
      as: 'searchAmbitions',
      required: false,
      attributes: ['id', 'name', 'prefix', 'order'],
    },
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
