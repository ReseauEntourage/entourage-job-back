import { col, Op, where, WhereOptions } from 'sequelize';
import { BusinessLineValue } from 'src/businessLines';
import { CVStatuses } from 'src/cvs';
import { Department } from 'src/locations';
import { searchInColumnWhereOption } from 'src/utils/misc';
import { FilterObject } from 'src/utils/types';
import { User } from './user.model';
import { MemberFilterKey, MemberFilters, UserRoles } from './user.types';

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
      return member.candidat.coach;
    }
    if (member.coach && member.coach.candidat) {
      return member.coach.candidat;
    }
  }

  return null;
}

export function getCandidateFromCoachOrCandidate(member: User) {
  if (member) {
    if (member.role === UserRoles.CANDIDAT) {
      return member.candidat;
    }

    if (member.role === UserRoles.COACH) {
      return member.coach;
    }
  }
  return null;
}

type MemberOptions = Partial<Record<MemberFilterKey, WhereOptions<User>>>;

export function getMemberOptions(
  filtersObj: FilterObject<MemberFilterKey>
): MemberOptions {
  let whereOptions: MemberOptions = {};

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
        const candidate = getCandidateFromCoachOrCandidate(member);
        const relatedUser = getRelatedUser(member);
        if (!candidate) {
          return !currentFilter.value;
        }
        return !!relatedUser === currentFilter.value;
      });
    });
  }

  return filteredList;
}

export function userSearchQuery(query = '') {
  return [
    searchInColumnWhereOption('User.email', query),
    searchInColumnWhereOption('User.firstName', query),
    searchInColumnWhereOption('User.lastName', query),
  ];
}

export function getPublishedCVQuery(
  employed?: { [Op.or]: boolean[] },
  locations?: { [Op.or]: Department[] },
  businessLines?: { [Op.or]: BusinessLineValue[] }
) {
  const hasLocations = locations && locations[Op.or];
  const hasBusinessLines = businessLines && businessLines[Op.or];
  return `
    /* CV par recherche */

    with groupCVs as (
      select
        /* pour chaque user, dernier CV publiés */
        "UserId", MAX(version) as version, "employed"
      from
        "User_Candidats",
        "CVs"
        ${
          hasLocations
            ? `
              ,
              "CV_Locations",
              "Locations"
            `
            : ''
        }
        ${
          hasBusinessLines
            ? `
              ,
              "CV_BusinessLines",
              "BusinessLines"
            `
            : ''
        }
      where
        "CVs".status = '${CVStatuses.Published.value}'
        and "CVs"."deletedAt" IS NULL
        and "User_Candidats"."candidatId" = "CVs"."UserId"
        and "User_Candidats".hidden = false
        ${
          employed && employed[Op.or]
            ? `and (${employed[Op.or]
                .map((value, index) => {
                  return `${
                    index > 0 ? 'or ' : ''
                  }"User_Candidats".employed = ${value}`;
                })
                .join(' ')})`
            : ''
        }
        ${
          hasLocations
            ? `and "CV_Locations"."CVId" = "CVs".id and "CV_Locations"."LocationId" = "Locations".id`
            : ''
        }
        ${
          hasBusinessLines
            ? `and "CV_BusinessLines"."CVId" = "CVs".id and "CV_BusinessLines"."BusinessLineId" = "BusinessLines".id`
            : ''
        }
        ${
          hasLocations
            ? `and (${locations[Op.or]
                .map((value, index) => {
                  return `${
                    index > 0 ? 'or ' : ''
                  }"Locations".name = '${value}'`;
                })
                .join(' ')})`
            : ''
        }
        ${
          hasBusinessLines
            ? `and (${businessLines[Op.or]
                .map((value, index) => {
                  return `${
                    index > 0 ? 'or ' : ''
                  }"BusinessLines".name = '${value}'`;
                })
                .join(' ')})`
            : ''
        }
      group by
        "UserId", "employed")

    select
      cvs.id, cvs."UserId", groupCVs."employed"
    from
      "CVs" cvs
    inner join groupCVs on
      cvs."UserId" = groupCVs."UserId"
      and cvs.version = groupCVs.version
    `;
}
