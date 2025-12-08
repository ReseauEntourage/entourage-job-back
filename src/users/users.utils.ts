import _ from 'lodash';
import { BusinessSector } from 'src/common/business-sectors/models';
import {
  getFiltersObjectsFromQueryParams,
  searchInColumnWhereOption,
  searchInColumnWhereOptionRaw,
} from 'src/utils/misc';
import { FilterObject, FilterParams } from 'src/utils/types';
import {
  MemberConstantType,
  MemberFilterKey,
  MemberFilters,
  Permission,
  UserPermissions,
  UserRole,
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

export function userSearchQuery(query = '', withOrganizationName = false) {
  const organizationSearchOption = withOrganizationName
    ? [searchInColumnWhereOption('organization.name', query)]
    : [];

  return [
    searchInColumnWhereOption('User.email', query),
    searchInColumnWhereOption('User.firstName', query),
    searchInColumnWhereOption('User.lastName', query),
    ...organizationSearchOption,
  ];
}

export function userSearchQueryRaw(query = '', withOrganizationName = false) {
  const organizationSearchOption = withOrganizationName
    ? [searchInColumnWhereOptionRaw('"organization"."name"', query)]
    : [];

  return `(
    ${[
      searchInColumnWhereOptionRaw('"User"."email"', query),
      searchInColumnWhereOptionRaw('"User"."firstName"', query),
      searchInColumnWhereOptionRaw('"User"."lastName"', query),
      ...organizationSearchOption,
    ].join(' OR ')}
  )`;
}

export function getCommonMembersFilterOptions(
  params: FilterParams<MemberFilterKey>,
  allBusinessSectors: BusinessSector[]
): {
  replacements: FilterParams<MemberFilterKey>;
  filterOptions: string[];
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
