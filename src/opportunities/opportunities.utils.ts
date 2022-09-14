import * as _ from 'lodash';
import { BusinessLineFilters } from 'src/businessLines/businessLines.types';
import { ContractFilters } from 'src/contracts/contracts.types';
import { Opportunity } from 'src/opportunities/models';
import { findConstantFromValue } from 'src/utils/misc/findConstantFromValue';
import { getZoneFromDepartment } from 'src/utils/misc/getZoneFromDepartment';
import { OfferStatus, OfferStatusFilters } from './opportunities.types';

export function findOfferStatus(
  status: OfferStatus,
  isPublic = false,
  isRecommended = false
) {
  const currentStatus = OfferStatusFilters.find((offerStatus) => {
    return offerStatus.value === status;
  });
  if (currentStatus) {
    if (isPublic) {
      if (isRecommended && currentStatus.recommended) {
        return {
          label: currentStatus.recommended,
          value: currentStatus.value,
          color: currentStatus.color,
        };
      }
      if (currentStatus.public) {
        return {
          label: currentStatus.public,
          value: currentStatus.value,
          color: currentStatus.color,
        };
      }
    }
    return {
      label: currentStatus.label,
      value: currentStatus.value,
      color: currentStatus.color,
    };
  }
  return { label: 'Non défini', color: 'muted' };
}

export function getMailjetVariablesForPrivateOrPublicOffer(
  opportunity: Opportunity,
  status?: OfferStatus,
  getCandidates = true
): object {
  const commonMailjetVariables = _.omitBy(
    {
      ...opportunity,
      zone: getZoneFromDepartment(opportunity.department),
      contract: findConstantFromValue(opportunity.contract, ContractFilters)
        .label,
      status: status ? findOfferStatus(status).label : '',
      businessLines: opportunity.businessLines
        ?.map(({ name }) => {
          return findConstantFromValue(name, BusinessLineFilters).label;
        })
        .join(', '),
    },
    _.isNil
  );

  if (!opportunity.isPublic && getCandidates) {
    const listOfNames = opportunity.opportunityUsers.map((candidate) => {
      return candidate.user.firstName;
    });

    let stringOfNames = '';
    if (listOfNames.length === 0) {
      stringOfNames = 'Le candidat';
    } else {
      stringOfNames =
        listOfNames.length > 1
          ? `${listOfNames.slice(0, -1).join(', ')} et ${listOfNames.slice(-1)}`
          : listOfNames[0];
    }

    return {
      ...commonMailjetVariables,
      candidates: stringOfNames,
      candidatesLength: opportunity.opportunityUsers.length,
    };
  }
  return commonMailjetVariables;
}
