import { Job, RecordResult } from 'jsforce';
import * as _ from 'lodash';
import {
  BusinessSectorFilters,
  BusinessSectorValue,
} from 'src/common/business-sectors/business-sectors.types';
import { BusinessSector } from 'src/common/business-sectors/models';
import { Department, Departments } from 'src/common/locations/locations.types';
import {
  CandidateAccommodation,
  CandidateAdministrativeSituation,
  CandidateGender,
  CandidateHelpWithValue,
  CandidateProfessionalSituation,
  CandidateResource,
  CandidateYesNoNSPPValue,
  CandidateYesNoValue,
  CompanyApproach,
  CompanyZone,
  HeardAboutValue,
  JobSearchDuration,
  Nationality,
  StudiesLevel,
  WorkingExperience,
  YesNoJNSPRValue,
} from 'src/contacts/contacts.types';
import {
  Programs,
  RegistrableUserRole,
  UserRoles,
} from 'src/users/users.types';
import { getZoneSuffixFromDepartment } from 'src/utils/misc';
import { findConstantFromValue } from 'src/utils/misc/findConstantFromValue';
import { AdminZones, AnyCantFix } from 'src/utils/types';
import {
  Casquette,
  ContactProps,
  ContactRecordType,
  LeadAccomodations,
  LeadAdministrativeSituations,
  LeadApproaches,
  LeadBusinessSectors,
  LeadGender,
  LeadHeardAbout,
  LeadHelpWith,
  LeadJobSearchDurations,
  LeadNationalities,
  LeadProfessionalSituation,
  LeadProp,
  LeadRecordType,
  LeadRecordTypesIds,
  LeadResources,
  LeadStudiesLevels,
  LeadWorkingExperienceYears,
  LeadYesNo,
  LeadYesNoJNSPR,
  LeadYesNoNSPP,
  ObjectName,
  SalesforceContact,
  SalesforceLead,
  SalesforceLeads,
  SalesforceObject,
  SalesforceTask,
  TaskProps,
} from './salesforce.types';

export function formatBusinessSectors(businessSectors: BusinessSector[]) {
  if (businessSectors) {
    return _.uniq(
      businessSectors.map(({ name }) => {
        return findConstantFromValue(name, BusinessSectorFilters).label;
      })
    ).join(';');
  }
}

export function formatDepartment(department: Department) {
  if (!department) {
    return 'National';
  }
  return _.capitalize(AdminZones[getZoneSuffixFromDepartment(department)]);
}

export function formatRegions(region: CompanyZone) {
  return _.capitalize(region);
}

export function formatSalesforceValue<T extends string>(
  value: T | T[],
  constants: { [K in T]: string }
) {
  if (value) {
    if (Array.isArray(value)) {
      return value
        .map((val) => {
          return constants[val].toString();
        })
        .join(';');
    }
    return constants[value].toString();
  }
}

export function formatCompanyName(
  name: string,
  address: string,
  department: Department
) {
  return `${name || 'Inconnu'} - ${address || 'Inconnu'} - ${
    department || 'Inconnu'
  }`;
}

export function parseAddress(address: string) {
  if (address) {
    const parsedPostalCode = address.match(/\d{5}/gi);

    if (parsedPostalCode && parsedPostalCode.length > 0) {
      const postalCode = parsedPostalCode[0];
      const parsedAddress = address.split(postalCode);
      return {
        street: parsedAddress[0]?.replace(/,/g, '').trim(),
        city: parsedAddress[1]?.replace(/,/g, '').trim(),
        postalCode: parsedPostalCode[0],
      };
    } else {
      const number = address.match(/\d*,/gi);

      if (number) {
        const parsedStreet = address
          .replace(number[0], number[0]?.replace(/,/g, ''))
          .split(',');

        return {
          street: parsedStreet[0]?.replace(/,/g, '').trim(),
          city: parsedStreet[1]?.replace(/,/g, '').trim(),
        };
      }
      return { street: address.replace(/,/g, '').trim() };
    }
  }
  return {
    street: '',
    city: '',
    postalCode: '',
  };
}

export function getDepartmentFromPostalCode(postalCode: string): Department {
  const deptNumber = postalCode.substring(0, 2);
  const department = Departments.find(({ name }) => {
    return name.includes(`(${deptNumber})`);
  });
  return department.name;
}

