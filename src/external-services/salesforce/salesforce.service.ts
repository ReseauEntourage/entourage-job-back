import { Injectable } from '@nestjs/common';
import * as jsforce from 'jsforce';
import { Connection, ErrorResult, SuccessResult } from 'jsforce';
import { getZoneFromDepartment } from '../../utils/misc';
import { Opportunity } from 'src/opportunities/models';
import { OpportunitiesService } from 'src/opportunities/opportunities.service';
import {
  AccountProps,
  AccountRecordType,
  AccountRecordTypesIds,
  CandidateAndWorkerLeadProps,
  CompanyLeadProps,
  ContactProps,
  ContactRecordType,
  ContactRecordTypesIds,
  ErrorCodes,
  LeadProp,
  LeadRecordType,
  LeadRecordTypesIds,
  ObjectName,
  ObjectNames,
  OfferAndProcessProps,
  OfferProps,
  OfferPropsWithRecruiterId,
  ProcessProps,
  SalesforceAccount,
  SalesforceBinome,
  SalesforceContact,
  SalesforceError,
  SalesforceLead,
  SalesforceObject,
  SalesforceOffer,
  SalesforceProcess,
} from './salesforce.types';

import {
  executeBulkAction,
  formatBusinessLines,
  formatCompanyName,
  formatDepartment,
  getDepartmentFromPostalCode,
  mapProcessFromOpportunityUser,
  mapSalesforceLeadFields,
  mapSalesforceOfferFields,
  mapSalesforceProcessFields,
  parseAddress,
} from './salesforce.utils';

const RETRY_DELAY = 60 * 10;
const RETRY_NUMBER = 5;

const asyncTimeout = (delay: number) =>
  new Promise<void>((res) => {
    setTimeout(() => {
      res();
    }, delay * 1000);
  });

@Injectable()
export class SalesforceService {
  private salesforce: Connection;
  private isWorker = true;

  constructor(private opportunitiesService: OpportunitiesService) {}

  setIsWorker(isWorker: boolean) {
    this.isWorker = isWorker;
  }

  async loginToSalesforce() {
    this.salesforce = new jsforce.Connection({
      instanceUrl: process.env.SALESFORCE_LOGIN_URL,
      oauth2: {
        loginUrl: process.env.SALESFORCE_LOGIN_URL,
        clientId: process.env.SALESFORCE_CLIENT_ID,
        clientSecret: process.env.SALESFORCE_CLIENT_SECRET,
        redirectUri: process.env.SALESFORCE_REDIRECT_URI,
      },
      maxRequest: 10000,
    });
    return this.salesforce.login(
      process.env.SALESFORCE_USERNAME,
      process.env.SALESFORCE_PASSWORD + process.env.SALESFORCE_SECURITY_TOKEN
    );
  }

  async refreshSalesforceInstance(retries?: number) {
    const remainingRetries = retries || retries === 0 ? retries : RETRY_NUMBER;
    try {
      await this.loginToSalesforce();
    } catch (err) {
      console.error(
        `Error after trying to log in '${(err as SalesforceError).message}'`
      );
      // eslint-disable-next-line no-console
      console.log('Salesforce auth retries', remainingRetries);
      if (this.isWorker && remainingRetries > 0) {
        await asyncTimeout(RETRY_DELAY);
        await this.refreshSalesforceInstance(remainingRetries - 1);
      } else {
        throw err;
      }
    }
  }

  async createRecord<T extends ObjectName, K extends LeadRecordType>(
    name: T,
    params: SalesforceObject<T, K> | SalesforceObject<T, K>[]
  ): Promise<string | string[]> {
    await this.refreshSalesforceInstance();

    try {
      if (Array.isArray(params)) {
        const job = this.salesforce.bulk.createJob(name, 'insert');

        const results = await executeBulkAction<T>(params, job);

        let resultsIds: string[] = [];

        for (let i = 0; i < results.length; i += 1) {
          const { id, success, errors } = results[i] as ErrorResult &
            SuccessResult;
          if (!success) {
            console.error(`Error creating Salesforce records : `, errors);
          } else {
            resultsIds = [...resultsIds, id];
          }
        }

        return resultsIds;
      } else {
        const result = await this.salesforce.sobject(name).insert(params);
        if (!result.success) {
          throw (result as ErrorResult).errors;
        }
        return (result as SuccessResult).id;
      }
    } catch (err) {
      if (
        (err as SalesforceError).errorCode === ErrorCodes.DUPLICATES_DETECTED
      ) {
        return (err as SalesforceError).duplicateResut.matchResults[0]
          .matchRecords[0].record.Id;
      }
      console.error(err);
      throw err;
    }
  }

