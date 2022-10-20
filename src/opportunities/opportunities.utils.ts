import * as _ from 'lodash';
import moment from 'moment';
import { Includeable, Op, WhereOptions } from 'sequelize';
import { firstBy } from 'thenby';

import { BusinessLineFilters } from 'src/common/businessLines/businessLines.types';
import { BusinessLine } from 'src/common/businessLines/models';
import { ContractFilters } from 'src/common/contracts/contracts.types';
import { Opportunity, OpportunityUser } from 'src/opportunities/models';
import {
  getFiltersObjectsFromQueryParams,
  searchInColumnWhereOption,
} from 'src/utils/misc';
import { findConstantFromValue } from 'src/utils/misc/findConstantFromValue';
import { getZoneFromDepartment } from 'src/utils/misc/getZoneFromDepartment';
import { FilterConstant, FilterObject, FilterParams } from 'src/utils/types';
import {
  OfferAdminTab,
  OfferAdminTabs,
  OfferCandidateTab,
  OfferCandidateTabs,
  OfferFilterKey,
  OfferFilters,
  OfferOptions,
  OfferStatus,
  OfferStatusFilters,
  OpportunityRestricted,
} from './opportunities.types';

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
  opportunity: Opportunity | OpportunityRestricted,
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

function getOfferSearchOptions(search: string): { [Op.or]: WhereOptions[] } {
  if (search) {
    return {
      [Op.or]: [
        searchInColumnWhereOption('Opportunity.title', search),
        searchInColumnWhereOption('Opportunity.company', search),
        searchInColumnWhereOption('Opportunity.recruiterName', search),
        searchInColumnWhereOption('Opportunity.recruiterFirstName', search),
        searchInColumnWhereOption('Opportunity.recruiterMail', search),
        searchInColumnWhereOption('Opportunity.recruiterPosition', search),
        searchInColumnWhereOption('Opportunity.recruiterPhone', search),
        searchInColumnWhereOption('Opportunity.description', search),
        searchInColumnWhereOption('Opportunity.companyDescription', search),
        searchInColumnWhereOption('Opportunity.skills', search),
        searchInColumnWhereOption('Opportunity.prerequisites', search),
        searchInColumnWhereOption('Opportunity.contract', search),
        searchInColumnWhereOption('Opportunity.message', search),
        searchInColumnWhereOption('Opportunity.address', search),
        searchInColumnWhereOption('Opportunity.department', search),
        searchInColumnWhereOption('Opportunity.workingHours', search),
        searchInColumnWhereOption('Opportunity.salary', search),
        searchInColumnWhereOption('Opportunity.otherInfo', search),
      ],
    };
  }
  return {} as { [Op.or]: WhereOptions[] };
}

export function getOfferOptions(
  filtersObj: FilterObject<OfferFilterKey>
): OfferOptions {
  let whereOptions = {} as OfferOptions;

  if (filtersObj) {
    const keys = Object.keys(filtersObj) as OfferFilterKey[];

    if (keys.length > 0) {
      const totalFilters = keys.reduce((acc, curr) => {
        return acc + filtersObj[curr].length;
      }, 0);

      if (totalFilters > 0) {
        for (let i = 0; i < keys.length; i += 1) {
          if (filtersObj[keys[i]].length > 0) {
            whereOptions = {
              ...whereOptions,
              [keys[i]]: {
                [Op.or]: filtersObj[keys[i]].map((currentFilter) => {
                  return currentFilter.value;
                }),
              },
            };
          }
        }
      }
    }
  }

  return whereOptions;
}

export function destructureOptionsAndParams(
  params: {
    type?: OfferAdminTab | OfferCandidateTab;
    search: string;
  } & FilterParams<OfferFilterKey>
): {
  typeParams: OfferAdminTab | OfferCandidateTab;
  statusParams: FilterConstant<OfferStatus>[];
  searchOptions: { [Op.or]: WhereOptions[] };
  businessLinesOptions: Includeable;
  filterOptions: Omit<OfferOptions, 'businessLines'>;
} {
  const { search, type: typeParams, ...restParams } = params;

  const filtersObj = getFiltersObjectsFromQueryParams(restParams, OfferFilters);

  const { status: statusParams, ...restFiltersObj } = filtersObj;

  const searchOptions = getOfferSearchOptions(search);
  const filterOptions = getOfferOptions(restFiltersObj);

  const { businessLines: businessLinesOptions, ...restFilterOptions } =
    filterOptions;

  return {
    typeParams,
    statusParams,
    searchOptions,
    businessLinesOptions: {
      model: BusinessLine,
      as: 'businessLines',
      attributes: ['name', 'order'],
      ...(businessLinesOptions
        ? {
            where: {
              name: businessLinesOptions,
            },
          }
        : {}),
    },
    filterOptions: restFilterOptions,
  };
}