export function getPostalCodeFromDepartment(department: Department): string {
  const postalCodeRegex = /\(([^)]+)\)/;
  const postalCodeMatches = postalCodeRegex.exec(department);

  const postalCodeDigits = postalCodeMatches ? postalCodeMatches[1] : '';

  return (
    postalCodeDigits + new Array(5 - postalCodeDigits.length).fill('0').join('')
  );
}

export function mapSalesforceTaskFields({
  externalMessageId,
  binomeSfId,
  subject,
  ownerSfId,
  leadSfId,
  zone,
}: TaskProps): SalesforceTask {
  return {
    ID_Externe__c: externalMessageId,
    ActivityDate: new Date(),
    OwnerId: ownerSfId,
    Status: 'Completed',
    Subject: subject,
    WhoId: leadSfId,
    Bin_me__c: binomeSfId,
    Antenne__c: zone,
  };
}

function isLeadRecordTypeProps<T extends LeadRecordType>(
  recordType: LeadRecordType,
  expectedValue: T,
  props: AnyCantFix
): props is LeadProp<T> {
  return recordType === expectedValue;
}

function isLeadRecordType<T extends LeadRecordType>(
  recordType: LeadRecordType,
  expectedValue: T
): recordType is T {
  return recordType === expectedValue;
}

