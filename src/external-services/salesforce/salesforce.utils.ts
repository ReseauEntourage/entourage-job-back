import { Job, RecordResult } from 'jsforce';
import * as _ from 'lodash';
import {
  BusinessLineFilters,
  BusinessLineValue,
} from 'src/common/business-lines/business-lines.types';
import { BusinessLine } from 'src/common/business-lines/models';
import { ContractFilters } from 'src/common/contracts/contracts.types';
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
} from 'src/contacts/contacts.types';
import { OpportunityUser } from 'src/opportunities/models';
import {
  EventTypeFilters,
  ExternalOfferOriginFilters,
} from 'src/opportunities/opportunities.types';
import { findOfferStatus } from 'src/opportunities/opportunities.utils';
import { getZoneSuffixFromDepartment } from 'src/utils/misc';
import { findConstantFromValue } from 'src/utils/misc/findConstantFromValue';
import { AdminZones, AnyCantFix } from 'src/utils/types';
import {
  ContactProps,
  ContactRecordType,
  EventPropsWithProcessAndBinomeAndRecruiterId,
  EventRecordTypesIds,
  LeadAccomodations,
  LeadAdministrativeSituations,
  LeadApproaches,
  LeadBusinessLines,
  LeadGender,
  LeadHeardAbout,
  LeadHelpWith,
  LeadProfessionalSituation,
  LeadProp,
  LeadRecordType,
  LeadRecordTypesIds,
  LeadResources,
  LeadYesNo,
  LeadYesNoNSPP,
  ObjectName,
  OfferProps,
  ProcessProps,
  SalesforceContact,
  SalesforceEvent,
  SalesforceLead,
  SalesforceLeads,
  SalesforceObject,
  SalesforceOffer,
  SalesforceProcess,
  SalesforceTask,
  TaskProps,
} from './salesforce.types';

