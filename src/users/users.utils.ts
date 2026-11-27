import _ from 'lodash';
import { Op, WhereOptions } from 'sequelize';
import { BusinessSector } from 'src/business-sectors/models';
import {
  getFiltersObjectsFromQueryParams,
  searchInColumnWhereOption,
  searchInColumnWhereOptionRaw,
  splitSearchTerms,
} from 'src/utils/misc';
import { FilterObject, FilterParams } from 'src/utils/types';
import {
  MemberConstantType,
  MemberFilterKey,
  MemberFilters,
  Permission,
  UserPermissions,
  UserRole,
  UserRoles,
} from './users.types';

export function isRoleIncluded(
  superset: UserRole[],
  subset: UserRole | UserRole[]
) {
  if (!Array.isArray(subset)) {
    return _.difference([subset], superset).length === 0;
  }
  return _.difference(subset, superset).length === 0;
}

export function hasPermission(
  permission: Permission | Permission[],
  role: UserRole
) {
  const userPermission = UserPermissions[role];

  const userPermissionsArray = Array.isArray(userPermission)
    ? userPermission
    : [userPermission];

  const permissionsToCheckArray = Array.isArray(permission)
    ? permission
    : [permission];

  return (
    _.intersection(userPermissionsArray, permissionsToCheckArray).length > 0
  );
}

/**
 * Single predicate for the eLearning gate exemption granted to Entourage
 * staff accounts, reused by every gate touchpoint (messaging, profile,
 * directory/search, AI recommendations).
 */
export function isEntourageAdmin(role: UserRole): boolean {
  return role === UserRoles.ADMIN;
}

export function capitalizeNameAndTrim(name: string) {
  if (!name) {
    // we need to keep its value if its '', null or undefined
    return name;
  }

  let capitalizedName = name
    .toString()
    .toLowerCase()
    .split(' ')
    .map((s) => {
      return s.charAt(0).toUpperCase() + s.substring(1);
    })
    .join(' ');

  capitalizedName = capitalizedName
    .split('-')
    .map((s) => {
      return s.charAt(0).toUpperCase() + s.substring(1);
    })
    .join('-');

  return capitalizedName.trim().replace(/\s\s+/g, ' ');
}

export function getMemberOptions(filtersObj: FilterObject<MemberFilterKey>) {
  let whereOptions: string[] = [];

  if (filtersObj) {
    const keys: MemberFilterKey[] = Object.keys(
      filtersObj
    ) as MemberFilterKey[];

    if (keys.length > 0) {
      const totalFilters = keys.reduce((acc, curr) => {
        return acc + filtersObj[curr].length;
      }, 0);

      if (totalFilters > 0) {
        for (let i = 0; i < keys.length; i += 1) {
          if (filtersObj[keys[i]].length > 0) {
            switch (keys[i]) {
              case 'role':
                whereOptions = [
                  ...whereOptions,
                  `"User"."role" IN (:${keys[i]})`,
                ];
                break;
              case 'zone':
                whereOptions = [
                  ...whereOptions,
                  `"User"."zone" IN (:${keys[i]})`,
                ];
                break;
              // Only candidates
              case 'businessSectorIds':
                whereOptions = [
                  ...whereOptions,
                  `"userProfile->sectorOccupations->businessSectors"."id" IN (:${keys[i]})`,
                ];
                break;
            }
          }
        }
      }
    }
  }

  return whereOptions;
}

/**
 * Multi-word search: each word of the query must match at least one of the
 * searched columns (email, first name, last name and, optionally, the
 * organization name). A single word behaves as a plain substring search.
 */
export function userSearchQuery(
  query = '',
  withOrganizationName = false
): WhereOptions {
  return {
    [Op.and]: splitSearchTerms(query).map((term) => ({
      [Op.or]: [
        searchInColumnWhereOption('User.email', term),
        searchInColumnWhereOption('User.firstName', term),
        searchInColumnWhereOption('User.lastName', term),
        ...(withOrganizationName
          ? [searchInColumnWhereOption('organization.name', term)]
          : []),
      ],
    })),
  };
}

/**
 * Raw SQL equivalent of `userSearchQuery`: one `OR` group per word, joined by
 * `AND`. Every word goes through `escapeQuery` (via
 * `searchInColumnWhereOptionRaw`) before being interpolated.
 */
export function userSearchQueryRaw(query = '', withOrganizationName = false) {
  return `(
    ${splitSearchTerms(query)
      .map(
        (term) => `(
      ${[
        searchInColumnWhereOptionRaw('"User"."email"', term),
        searchInColumnWhereOptionRaw('"User"."firstName"', term),
        searchInColumnWhereOptionRaw('"User"."lastName"', term),
        ...(withOrganizationName
          ? [searchInColumnWhereOptionRaw('"organization"."name"', term)]
          : []),
      ].join(' OR ')}
    )`
      )
      .join(' AND ')}
  )`;
}

export function getCommonMembersFilterOptions(
  params: FilterParams<MemberFilterKey>,
  allBusinessSectors: BusinessSector[]
): {
  filterOptions: string[];
  replacements: FilterParams<MemberFilterKey>;
} {
  const memberFilters = MemberFilters({
    businessSectors: allBusinessSectors,
  });
  const filtersObj = getFiltersObjectsFromQueryParams<
    MemberFilterKey,
    MemberConstantType
  >(params, memberFilters);
  const filterOptions = getMemberOptions(filtersObj);

  const replacements = Object.keys(filtersObj).reduce((acc, curr) => {
    return {
      ...acc,
      [curr]: filtersObj[curr as MemberFilterKey].map(({ value }) => value),
    };
  }, {});

  return { filterOptions, replacements };
}