export function mapSalesforceLeadFields<T extends LeadRecordType>(
  leadProps: LeadProp<T>,
  recordType: AnyCantFix
): SalesforceLeads[T] {
  const { firstName, lastName, email, phone, zone } = leadProps;

  const commonFields = {
    LastName:
      lastName?.length > 80 ? lastName.substring(0, 80) : lastName || 'Inconnu',
    FirstName: firstName,
    Email: email
      ?.replace(/\+/g, '.')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, ''),
    Phone: phone?.length > 40 ? phone.substring(0, 40) : phone,
    Reseaux__c: 'LinkedOut',
    RecordTypeId: recordType,
    Antenne__c: formatRegions(zone),
    Source__c: 'Lead entrant',
  } as Pick<
    SalesforceLead<T>,
    | 'LastName'
    | 'FirstName'
    | 'Email'
    | 'Phone'
    | 'Reseaux__c'
    | 'RecordTypeId'
    | 'Antenne__c'
    | 'Source__c'
  >;

  if (
    isLeadRecordTypeProps(recordType, LeadRecordTypesIds.COMPANY, leadProps) &&
    isLeadRecordType(recordType, LeadRecordTypesIds.COMPANY)
  ) {
    const { company, position, approach, heardAbout, newsletter, message } =
      leadProps;

    return {
      ...commonFields,
      Company: company,
      Title: position,
      Votre_demarche__c: formatSalesforceValue<CompanyApproach>(
        approach,
        LeadApproaches
      ),
      Comment_vous_nous_avez_connu__c: formatSalesforceValue<HeardAboutValue>(
        heardAbout,
        LeadHeardAbout
      ),
      Message_For__c: message,
      Abonnements_Plezi__c: newsletter,
    } as SalesforceLead<T>;
  }

  if (
    isLeadRecordTypeProps(
      recordType,
      LeadRecordTypesIds.ASSOCIATION,
      leadProps
    ) &&
    isLeadRecordType(recordType, LeadRecordTypesIds.ASSOCIATION)
  ) {
    const { company, heardAbout, contactWithCoach, position } = leadProps;

    return {
      ...commonFields,
      Company: company,
      Title: position,
      Comment_vous_nous_avez_connu__c: formatSalesforceValue<HeardAboutValue>(
        heardAbout,
        LeadHeardAbout
      ),
      TS_Mettre_en_relation_Coach__c: contactWithCoach,
    } as SalesforceLead<T>;
  }

  if (
    isLeadRecordTypeProps(
      recordType,
      LeadRecordTypesIds.CANDIDATE,
      leadProps
    ) &&
    isLeadRecordType(recordType, LeadRecordTypesIds.CANDIDATE)
  ) {
    const {
      helpWith,
      gender,
      birthDate,
      address,
      registeredUnemploymentOffice,
      administrativeSituation,
      workingRight,
      accommodation,
      professionalSituation,
      resources,
      domiciliation,
      socialSecurity,
      handicapped,
      bankAccount,
      businessSectors,
      description,
      diagnostic,
      workerSfIdAsProspect,
      workerSfIdAsContact,
      associationSfId,
      autreSource,
      tsPrescripteur,
      heardAbout,
      nationality,
      hasSocialWorker,
      studiesLevel,
      workingExperience,
      jobSearchDuration,
    } = leadProps;

    const parsedAddress = parseAddress(address);

    return {
      ...commonFields,
      Street: parsedAddress?.street,
      City:
        parsedAddress.city?.length > 40
          ? parsedAddress.city.substring(0, 40)
          : parsedAddress.city,
      PostalCode: parsedAddress?.postalCode,
      Genre__c: formatSalesforceValue<CandidateGender>(gender, LeadGender),
      Date_de_naissance__c: birthDate,
      Autre_source_LinkedOut__c: autreSource,
      TS_du_Candidat__c: tsPrescripteur,
      Accompagnement_social__c: formatSalesforceValue<CandidateHelpWithValue>(
        helpWith,
        LeadHelpWith
      ),
      Situation_administrative__c:
        formatSalesforceValue<CandidateAdministrativeSituation>(
          administrativeSituation,
          LeadAdministrativeSituations
        ),
      Situation_Professionnelle__c:
        formatSalesforceValue<CandidateProfessionalSituation>(
          professionalSituation,
          LeadProfessionalSituation
        ),
      Situation_hebergement__c: formatSalesforceValue<CandidateAccommodation>(
        accommodation,
        LeadAccomodations
      ),
      Droit_de_travailler_en_France__c:
        formatSalesforceValue<CandidateYesNoNSPPValue>(
          workingRight,
          LeadYesNoNSPP
        ),
      Inscrit_au_Pole_Emploi__c: formatSalesforceValue<CandidateYesNoValue>(
        registeredUnemploymentOffice,
        LeadYesNo
      ),
      Domiciliation__c: formatSalesforceValue<CandidateYesNoValue>(
        domiciliation,
        LeadYesNo
      ),
      Securite_Sociale__c: formatSalesforceValue<CandidateYesNoValue>(
        socialSecurity,
        LeadYesNo
      ),
      Compte_bancaire__c: formatSalesforceValue<CandidateYesNoValue>(
        bankAccount,
        LeadYesNo
      ),
      RQTH__c: formatSalesforceValue<CandidateYesNoValue>(
        handicapped,
        LeadYesNo
      ),
      Familles_de_m_tiers__c: formatSalesforceValue<BusinessSectorValue>(
        businessSectors,
        LeadBusinessSectors
      ),
      Diagnostic_social_par_le_prescripteur__c: diagnostic,
      Message_For__c: description,
      Type_de_ressources__c: formatSalesforceValue<CandidateResource>(
        resources,
        LeadResources
      ),
      TS_Prescripteur_Contact__c: workerSfIdAsContact,
      Prospect__c: workerSfIdAsProspect,
      Association_prescriptrice__c: associationSfId,
      Company: 'Candidats Entourage Pro',
      Comment_vous_nous_avez_connu__c: formatSalesforceValue<HeardAboutValue>(
        heardAbout,
        LeadHeardAbout
      ),
      Nationalite__c: formatSalesforceValue<Nationality>(
        nationality,
        LeadNationalities
      ),
      Accompagnement_social_O_N__c: formatSalesforceValue<YesNoJNSPRValue>(
        hasSocialWorker,
        LeadYesNoJNSPR
      ),
      Plus_haut_niveau_de_formation_atteint__c:
        formatSalesforceValue<StudiesLevel>(studiesLevel, LeadStudiesLevels),
      annees_d_experiences_professionnelles__c:
        formatSalesforceValue<WorkingExperience>(
          workingExperience,
          LeadWorkingExperienceYears
        ),
      Duree_de_recherche_d_emploi__c: formatSalesforceValue<JobSearchDuration>(
        jobSearchDuration,
        LeadJobSearchDurations
      ),
    } as SalesforceLead<T>;
  }

  if (
    isLeadRecordTypeProps(recordType, LeadRecordTypesIds.COACH, leadProps) &&
    isLeadRecordType(recordType, LeadRecordTypesIds.COACH)
  ) {
    const { company, position } = leadProps;

    return {
      ...commonFields,
      Company: company || 'Coachs Entourage Pro',
      Title: position,
    } as SalesforceLead<T>;
  }
}

export const mapSalesforceContactSocialSituationFields = ({
  nationality,
  accommodation,
  hasSocialWorker,
  resources,
  studiesLevel,
  workingExperience,
  jobSearchDuration,
}: ContactProps): Pick<
  SalesforceContact,
  | 'Nationalit__c'
  | 'Accompagnement_social_O_N__c'
  | 'Plus_haut_niveau_de_formation_attein__c'
  | 'Ann_es_d_exp_rience_professionnelle__c'
  | 'Dur_e_de_recherche_d_emploi__c'
  | 'Situation_d_h_bergement__c'
  | 'Type_de_ressources__c'
