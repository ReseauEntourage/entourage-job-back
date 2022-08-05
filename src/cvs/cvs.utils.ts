import { BusinessLine } from 'src/businessLines';
import { Location } from 'src/locations';
import { CVStatuses } from './cvs.types';
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
        where "CVs".status = '${CVStatuses.Published.value}'
        group by "UserId") groupCVs
      on cvs."UserId" = groupCVs."UserId"
      and cvs.version =  groupCVs.version
      and cvs.status = '${CVStatuses.Published.value}'
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

export function cleanCV(model: CV) {
  if (!model) {
    return null;
  }
  const tmpCV = model.toJSON();
  /*if (tmpCV.skills) {
    tmpCV.skills = tmpCV.skills.map((o) => {
      return o.name;
    });
  }
  if (tmpCV.contracts) {
    tmpCV.contracts = tmpCV.contracts.map((o) => {
      return o.name;
    });
  }
  if (tmpCV.languages) {
    tmpCV.languages = tmpCV.languages.map((o) => {
      return o.name;
    });
  }
  if (tmpCV.passions) {
    tmpCV.passions = tmpCV.passions.map((o) => {
      return o.name;
    });
  }
  if (tmpCV.ambitions) {
    tmpCV.ambitions = tmpCV.ambitions.map(({ name, order, prefix }) => {
      return { name, order, prefix };
    });
  }*/
  if (tmpCV.businessLines) {
    tmpCV.businessLines = tmpCV.businessLines.map(
      ({ name, order }: BusinessLine) => {
        return { name, order };
      }
    );
  }
  if (tmpCV.locations) {
    tmpCV.locations = tmpCV.locations.map(({ name }: Location) => {
      return name;
    });
  }
  /*if (tmpCV.experiences) {
    tmpCV.experiences = tmpCV.experiences.map((e) => {
      if (e.skills) {
        return {
          ...e,
          skills: e.skills.map(({ name }) => {
            return name;
          }),
        };
      }
      return e;
    });
  }*/
  return tmpCV;
}
