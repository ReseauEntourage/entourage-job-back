import { BadRequestException } from '@nestjs/common';
import _ from 'lodash';
import {
  getFiltersObjectsFromQueryParams,
  searchInColumnWhereOption,
  searchInColumnWhereOptionRaw,
} from 'src/utils/misc';
import { FilterObject, FilterParams } from 'src/utils/types';
import { User } from './models';
import {
  MemberConstantType,
  MemberFilterKey,
  MemberFilters,
  NormalUserRoles,
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

export function generateUrl(user: User) {
  return `${user.firstName.toLowerCase()}-${user.id.substring(0, 8)}`;
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

export function getRelatedUser(member: User) {
  if (member) {
    if (member.candidat && member.candidat.coach) {
      return [member.candidat.coach]; // an array because of the external coaches
    }
    if (member.coaches && member.coaches.length > 0) {
      return member.coaches.map(({ candidat }) => {
        return candidat;
      });
    }
  }

  return null;
}

export function getCoachFromCandidate(candidate: User) {
  if (candidate && candidate.role === UserRoles.CANDIDATE) {
    if (candidate.candidat && candidate.candidat.coach) {
      return candidate.candidat.coach;
    }
  }

  return null;
}

export function getCandidateFromCoach(coach: User, candidateId: string) {
  if (coach && coach.role === UserRoles.COACH) {
    if (coach.coaches && coach.coaches.length > 0) {
      return coach.coaches.find(({ candidat }) => {
        return candidat.id === candidateId;
      })?.candidat;
    }
  }

  return null;
}

export function getCandidateIdFromCoachOrCandidate(member: User) {
  if (member) {
    if (member.role === UserRoles.CANDIDATE) {
      return member.id;
    }
    if (isRoleIncluded([UserRoles.REFERER], member.role)) {
      return member.referredCandidates.map(({ candidat }) => {
        return candidat.candidat.id;
      });
    }

    if (
      isRoleIncluded([UserRoles.COACH], member.role) &&
      member.coaches &&
      member.coaches.length > 0
    ) {
      return member.coaches.map(({ candidat }) => {
        return candidat.id;
      });
    }
  }
  return null;
}

export const formatAssociatedUserMemberOptions = (
  key: string,
  filterValues: FilterObject<MemberFilterKey>['associatedUser']
) => {
  return `(
    ${filterValues
      .map((currentFilterValue) => {
        return `${key} ${currentFilterValue.value ? 'IS NOT NULL' : 'IS NULL'}`;
      })
      .join(' OR ')}
    )`;
};

export function getMemberOptions(filtersObj: FilterObject<MemberFilterKey>) {
  let whereOptions: string[] = [];

  let associatedUserOptionKey: string;
  const rolesFilters = filtersObj.role.map(({ value }) => value);

  if (isRoleIncluded([UserRoles.CANDIDATE], rolesFilters)) {
    associatedUserOptionKey = '"candidat"."coachId"';
  } else if (isRoleIncluded([UserRoles.COACH], rolesFilters)) {
    associatedUserOptionKey = '"coaches"."candidatId"';
  } else if (isRoleIncluded([UserRoles.REFERER], rolesFilters)) {
    associatedUserOptionKey = '"referredCandidates"."candidatId"';
  } else {
    return [];
  }

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
            // TO DO: change switch to mapped object or if else
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
              case 'associatedUser':
                whereOptions = [
                  ...whereOptions,
                  `${formatAssociatedUserMemberOptions(
                    associatedUserOptionKey,
                    filtersObj[keys[i]]
                  )}`,
                ];
                break;
              // Only candidates
              case 'businessSectors':
                whereOptions = [
                  ...whereOptions,
                  `"candidat->businessSectors"."name" IN (:${keys[i]})`,
                ];
                break;
              case 'employed':
                whereOptions = [
                  ...whereOptions,
                  `"candidat"."employed" IN (:${keys[i]})`,
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

// TODO Adapt to use BusinessSectors
export function filterMembersByBusinessLines(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  members: User[],
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  businessSectors: FilterObject<MemberFilterKey>['businessSectors']
) {
  // let filteredList = members;
  // if (members && businessSectors && businessSectors.length > 0) {
  //   filteredList = members.filter((member: User) => {
  //     return businessSectors.some((currentFilter) => {
  //       if (member.candidat && member.candidat.cvs.length > 0) {
  //         const cvBusinessLines = member.candidat.businessSectors;
  //         return (
  //           cvBusinessLines &&
  //           cvBusinessLines.length > 0 &&
  //           cvBusinessLines
  //             .map(({ name }: { name: BusinessLineValue }) => {
  //               return name;
  //             })
  //             .includes(currentFilter.value)
  //         );
  //       }
  //       return false;
  //     });
  //   });
  // }
  // return filteredList;
}

export function filterMembersByAssociatedUser(
  members: User[],
  associatedUsers: FilterObject<MemberFilterKey>['associatedUser']
) {
  let filteredList = members;

  if (members && associatedUsers && associatedUsers.length > 0) {
    filteredList = members.filter((member) => {
      return associatedUsers.some((currentFilter) => {
        const relatedUser = getRelatedUser(member);
        return !_.isEmpty(relatedUser) === currentFilter.value;
      });
    });
  }

  return filteredList;
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

export function getCandidateAndCoachIdDependingOnRoles(
  user: User,
  userToLink: User,
  shouldRemoveLinkedUser = false
) {
  if (
    isRoleIncluded(NormalUserRoles, [user.role, userToLink.role]) &&
    user.role !== userToLink.role
  ) {
    return {
      candidateId: user.role === UserRoles.CANDIDATE ? user.id : userToLink.id,
      coachId: user.role === UserRoles.COACH ? user.id : userToLink.id,
    };
  } else if (shouldRemoveLinkedUser) {
    return {
      candidateId: user.role === UserRoles.CANDIDATE ? user.id : userToLink.id,
      coachId: user.role === UserRoles.COACH ? user.id : userToLink.id,
    };
  } else {
    throw new BadRequestException();
  }
}

export function getCommonMembersFilterOptions(
  params: FilterParams<MemberFilterKey>
): {
  replacements: FilterParams<MemberFilterKey>;
  filterOptions: string[];
} {
  const filtersObj = getFiltersObjectsFromQueryParams<
    MemberFilterKey,
    MemberConstantType
  >(params, MemberFilters);

  const filterOptions = getMemberOptions(filtersObj);

  const replacements = Object.keys(filtersObj).reduce((acc, curr) => {
    return {
      ...acc,
      [curr]: filtersObj[curr as MemberFilterKey].map(({ value }) => value),
    };
  }, {});

  return { filterOptions, replacements };
}