export function filterAdminOffersByType(
  offers: Opportunity[],
  type: OfferAdminTab
) {
  let filteredList = offers;
  if (offers) {
    filteredList = filteredList.filter((offer) => {
      switch (type) {
        case OfferAdminTabs.PENDING:
          return !offer.isValidated && !offer.isArchived && !offer.isExternal;
        case OfferAdminTabs.VALIDATED:
          return offer.isValidated && !offer.isArchived && !offer.isExternal;
        case OfferAdminTabs.EXTERNAL:
          return offer.isExternal;
        case OfferAdminTabs.ARCHIVED:
          return offer.isArchived;
        default:
          return true;
      }
    });
  }

  return filteredList;
}

export function filterCandidateOffersByType(
  offers: OpportunityRestricted[],
  type: OfferCandidateTab
) {
  let filteredList = offers;
  if (offers) {
    filteredList = filteredList.filter((offer) => {
      const isArchived =
        offer.opportunityUsers && offer.opportunityUsers.archived;

      switch (type) {
        case OfferCandidateTabs.PRIVATE:
          return !offer.isPublic && !isArchived;
        case OfferCandidateTabs.PUBLIC:
          return offer.isPublic && !isArchived;
        case OfferCandidateTabs.ARCHIVED:
          return isArchived;
        default:
          return true;
      }
    });
  }

  return filteredList;
}

export function getOpportunityUserFromOffer(
  offer: Opportunity,
  candidateId: string
) {
  if (offer.opportunityUsers && Array.isArray(offer.opportunityUsers)) {
    return offer.opportunityUsers.find((userOpp) => {
      return userOpp.UserId === candidateId;
    });
  } else {
    return offer.opportunityUsers;
  }
}

export function filterOffersByStatus(
  offers: Opportunity[],
  status: typeof OfferStatusFilters[number][],
  candidateId?: string
) {
  let filteredList = offers;

  if (offers && status) {
    filteredList = offers.filter((offer) => {
      if (candidateId) {
        const opportunityUser = getOpportunityUserFromOffer(
          offer,
          candidateId
        ) as OpportunityUser;
        return opportunityUser
          ? status.some((currentFilter) => {
              return currentFilter.value === opportunityUser.status;
            })
          : false;
      }
      return status.some((currentFilter) => {
        if (offer.opportunityUsers && offer.opportunityUsers.length > 0) {
          return offer.opportunityUsers.some((userOpp) => {
            return currentFilter.value === userOpp.status;
          });
        }

        return false;
      });
    });
  }

  return filteredList;
}

function sortByUserOpportunity(
  a: Opportunity,
  b: Opportunity,
  candidateId: string,
  key: keyof OpportunityUser
) {
  const opportunityUserA = getOpportunityUserFromOffer(
    a,
    candidateId
  ) as OpportunityUser;
  const opportunityUserB = getOpportunityUserFromOffer(
    b,
    candidateId
  ) as OpportunityUser;
  if (opportunityUserA || opportunityUserB) {
    if (opportunityUserA && opportunityUserB) {
      return opportunityUserB[key] - opportunityUserA[key];
    }
  }
  return 0;
}

export function sortOpportunities(
  opportunities: Opportunity[],
  candidateId: string,
  isPrivate = false
) {
  // Public offers : order by recommended new, then new, then bookmarked, then recommended, then by status, then by date
  // Private offers : order by private new, then public recommended new, then private bookmarked, then public recommended, then by status, then by date
  const sortedOpportunities = [...opportunities];
  sortedOpportunities.sort(
    firstBy('isArchived')
      .thenBy((a: Opportunity, b: Opportunity) => {
        return sortByUserOpportunity(a, b, candidateId, 'archived');
      }, 'desc')
      .thenBy((a: Opportunity, b: Opportunity) => {
        const opportunityUserA = getOpportunityUserFromOffer(
          a,
          candidateId
        ) as OpportunityUser;
        const opportunityUserB = getOpportunityUserFromOffer(
          b,
          candidateId
        ) as OpportunityUser;
        if (opportunityUserA || opportunityUserB) {
          if (opportunityUserA && opportunityUserB) {
            return sortByUserOpportunity(a, b, candidateId, 'seen');
          }
          if (!opportunityUserB) {
            return (isPrivate ? !a.isPublic : a.isPublic) &&
              opportunityUserA.recommended &&
              !opportunityUserA.seen
              ? 1
              : -1;
          }

          if (!opportunityUserA) {
            return (isPrivate ? !b.isPublic : b.isPublic) &&
              opportunityUserB.recommended &&
              !opportunityUserB.seen
              ? -1
              : 1;
          }
        }
        return sortByUserOpportunity(a, b, candidateId, 'seen');
      }, 'desc')
      .thenBy('isPublic')
      .thenBy((a: Opportunity, b: Opportunity) => {
        return sortByUserOpportunity(a, b, candidateId, 'bookmarked');
      })
      .thenBy((a: Opportunity, b: Opportunity) => {
        return sortByUserOpportunity(a, b, candidateId, 'recommended');
      })
      .thenBy((a: Opportunity, b: Opportunity) => {
        return sortByUserOpportunity(a, b, candidateId, 'status');
      })
      .thenBy((a: Opportunity, b: Opportunity) => {
        return moment(b.date).diff(a.date);
      })
  );

  return sortedOpportunities;
}
