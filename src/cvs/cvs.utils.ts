import { Op } from 'sequelize';
import { BusinessLineFilters } from 'src/common/business-lines/business-lines.types';
import { DepartmentFilters } from 'src/common/locations/locations.types';
import { CVStatuses, EmployedFilters } from 'src/users/users.types';
import { FilterObject } from 'src/utils/types';
import { CVFilterKey, CVOptions } from './cvs.types';
import { CV } from './models';

export function queryConditionCV(
  attribute: CV[keyof CV],
  value: string,
  allowHidden = false
) {
  return `
      SELECT cvs.id
      FROM "CVs" cvs
      inner join (
        select "UserId", MAX(version) as version
        from "CVs"
        where "CVs".status = '${CVStatuses.PUBLISHED.value}'
        group by "UserId") groupCVs
      on cvs."UserId" = groupCVs."UserId"
      and cvs.version =  groupCVs.version
      and cvs.status = '${CVStatuses.PUBLISHED.value}'
      and cvs."deletedAt" IS NULL
      inner join (
        select distinct "candidatId"
        from "User_Candidats"
        where ${allowHidden ? '' : ` hidden = false `}
        ${attribute && value && !allowHidden ? ' and ' : ''}
        ${attribute && value ? ` ${attribute} = '${value}'` : ''}) groupUsers
      on cvs."UserId" = groupUsers."candidatId"
    `;
}

export function getPDFPaths(candidateId: string, queryFileName: string) {
  const fileName = queryFileName
    ? `${queryFileName}_${candidateId.substring(0, 8)}`
    : candidateId;

  return [
    `${candidateId}-page1.pdf`,
    `${candidateId}-page2.pdf`,
    `${fileName.replace(/'/g, '')}.pdf`,
  ];
}

export function getCVOptions(filtersObj: FilterObject<CVFilterKey>): CVOptions {
  let whereOptions = {} as CVOptions;

  if (filtersObj) {
    const keys = Object.keys(filtersObj) as CVFilterKey[];

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
                [Op.or]: filtersObj[keys[i]].reduce((acc, currentFilter) => {
                  if (currentFilter) {
                    if (currentFilter.children) {
                      return [...acc, ...currentFilter.children];
                    }
                    return [...acc, currentFilter.value];
                  }
                  return [...acc];
                }, []),
              },
            };
          }
        }
      }
    }
  }

  return whereOptions;
}

export function getPublishedCVQuery(
  employed?: { [Op.or]: typeof EmployedFilters[number]['value'][] },
  locations?: { [Op.or]: typeof DepartmentFilters[number]['value'][] },
  businessLines?: { [Op.or]: typeof BusinessLineFilters[number]['value'][] }
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
        "CVs".status = '${CVStatuses.PUBLISHED.value}'
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