> => {
  return {
    Nationalit__c: formatSalesforceValue<Nationality>(
      nationality,
      LeadNationalities
    ),
    Accompagnement_social_O_N__c: formatSalesforceValue<YesNoJNSPRValue>(
      hasSocialWorker,
      LeadYesNoJNSPR
    ),
    Plus_haut_niveau_de_formation_attein__c:
      formatSalesforceValue<StudiesLevel>(studiesLevel, LeadStudiesLevels),
    Ann_es_d_exp_rience_professionnelle__c:
      formatSalesforceValue<WorkingExperience>(
        workingExperience,
        LeadWorkingExperienceYears
      ),
    Dur_e_de_recherche_d_emploi__c: formatSalesforceValue<JobSearchDuration>(
      jobSearchDuration,
      LeadJobSearchDurations
    ),
    Situation_d_h_bergement__c: formatSalesforceValue<CandidateAccommodation>(
      accommodation,
      LeadAccomodations
    ),
    Type_de_ressources__c: formatSalesforceValue<CandidateResource>(
      resources,
      LeadResources
    ),
  };
};

export const mapSalesforceContactFields = (
  {
    id,
    firstName,
    lastName,
    email,
    phone,
    position,
    department,
    companySfId,
    casquettes,
    birthDate,
    nationality,
    accommodation,
    hasSocialWorker,
    resources,
    studiesLevel,
    workingExperience,
    jobSearchDuration,
    gender,
    refererId,
  }: ContactProps,
  recordType: ContactRecordType
): SalesforceContact => {
  const socialSituationFields = mapSalesforceContactSocialSituationFields({
    nationality,
    accommodation,
    hasSocialWorker,
    resources,
    studiesLevel,
    workingExperience,
    jobSearchDuration,
  });

  return {
    LastName:
      lastName?.length > 80 ? lastName.substring(0, 80) : lastName || 'Inconnu',
    FirstName: firstName,
    Email: email
      ?.replace(/\+/g, '.')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, ''),
    Phone: phone?.length > 40 ? phone.substring(0, 40) : phone,
    Title: position,
    AccountId: companySfId,
    Date_de_naissance__c: birthDate,
    Casquettes_r_les__c: casquettes.join(';'),
    Reseaux__c: 'LinkedOut',
    RecordTypeId: recordType,
    Antenne__c: formatDepartment(department),
    MailingPostalCode: getPostalCodeFromDepartment(department),
    ID_App_Entourage_Pro__c: id || '',
    Source__c: 'Lead entrant',
    ...socialSituationFields,
    Genre__c: formatSalesforceValue<CandidateGender>(gender, LeadGender),
    TS_prescripteur__c: refererId,
  };
};

export function executeBulkAction<T extends ObjectName>(
  params: SalesforceObject<T>[],
  job: Job
): Promise<RecordResult[]> {
  return new Promise((res, rej) => {
    const batch = job.createBatch();

    batch.execute(params);

    batch.on('error', (error) => {
      console.error('Error, batchInfo:', error);
      rej(error);
    });
    batch.on('queue', (batchInfo) => {
      // eslint-disable-next-line no-console
      console.log('Queue, batchInfo:', batchInfo);
      batch.poll(1000, 20000);
    });
    batch.on('response', async (results: RecordResult[]) => {
      res(results);
    });
  });
}

export function escapeQuery(query: string) {
  return query ? query.replace(/'/g, "\\'") : query;
}

export function prependDuplicateIfCondition(value: string, condition: boolean) {
  return condition ? `bis_${value}` : value;
}

export function getCasquette(
  role: RegistrableUserRole,
  program: string
): Casquette {
  switch (role) {
    case UserRoles.CANDIDATE:
      return program === Programs.THREE_SIXTY
        ? Casquette.CANDIDAT_360
        : Casquette.CANDIDAT_COUP_DE_POUCE;
    case UserRoles.COACH:
      return program === Programs.THREE_SIXTY
        ? Casquette.COACH_360
        : Casquette.COACH_COUP_DE_POUCE;
    case UserRoles.REFERER:
      return Casquette.PRESCRIPTEUR;
  }
}