  async updateRecord<T extends ObjectName, K extends LeadRecordType>(
    name: T,
    params: SalesforceObject<T, K> | SalesforceObject<T, K>[]
  ): Promise<string | string[]> {
    await this.refreshSalesforceInstance();

    try {
      if (Array.isArray(params)) {
        const job = this.salesforce.bulk.createJob(name, 'update');

        const results = await executeBulkAction<T>(params, job);

        let resultsIds: string[] = [];

        for (let i = 0; i < results.length; i += 1) {
          const { id, success, errors } = results[i] as ErrorResult &
            SuccessResult;
          if (!success) {
            console.error(`Error updating Salesforce records : `, errors);
          } else {
            resultsIds = [...resultsIds, id];
          }
        }

        return resultsIds;
      } else {
        const result = await this.salesforce.sobject(name).update(params);
        if (!result.success) {
          throw (result as ErrorResult).errors;
        }
        return (result as SuccessResult).id;
      }
    } catch (err) {
      if (
        (err as SalesforceError).errorCode === ErrorCodes.DUPLICATES_DETECTED
      ) {
        return (err as SalesforceError).duplicateResut.matchResults[0]
          .matchRecords[0].record.Id;
      }
      if (
        (err as SalesforceError).errorCode ===
        ErrorCodes.CANNOT_UPDATE_CONVERTED_LEAD
      ) {
        if (Array.isArray(params)) {
          return params.map(({ Id }) => Id);
        }
        return params.Id;
      }
      console.error(err);
      throw err;
    }
  }

  async upsertRecord<T extends ObjectName>(
    name: T,
    params: SalesforceObject<T> | SalesforceObject<T>[],
    extIdField: keyof SalesforceObject<T>,
    findIdFunction: 'findProcessById' | 'findOfferById'
  ): Promise<string | string[]> {
    await this.refreshSalesforceInstance();

    try {
      if (Array.isArray(params)) {
        const job = this.salesforce.bulk.createJob(name, 'upsert', {
          extIdField: extIdField as string,
        });

        const results = await executeBulkAction<T>(params, job);

        let resultsIds: string[] = [];

        for (let i = 0; i < results.length; i += 1) {
          const { id, success, errors } = results[i] as ErrorResult &
            SuccessResult;
          if (!success) {
            console.error(`Error upserting Salesforce records : `, errors);
          } else {
            resultsIds = [
              ...resultsIds,
              id ||
                (await this[findIdFunction](
                  (params as SalesforceObject<T>[])[i][extIdField]
                )),
            ];
          }
        }

        return resultsIds;
      } else {
        const result = await this.salesforce
          .sobject(name)
          .upsert(params, extIdField as string);
        if (!result.success) {
          throw (result as ErrorResult).errors;
        }
        return (
          (result as SuccessResult).id ||
          (await this[findIdFunction](
            (params as SalesforceObject<T>)[extIdField]
          ))
        );
      }
    } catch (err) {
      if (
        (err as SalesforceError).errorCode === ErrorCodes.DUPLICATES_DETECTED
      ) {
        return (err as SalesforceError).duplicateResut.matchResults[0]
          .matchRecords[0].record.Id;
      }
      console.error(err);
      throw err;
    }
  }

  async createOrUpdateProcess(params: ProcessProps | ProcessProps[]) {
    let records: SalesforceProcess | SalesforceProcess[];
    if (Array.isArray(params)) {
      records = params.map((singleParams) => {
        return mapSalesforceProcessFields(singleParams);
      });
    } else {
      records = mapSalesforceProcessFields(params);
    }
    return this.upsertRecord(
      ObjectNames.PROCESS,
      records,
      'ID_Externe__c',
      'findProcessById'
    );
  }

