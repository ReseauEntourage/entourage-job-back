import { BadRequestException } from '@nestjs/common';
import _ from 'lodash';
import { col, Op, where } from 'sequelize';
import { PayloadUser } from 'src/auth/auth.types';
import { BusinessLineValue } from 'src/common/businessLines/businessLines.types';
import { searchInColumnWhereOption } from 'src/utils/misc';
import { FilterObject } from 'src/utils/types';
import { User } from './models';
import {
  CandidateUserRoles,
  CoachUserRoles,
  CVStatuses,
  ExternalUserRoles,
  MemberFilterKey,
  MemberFilters,
  MemberOptions,
  NormalUserRoles,
  UserRole,
  UserRoles,
} from './users.types';

export function isRoleIncluded(
  superset: Array<UserRole>,
  subset: UserRole | Array<UserRole>
) {
  if (!Array.isArray(subset)) {
    return _.difference([subset], superset).length === 0;
  }
  return _.difference(subset, superset).length === 0;
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
      return [member.candidat.coach];
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
  if (candidate && isRoleIncluded(CandidateUserRoles, candidate.role)) {
    if (candidate.candidat && candidate.candidat.coach) {
      return candidate.candidat.coach;
    }
  }

  return null;
}

export function getCandidateFromCoach(coach: User, candidateId: string) {
  if (coach && isRoleIncluded(CoachUserRoles, coach.role)) {
    if (coach.coaches && coach.coaches.length > 0) {
      return coach.coaches.find(({ candidat }) => {
        return candidat.id === candidateId;
      })?.candidat;
    }
  }

  return null;
}

export function getCandidateIdFromCoachOrCandidate(member: User | PayloadUser) {
  if (member) {
    if (isRoleIncluded(CandidateUserRoles, member.role)) {
      return member.id;
    }

    if (
      isRoleIncluded(CoachUserRoles, member.role) &&
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

export function getMemberOptions(
  filtersObj: FilterObject<MemberFilterKey>
): MemberOptions {
  let whereOptions = {} as MemberOptions;

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
            if (
              keys[i] === MemberFilters[3].key ||
              keys[i] === MemberFilters[4].key
            ) {
              whereOptions = {
                ...whereOptions,
                [keys[i]]: {
                  [Op.or]: filtersObj[keys[i]].map((currentFilter) => {
                    return currentFilter.value;
                  }),
                },
              };
            } else if (keys[i] === MemberFilters[2].key) {
              // These options don't work
              whereOptions = {
                ...whereOptions,
                [keys[i]]: {
                  coach: filtersObj[keys[i]].map((currentFilter) => {
                    return where(
                      col(`coach.candidatId`),
                      currentFilter.value ? Op.is : Op.not,
                      null
                    );
                  }),
                  candidat: filtersObj[keys[i]].map((currentFilter) => {
                    return where(
                      col(`candidat.coachId`),
                      currentFilter.value ? Op.is : Op.not,
                      null
                    );
                  }),
                },
              };
            } else {
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
  }

  return whereOptions;
}

export function filterMembersByCVStatus(
  members: User[],
  status: FilterObject<MemberFilterKey>['cvStatus']
) {
  let filteredList = members;

  if (members && status) {
    filteredList = members.filter((member) => {
      return status.some((currentFilter) => {
        if (member.candidat && member.candidat.cvs.length > 0) {
          return currentFilter.value === member.candidat.cvs[0].status;
        }
        return false;
      });
    });
  }

  return filteredList;
}

export function filterMembersByBusinessLines(
  members: User[],
  businessLines: FilterObject<MemberFilterKey>['businessLines']
) {
  let filteredList = members;

  if (members && businessLines && businessLines.length > 0) {
    filteredList = members.filter((member: User) => {
      return businessLines.some((currentFilter) => {
        if (member.candidat && member.candidat.cvs.length > 0) {
          const cvBusinessLines = member.candidat.cvs[0].businessLines;
          return (
            cvBusinessLines &&
            cvBusinessLines.length > 0 &&
            cvBusinessLines
              .map(({ name }: { name: BusinessLineValue }) => {
                return name;
              })
              .includes(currentFilter.value)
          );
        }
        return false;
      });
    });
  }

  return filteredList;
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

export function generateImageNamesToDelete(prefix: string) {
  const imageNames = Object.keys(CVStatuses).map((status) => {
    return [`${prefix}.${status}.jpg`, `${prefix}.${status}.preview.jpg`];
  });

  return imageNames.reduce((acc, curr) => {
    return [...acc, ...curr];
  }, []);
}

export function getCandidateAndCoachIdDependingOnRoles(
  user: User,
  userToLink: User
) {
  if (
    isRoleIncluded(NormalUserRoles, [user.role, userToLink.role]) &&
    user.role !== userToLink.role
  ) {
    return {
      candidateId: user.role === UserRoles.CANDIDATE ? user.id : userToLink.id,
      coachId: user.role === UserRoles.COACH ? user.id : userToLink.id,
    };
  } else if (
    isRoleIncluded(ExternalUserRoles, [user.role, userToLink.role]) &&
    user.role !== userToLink.role &&
    user.OrganizationId === userToLink.OrganizationId
  ) {
    return {
      candidateId:
        user.role === UserRoles.CANDIDATE_EXTERNAL ? user.id : userToLink.id,
      coachId: user.role === UserRoles.COACH_EXTERNAL ? user.id : userToLink.id,
    };
  } else {
    throw new BadRequestException();
  }
}