export function formatBusinessLines(businessLines: BusinessLine[]) {
  if (businessLines) {
    return _.uniq(
      businessLines.map(({ name }) => {
        return findConstantFromValue(name, BusinessLineFilters).label;
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

export function mapSalesforceOfferFields({
  id,
  company,
  title,
  businessLines,
  contract,
  isPartTime,
  isPublic,
  isExternal,
  link,
  isValidated,
  isArchived,
  department,
  address,
  workingHours,
  salary,
  message,
  companyDescription,
  description,
  otherInfo,
  driversLicense,
  externalOrigin,
  recruiterFirstName,
  recruiterName,
  recruiterMail,
  recruiterPhone,
  recruiterPosition,
  contactMail,
  date,
  companySfId,
  recruiterSfIdAsContact,
  recruiterSfIdAsProspect,
}: OfferProps): SalesforceOffer {
  const externalOriginConstant = externalOrigin
    ? findConstantFromValue(externalOrigin, ExternalOfferOriginFilters)
    : undefined;

  let name = `${title} - ${formatCompanyName(company, address, department)}`;
  if (name.length > 80) {
    name = name.substring(0, 80);
  }
  return {
    ID__c: id,
    Name: name,
    Titre__c: title.length > 80 ? title.substring(0, 80) : title,
    Entreprise_Recruteuse__c: companySfId,
    Secteur_d_activite_de_l_offre__c: businessLines
      ? formatBusinessLines(businessLines)
      : undefined,
    Type_de_contrat__c: contract
      ? findConstantFromValue(contract, ContractFilters).label
      : 'Autre',
    Temps_partiel__c: isPartTime,
    Offre_publique__c: isPublic,
    Offre_externe__c: isExternal,
    Offre_archivee__c: isArchived,
    Offre_valid_e__c: isValidated,
    Lien_externe__c: link,
    Lien_Offre_Backoffice__c:
      process.env.FRONT_URL + '/backoffice/admin/offres/' + id,
    Departement__c: department || 'Inconnu',
    Adresse_de_l_offre__c: address,
    Jours_et_horaires_de_travail__c:
      workingHours?.length > 100
        ? workingHours.substring(0, 100)
        : workingHours,
    Salaire_et_complement__c:
      salary?.length > 50 ? salary.substring(0, 50) : salary,
    Message_au_candidat__c: message,
    Presentation_de_l_entreprise__c: companyDescription,
    Descriptif_des_missions_proposees__c: description,
    Autre_precision_sur_votre_besoin__c: otherInfo,
    Permis_de_conduire_necessaire__c: driversLicense,
    Source_de_l_offre__c:
      externalOriginConstant?.salesforceLabel || externalOriginConstant?.label,
    Nom__c:
      recruiterName?.length >= 25
        ? recruiterName.substring(0, 25)
        : recruiterName || 'Inconnu',
    Prenom__c: recruiterFirstName || 'Inconnu',
    Mail_du_recruteur__c: recruiterMail
      ? recruiterMail
          .replace(/\+/g, '.')
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
      : 'entreprises@entourage.social',
    Telephone_du_recruteur__c: recruiterPhone,
    Fonction_du_recruteur__c: recruiterPosition,
    Mail_de_contact__c: contactMail
      ?.replace(/\+/g, '.')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, ''),
    Date_de_cr_ation__c: date,
    Prenom_Nom_du_recruteur__c: recruiterSfIdAsContact,
    Prenom_Nom_du_recruteur_Prospect__c: recruiterSfIdAsProspect,
    Contact_cree_existant__c: true,
    Antenne__c: _.capitalize(
      AdminZones[getZoneSuffixFromDepartment(department)]
    ),
  };
}

export function mapSalesforceProcessFields({
  id,
  firstName,
  lastName,
  company,
  isPublic,
  status,
  seen,
  bookmarked,
  archived,
  recommended,
  offerTitle,
  binomeSfId,
  offerSfId,
}: ProcessProps): SalesforceProcess {
  let name = `${firstName} ${lastName} - ${offerTitle || 'Inconnu'} - ${
    company || 'Inconnu'
  }`;
  if (name.length > 80) {
    name = name.substring(0, 80);
  }
  return {
    ID_Externe__c: id,
    Name: name,
    Statut__c: findOfferStatus(status, isPublic, recommended).label,
    Vue__c: seen,
    Favoris__c: bookmarked,
    Archivee__c: archived,
    Recommandee__c: recommended,
    Binome__c: binomeSfId,
    Offre_d_emploi__c: offerSfId,
  };
}

export function mapSalesforceEventFields({
  id,
  processSfId,
  binomeSfId,
  recruiterSfId,
  type,
  department,
  offerTitle,
  candidateFirstName,
  startDate,
}: EventPropsWithProcessAndBinomeAndRecruiterId): SalesforceEvent {
  return {
    WhatId: binomeSfId,
    WhoId: recruiterSfId,
    Antenne__c: _.capitalize(
      AdminZones[getZoneSuffixFromDepartment(department)]
    ),
    ID_Externe__c: id,
    Processus_d_offre__c: processSfId,
    RecordTypeId: EventRecordTypesIds.EVENT,
    Subject: `${
      findConstantFromValue(type, EventTypeFilters).label
    } ${candidateFirstName} x ${offerTitle}`,
    StartDateTime: startDate,
    IsAllDayEvent: true,
  };
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
      businessLines,
      description,
      diagnostic,
      workerSfIdAsProspect,
      workerSfIdAsContact,
      associationSfId,
      autreSource,
      tsPrescripteur,
      heardAbout,
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
      Familles_de_m_tiers__c: formatSalesforceValue<BusinessLineValue>(
        businessLines,
        LeadBusinessLines
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
      Company: 'Candidats LinkedOut',
      Comment_vous_nous_avez_connu__c: formatSalesforceValue<HeardAboutValue>(
        heardAbout,
        LeadHeardAbout
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
      Company: company || 'Coachs LinkedOut',
      Title: position,
    } as SalesforceLead<T>;
  }
}

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
    casquette,
    birthDate,
  }: ContactProps,
  recordType: ContactRecordType
): SalesforceContact => {
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
    Casquettes_r_les__c: casquette,
    Reseaux__c: 'LinkedOut',
    RecordTypeId: recordType,
    Antenne__c: formatDepartment(department),
    MailingPostalCode: getPostalCodeFromDepartment(department),
    ID_App_Entourage_Pro__c: id || '',
    Source__c: 'Lead entrant',
  };
};

export function mapProcessFromOpportunityUser(
  opportunityUsers: OpportunityUser[],
  title: string,
  company: string,
  isPublic: boolean
): ProcessProps[] {
  return opportunityUsers
    .map(({ OpportunityId, UserId, user, ...restProps }) => {
      if (!user) {
        return null;
      }
      return {
        offerTitle: title,
        candidateEmail: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        offerId: OpportunityId,
        company,
        isPublic,
        ...restProps,
      } as ProcessProps;
    })
    .filter((singleProcess) => !!singleProcess);
}

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