  async createOrUpdateOffer(params: OfferProps | OfferProps[]) {
    let records: SalesforceOffer | SalesforceOffer[];
    if (Array.isArray(params)) {
      records = params.map((singleParams) => {
        return mapSalesforceOfferFields(singleParams);
      });
    } else {
      records = mapSalesforceOfferFields(params);
    }

    return this.upsertRecord(
      ObjectNames.OFFER,
      records,
      'ID__c',
      'findOfferById'
    );
  }

  async createOrUpdateOfferWithRecruiter(
    offerToCreate: OfferPropsWithRecruiterId | OfferPropsWithRecruiterId[]
  ) {
    let offerWithRecruiterAsContact;
    let offerWithRecruiterAsProspect;
    if (Array.isArray(offerToCreate)) {
      offerWithRecruiterAsContact = offerToCreate.map((singleOffer) => {
        const { recruiterSfId, ...restOffer } = singleOffer;
        return {
          ...restOffer,
          recruiterSfIdAsContact: recruiterSfId,
        };
      });
      offerWithRecruiterAsProspect = offerToCreate.map((singleOffer) => {
        const { recruiterSfId, ...restOffer } = singleOffer;
        return {
          ...restOffer,
          recruiterSfIdAsProspect: recruiterSfId,
        };
      });
    } else {
      const { recruiterSfId, ...restOffer } = offerToCreate;
      offerWithRecruiterAsContact = {
        ...restOffer,
        recruiterSfIdAsContact: recruiterSfId,
      };
      offerWithRecruiterAsProspect = {
        ...restOffer,
        recruiterSfIdAsProspect: recruiterSfId,
      };
    }

    try {
      return (await this.createOrUpdateOffer(
        offerWithRecruiterAsContact
      )) as string;
    } catch (err) {
      if (
        (err as SalesforceError).errorCode ===
        ErrorCodes.FIELD_INTEGRITY_EXCEPTION
      ) {
        return (await this.createOrUpdateOffer(
          offerWithRecruiterAsProspect
        )) as string;
      }
      console.error(err);
      throw err;
    }
  }

  async searchAccountByName(search: string, recordType: AccountRecordType) {
    const escapedSearch = search.replace(/[?&|!{}[\]()^~*:\\"'+-]/gi, '\\$&');
    await this.refreshSalesforceInstance();
    if (escapedSearch.length === 1) {
      const { records }: { records: Partial<SalesforceAccount>[] } =
        await this.salesforce.query(
          `SELECT Id
           FROM ${ObjectNames.ACCOUNT}
           WHERE Name LIKE '${escapedSearch}%'
             AND RecordTypeId = '${recordType}' LIMIT 1`
        );
      return records[0]?.Id;
    }

    const { searchRecords } = await this.salesforce.search(
      `FIND {${escapedSearch}} IN NAME FIELDS RETURNING ${ObjectNames.ACCOUNT}(Id) LIMIT 1`
    );

    return searchRecords[0]?.Id;
  }

  async findBinomeByCandidateEmail(email: string) {
    const candidateSfId = await this.findContact(
      email,
      ContactRecordTypesIds.CANDIDATE
    );
    if (!candidateSfId) {
      return null;
    }
    return this.findBinomeByCandidateSfId(candidateSfId);
  }

  async findContact(email: string, recordType: ContactRecordType) {
    await this.refreshSalesforceInstance();
    const { records }: { records: Partial<SalesforceContact>[] } =
      await this.salesforce.query(
        `SELECT Id
         FROM ${ObjectNames.CONTACT}
         WHERE Email = '${email}'
           AND RecordTypeId = '${recordType}' LIMIT 1`
      );
    return records[0]?.Id;
  }

  async findLead<T extends LeadRecordType>(email: string, recordType: T) {
    await this.refreshSalesforceInstance();
    const { records }: { records: Partial<SalesforceLead<T>>[] } =
      await this.salesforce.query(
        `SELECT Id
         FROM ${ObjectNames.LEAD}
         WHERE Email = '${email}'
           AND RecordTypeId = '${recordType}' LIMIT 1
        `
      );
    return records[0]?.Id;
  }

  async findBinomeByCandidateSfId<T>(id: T) {
    await this.refreshSalesforceInstance();
    const { records }: { records: Partial<SalesforceBinome>[] } =
      await this.salesforce.query(
        `SELECT Id
         FROM ${ObjectNames.BINOME}
         WHERE Candidat_LinkedOut__c = '${id}' LIMIT 1`
      );
    return records[0]?.Id;
  }

  async findOfferById<T>(id: T): Promise<string> {
    await this.refreshSalesforceInstance();
    const { records }: { records: Partial<SalesforceOffer>[] } =
      await this.salesforce.query(
        `SELECT Id
         FROM ${ObjectNames.OFFER}
         WHERE ID__c = '${id}' LIMIT 1`
      );
    return records[0]?.Id;
  }

  async findOfferRelationsById<T>(id: T) {
    await this.refreshSalesforceInstance();
    const { records }: { records: Partial<SalesforceOffer>[] } =
      await this.salesforce.query(
        `SELECT Entreprise_Recruteuse__c, Prenom_Nom_du_recruteur__c
         FROM ${ObjectNames.OFFER}
         WHERE ID__c = '${id}' LIMIT 1`
      );
    return {
      companySfId: records[0]?.Entreprise_Recruteuse__c,
      recruiterSfId: records[0]?.Prenom_Nom_du_recruteur__c,
    };
  }

  async findProcessById<T>(id: T) {
    await this.refreshSalesforceInstance();
    const { records }: { records: Partial<SalesforceProcess>[] } =
      await this.salesforce.query(
        `SELECT Id
         FROM ${ObjectNames.PROCESS}
         WHERE ID_Externe__c = '${id}' LIMIT 1`
      );
    return records[0]?.Id;
  }

  async createAccount(
    { name, businessLines, address, department, mainAccountSfId }: AccountProps,
    recordType: AccountRecordType
  ) {
    const parsedAddress = parseAddress(address);

    return this.createRecord(ObjectNames.ACCOUNT, {
      Name: mainAccountSfId
        ? formatCompanyName(name, address, department)
        : name || 'Inconnu',
      M_tiers_LinkedOut__c: formatBusinessLines(businessLines),
      BillingStreet: parsedAddress.street,
      BillingCity:
        parsedAddress.city?.length > 40
          ? parsedAddress.city.substring(0, 40)
          : parsedAddress.city,
      BillingPostalCode: parsedAddress.postalCode,
      Reseaux__c: 'LinkedOut',
      Antenne__c: formatDepartment(department),
      RecordTypeId: recordType,
      ParentId: mainAccountSfId,
    });
  }

  async createContact(
    {
      firstName,
      lastName,
      email,
      phone,
      position,
      department,
      companySfId,
    }: ContactProps,
    recordType: ContactRecordType
  ) {
    return this.createRecord(ObjectNames.CONTACT, {
      LastName:
        lastName?.length > 80
          ? lastName.substring(0, 80)
          : lastName || 'Inconnu',
      FirstName: firstName,
      Email: email
        ?.replace(/\+/g, '.')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, ''),
      Phone: phone?.length > 40 ? phone.substring(0, 40) : phone,
      Title: position,
      AccountId: companySfId,
      Casquettes_r_les__c: 'Contact Entreprise/Financeur',
      Reseaux__c: 'LinkedOut',
      RecordTypeId: recordType,
      Antenne__c: formatDepartment(department),
      Source__c: 'Lead entrant',
    });
  }

  async updateLead<T extends LeadRecordType>(
    leadSfId: string,
    leadProps: LeadProp<T>,
    recordType: T
  ) {
    const record = mapSalesforceLeadFields(leadProps, recordType);

    return this.updateRecord<typeof ObjectNames.LEAD, T>(ObjectNames.LEAD, {
      Id: leadSfId,
      ...record,
    });
  }

  async createLead<T extends LeadRecordType>(
    leadProps: LeadProp<T>,
    recordType: T
  ) {
    const record = mapSalesforceLeadFields(leadProps, recordType);

    return this.createRecord<typeof ObjectNames.LEAD, T>(
      ObjectNames.LEAD,
      record
    );
  }

  async findOrCreateAccount(
    { name, address, department, businessLines, mainAccountSfId }: AccountProps,
    recordType: AccountRecordType
  ) {
    let companySfId = await this.searchAccountByName(
      formatCompanyName(name, address, department),
      recordType
    );

    if (!companySfId) {
      companySfId = await this.searchAccountByName(
        name || 'Inconnu',
        recordType
      );
    }
    if (!companySfId) {
      companySfId = (await this.createAccount(
        {
          name,
          businessLines,
          address,
          department,
          mainAccountSfId,
        },
        recordType
      )) as string;
    }
    return companySfId;
  }

  async findOrCreateContact(
    {
      contactMail,
      email,
      department,
      mainCompanySfId,
      companySfId,
      firstName,
      lastName,
      phone,
      position,
    }: ContactProps & { contactMail: string; mainCompanySfId: string },
    recordType: ContactRecordType
  ) {
    let recruiterSfId = await this.findContact(
      contactMail || email,
      recordType
    );

    if (!recruiterSfId) {
      recruiterSfId = (await this.createContact(
        contactMail
          ? {
              email: contactMail,
              department,
              companySfId: mainCompanySfId || companySfId,
            }
          : {
              firstName,
              lastName,
              email,
              phone,
              position,
              department,
              companySfId: mainCompanySfId || companySfId,
            },
        recordType
      )) as string;
    }
    return recruiterSfId;
  }

  async findOrCreateLead<T extends LeadRecordType>(
    lead: LeadProp<T>,
    recordType: T
  ) {
    const leadSfId = await this.findLead(lead.email, recordType);

    if (!leadSfId) {
      // Hack : update Lead after creation to set right RecordTypeId because RecordTypeId isn't taken into account when using create
      const leadSfIdToUpdate = (await this.createLead(
        lead,
        recordType
      )) as string;

      try {
        return (await this.updateLead(
          leadSfIdToUpdate,
          lead,
          recordType
        )) as string;
      } catch (err) {
        if ((err as SalesforceError).errorCode === ErrorCodes.NOT_FOUND) {
          return leadSfIdToUpdate;
        }
      }
    }
    return leadSfId;
  }

  async findOrCreateCompanyAndContactFromOffer(
    offer: Partial<OfferProps>,
    mainCompanySfId?: string,
    mainContactSfId?: string
  ) {
    const {
      recruiterMail,
      contactMail,
      recruiterFirstName,
      recruiterName,
      department,
      recruiterPhone,
      recruiterPosition,
      company,
      businessLines,
      address,
    } = offer;

    let { companySfId, recruiterSfId } = await this.findOfferRelationsById(
      offer.id
    );

    if (!companySfId) {
      companySfId = await this.findOrCreateAccount(
        {
          name: company,
          businessLines,
          address,
          department,
          mainAccountSfId: mainCompanySfId,
        },
        AccountRecordTypesIds.COMPANY
      );
    }

    // eslint-disable-next-line no-console
    console.log('Created Salesforce Company', companySfId);

    if (mainContactSfId) {
      recruiterSfId = mainContactSfId;
    } else if (!recruiterSfId) {
      recruiterSfId = (await this.findOrCreateContact(
        {
          firstName: recruiterFirstName,
          lastName: recruiterName,
          email: recruiterMail,
          position: recruiterPosition,
          phone: recruiterPhone,
          contactMail,
          department,
          companySfId,
          mainCompanySfId,
        },
        ContactRecordTypesIds.COMPANY
      )) as string;
    }

    // eslint-disable-next-line no-console
    console.log('Created Salesforce Contact', recruiterSfId);

    return { recruiterSfId, companySfId };
  }

  async findOrCreateLeadFromCompanyForm({
    firstName,
    lastName,
    email,
    phone,
    company,
    position,
    zone,
    approach,
    heardAbout,
  }: CompanyLeadProps) {
    return (await this.findOrCreateLead(
      {
        firstName,
        lastName,
        company,
        position,
        email,
        phone,
        zone,
        approach,
        heardAbout,
      },
      LeadRecordTypesIds.COMPANY
    )) as string;
  }

  async findOrCreateLeadFromCandidateForm({
    workerFirstName,
    workerLastName,
    structure,
    workerPosition,
    workerEmail,
    workerPhone,
    firstName,
    lastName,
    helpWith,
    gender,
    birthDate,
    address,
    postalCode,
    city,
    phone,
    email,
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
    heardAbout,
    diagnostic,
    contactWithCoach,
  }: CandidateAndWorkerLeadProps) {
    const department = getDepartmentFromPostalCode(postalCode);

    const structureAddress = postalCode + ' ' + city;

    const associationSfId = await this.findOrCreateAccount(
      {
        name: structure,
        address: structureAddress,
        department: department,
      },
      AccountRecordTypesIds.ASSOCIATION
    );

    const zone = getZoneFromDepartment(department);

    const workerSfId = (await this.findOrCreateLead(
      {
        firstName: workerFirstName,
        lastName: workerLastName,
        phone: workerPhone,
        email: workerEmail,
        position: workerPosition,
        company: structure,
        zone: zone,
        heardAbout,
        contactWithCoach,
      },
      LeadRecordTypesIds.ASSOCIATION
    )) as string;

    const leadToCreate = {
      firstName,
      lastName,
      helpWith,
      gender,
      birthDate,
      address: address ? address : structureAddress,
      phone,
      email,
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
      zone,
      associationSfId,
    };

    try {
      return (await this.createCandidateLead(
        leadToCreate,
        workerSfId
      )) as string;
    } catch (err) {
      if (
        (err as SalesforceError).errorCode ===
        ErrorCodes.FIELD_FILTER_VALIDATION_EXCEPTION
      ) {
        const { associationSfId, ...restLeadToCreate } = leadToCreate;
        return (await this.createCandidateLead(
          restLeadToCreate,
          workerSfId
        )) as string;
      }
      console.error(err);
      throw err;
    }
  }

  async createCandidateLead(
    leadToCreate: LeadProp<typeof LeadRecordTypesIds.CANDIDATE>,
    workerSfId: string
  ) {
    try {
      return (await this.findOrCreateLead(
        { ...leadToCreate, workerSfIdAsProspect: workerSfId },
        LeadRecordTypesIds.CANDIDATE
      )) as string;
    } catch (err) {
      if (
        (err as SalesforceError).errorCode ===
        ErrorCodes.FIELD_INTEGRITY_EXCEPTION
      ) {
        return (await this.findOrCreateLead(
          { ...leadToCreate, workerSfIdAsContact: workerSfId },
          LeadRecordTypesIds.CANDIDATE
        )) as string;
      }
      console.error(err);
      throw err;
    }
  }

  async getProcessToCreate(
    process: ProcessProps & { candidateEmail?: string },
    offerSfId?: string
  ) {
    const { candidateEmail, offerId, ...restProcess } = process;

    const binomeSfId = await this.findBinomeByCandidateEmail(candidateEmail);
    return {
      ...restProcess,
      binomeSfId,
      offerSfId: offerSfId || (await this.findOfferById(offerId)),
      offerId,
    };
  }

  async createOrUpdateSalesforceProcess(
    process: ProcessProps | ProcessProps[],
    offerSfId?: string
  ) {
    if (Array.isArray(process)) {
      let processesToCreate: ProcessProps[] = [];
      for (let i = 0; i < process.length; i += 1) {
        const processToCreate = await this.getProcessToCreate(
          process[i],
          offerSfId
        );
        processesToCreate = [...processesToCreate, processToCreate];
      }

      return this.createOrUpdateProcess(processesToCreate);
    } else {
      const processToCreate = await this.getProcessToCreate(process, offerSfId);
      return this.createOrUpdateProcess(processToCreate);
    }
  }

  async createOrUpdateSalesforceOffer(
    offerAndProcess: OfferAndProcessProps | OfferAndProcessProps[],
    isSameOffer = false
  ) {
    if (Array.isArray(offerAndProcess)) {
      let mainCompanySfId: string;
      let mainContactSfId: string;
      if (isSameOffer) {
        const {
          recruiterFirstName,
          recruiterName,
          recruiterMail,
          recruiterPhone,
          recruiterPosition,
          company,
          businessLines,
        } = offerAndProcess[0].offer;

        ({ companySfId: mainCompanySfId, recruiterSfId: mainContactSfId } =
          await this.findOrCreateCompanyAndContactFromOffer({
            recruiterFirstName,
            recruiterName,
            recruiterMail,
            recruiterPhone,
            recruiterPosition,
            company,
            businessLines,
          }));
      }
      const offersAndProcessesToCreate: {
        offers: OfferProps[];
        processes: ProcessProps[];
      } = offerAndProcess.reduce(
        (acc, { offer, process }) => {
          return {
            offers: [...acc.offers, offer],
            processes: [...acc.processes, ...process],
          };
        },
        { offers: [], processes: [] }
      );

      let offersToCreate: OfferPropsWithRecruiterId[] = [];
      for (let i = 0; i < offersAndProcessesToCreate.offers.length; i += 1) {
        const offer = offersAndProcessesToCreate.offers[i];
        const { recruiterSfId, companySfId } =
          await this.findOrCreateCompanyAndContactFromOffer(
            offer,
            mainCompanySfId,
            mainContactSfId
          );

        offersToCreate = [
          ...offersToCreate,
          {
            ...offer,
            recruiterSfId,
            companySfId,
          },
        ];
      }

      await this.createOrUpdateOfferWithRecruiter(offersToCreate);

      if (
        offersAndProcessesToCreate.processes &&
        offersAndProcessesToCreate.processes.length > 0
      ) {
        const processToCreate =
          offersAndProcessesToCreate.processes.length === 1
            ? offersAndProcessesToCreate.processes[0]
            : offersAndProcessesToCreate.processes;

        await this.createOrUpdateSalesforceProcess(processToCreate);
      }
    } else {
      const { offer, process } = offerAndProcess;
      const { recruiterSfId, companySfId } =
        await this.findOrCreateCompanyAndContactFromOffer(offer);

      const offerSfId = (await this.createOrUpdateOfferWithRecruiter({
        ...offer,
        recruiterSfId,
        companySfId,
      })) as string;

      if (process && process.length > 0) {
        const processToCreate = process.length === 1 ? process[0] : process;
        await this.createOrUpdateSalesforceProcess(processToCreate, offerSfId);
      }
    }
  }

  async findOfferFromOpportunityId(
    opportunityId: string
  ): Promise<OfferAndProcessProps> {
    const opportunityDb = await this.opportunitiesService.findOne(
      opportunityId
    );

    const { opportunityUsers, ...opportunity }: Opportunity =
      opportunityDb.toJSON();

    return {
      offer: opportunity,
      process: mapProcessFromOpportunityUser(
        opportunityUsers,
        opportunity.title,
        opportunity.company,
        opportunity.isPublic
      ),
    };
  }

  async createOrUpdateSalesforceOpportunity(
    opportunityId: string | string[],
    isSameOpportunity: boolean
  ) {
    this.setIsWorker(true);

    if (Array.isArray(opportunityId)) {
      const offersToCreate = await Promise.all(
        opportunityId.map((singleOpportunityId) => {
          return this.findOfferFromOpportunityId(singleOpportunityId);
        })
      );
      return this.createOrUpdateSalesforceOffer(
        offersToCreate,
        isSameOpportunity
      );
    } else {
      const offerToCreate = await this.findOfferFromOpportunityId(
        opportunityId
      );
      return this.createOrUpdateSalesforceOffer(offerToCreate);
    }
  }

  async createOrUpdateCompanySalesforceLead(lead: CompanyLeadProps) {
    this.setIsWorker(false);
    return this.findOrCreateLeadFromCompanyForm(lead);
  }

  async createOrUpdateCandidateSalesforceLead(
    lead: CandidateAndWorkerLeadProps
  ) {
    this.setIsWorker(false);
    return this.findOrCreateLeadFromCandidateForm(lead);
  }
}
