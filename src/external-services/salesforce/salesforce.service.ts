import { Injectable } from '@nestjs/common';
import * as jsforce from 'jsforce';
import { Connection, ErrorResult, SuccessResult } from 'jsforce';
import moment from 'moment-timezone';

import { ExternalMessagesService } from 'src/external-messages/external-messages.service';
import { ExternalMessage } from 'src/external-messages/models';
import { Opportunity } from 'src/opportunities/models';
import { OpportunityUserEvent } from 'src/opportunities/models/opportunity-user-event.model';
import { OpportunitiesService } from 'src/opportunities/opportunities.service';
import { OpportunityUsersService } from 'src/opportunities/opportunity-users.service';
import { getZoneFromDepartment } from 'src/utils/misc';
import {
  AccountProps,
  AccountRecordType,
  AccountRecordTypesIds,
  CandidateAndWorkerLeadProps,
  CandidateInscriptionLeadProps,
  CompanyLeadProps,
  ContactProps,
  ContactRecordType,
  ContactRecordTypesIds,
  ErrorCodes,
  EventProps,
  EventPropsWithProcessAndBinomeAndRecruiterId,
  EventRecordTypesIds,
  ExternalMessageProps,
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
  SalesforceCampaign,
  SalesforceCampaignMember,
  SalesforceContact,
  SalesforceError,
  SalesforceEvent,
  SalesforceLead,
  SalesforceObject,
  SalesforceOffer,
  SalesforceProcess,
  SalesforceTask,
  TaskProps,
} from './salesforce.types';

import {
  executeBulkAction,
  formatBusinessLines,
  formatCompanyName,
  formatDepartment,
  getDepartmentFromPostalCode,
  mapProcessFromOpportunityUser,
  mapSalesforceEventFields,
  mapSalesforceLeadFields,
  mapSalesforceOfferFields,
  mapSalesforceProcessFields,
  mapSalesforceTaskFields,
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

  constructor(
    private opportunitiesService: OpportunitiesService,
    private opportunityUsersService: OpportunityUsersService,
    private externalMessagesService: ExternalMessagesService
  ) {}

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
      version: '43.0',
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
        return (err as SalesforceError).duplicateResult.matchResults[0]
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
        return (err as SalesforceError).duplicateResult.matchResults[0]
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
    findIdFunction:
      | 'findProcessById'
      | 'findOfferById'
      | 'findEventById'
      | 'findTaskById'
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
        return (err as SalesforceError).duplicateResult.matchResults[0]
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

  async createOrUpdateEvent(
    params:
      | EventPropsWithProcessAndBinomeAndRecruiterId
      | EventPropsWithProcessAndBinomeAndRecruiterId[]
  ) {
    let records: SalesforceEvent | SalesforceEvent[];
    if (Array.isArray(params)) {
      records = params.map((singleParams) => {
        return mapSalesforceEventFields(singleParams);
      });
    } else {
      records = mapSalesforceEventFields(params);
    }

    return this.upsertRecord(
      ObjectNames.EVENT,
      records,
      'ID_Externe__c',
      'findEventById'
    );
  }

  async createOrUpdateTask(params: TaskProps | TaskProps[]) {
    if (Array.isArray(params)) {
      const records = params.map((singleParams) => {
        return mapSalesforceTaskFields(singleParams);
      });

      return this.upsertRecord(
        ObjectNames.TASK,
        records,
        'ID_Externe__c',
        'findTaskById'
      );
    } else {
      const record = mapSalesforceTaskFields(params);
      try {
        return (await this.upsertRecord(
          ObjectNames.TASK,
          record,
          'ID_Externe__c',
          'findTaskById'
        )) as string;
      } catch (err) {
        if (
          (err as SalesforceError).errorCode ===
          ErrorCodes.CANNOT_UPDATE_CONVERTED_LEAD
        ) {
          return (await this.upsertRecord(
            ObjectNames.TASK,
            { ...record, WhoId: params.contactSfId },
            'ID_Externe__c',
            'findTaskById'
          )) as string;
        }
        console.error(err);
        throw err;
      }
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
      console.error('Error finding Salesforce candidate by mail : ' + email);
      return null;
    }

    const binomeSfId = await this.findBinomeByCandidateSfId(candidateSfId);
    if (!binomeSfId) {
      console.error('Error finding Salesforce binome by mail : ' + email);
      return null;
    }

    return binomeSfId;
  }

  async findContact(email: string, recordType?: ContactRecordType) {
    await this.refreshSalesforceInstance();
    const { records }: { records: Partial<SalesforceContact>[] } =
      await this.salesforce.query(
        `SELECT Id
         FROM ${ObjectNames.CONTACT}
         WHERE Email = '${email}' ${
          recordType ? `AND RecordTypeId = '${recordType}'` : ''
        } LIMIT 1`
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

  async findOwnerByLeadSfId<T extends LeadRecordType>(id: string) {
    await this.refreshSalesforceInstance();
    const { records }: { records: Partial<SalesforceLead<T>>[] } =
      await this.salesforce.query(
        `SELECT OwnerId
         FROM ${ObjectNames.LEAD}
         WHERE Id = '${id}' LIMIT 1
        `
      );
    return records[0]?.OwnerId;
  }

  async findCampaignMember(
    { leadId, contactId }: { leadId?: string; contactId?: string },
    infoCoId: string
  ) {
    await this.refreshSalesforceInstance();
    const { records }: { records: Partial<SalesforceCampaignMember>[] } =
      await this.salesforce.query(
        `SELECT Id
         FROM ${ObjectNames.CAMPAIGN_MEMBER}
         WHERE ${leadId ? `LeadId = '${leadId}'` : `ContactId = '${contactId}'`}
           AND CampaignId = '${infoCoId}' Limit 1`
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

  async findEventById<T>(id: T): Promise<string> {
    await this.refreshSalesforceInstance();
    const { records }: { records: Partial<SalesforceEvent>[] } =
      await this.salesforce.query(
        `SELECT Id
         FROM ${ObjectNames.EVENT}
         WHERE ID_Externe__c = '${id}'
           AND RecordTypeId = '${EventRecordTypesIds.EVENT}' LIMIT 1`
      );
    return records[0]?.Id;
  }

  async findTaskById<T>(id: T): Promise<string> {
    await this.refreshSalesforceInstance();
    const { records }: { records: Partial<SalesforceTask>[] } =
      await this.salesforce.query(
        `SELECT Id
         FROM ${ObjectNames.TASK}
         WHERE ID_Externe__c = '${id}' LIMIT 1`
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
        if (
          (err as SalesforceError).errorCode === ErrorCodes.UNABLE_TO_LOCK_ROW
        ) {
          return (await this.updateLead(
            leadSfIdToUpdate,
            lead,
            recordType
          )) as string;
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

  async findOrCreateLeadFromContactCandidateForm({
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

  async findOrCreateLeadFromInscriptionCandidateForm({
    birthdate,
    email,
    firstName,
    heardAbout,
    infoCo,
    lastName,
    location,
    phone,
    workingRight,
  }: CandidateInscriptionLeadProps) {
    const department = getDepartmentFromPostalCode(location);
    const zone = getZoneFromDepartment(department);

    const leadToCreate = {
      firstName,
      lastName,
      birthDate: birthdate,
      email,
      phone,
      workingRight,
      heardAbout,
      zone,
      autreSource: 'Formulaire_Sourcing_Page_Travailler',
    } as const;

    try {
      const leadId = (await this.createCandidateLead(leadToCreate)) as string;
      if (infoCo) {
        await this.createCampaignMemberInfoCo({ leadId }, infoCo);
        return leadId;
      }
    } catch (err) {
      if (
        (err as SalesforceError).errorCode ===
          ErrorCodes.CANNOT_UPDATE_CONVERTED_LEAD ||
        (err as SalesforceError).errorCode ===
          ErrorCodes.FIELD_INTEGRITY_EXCEPTION
      ) {
        const contactSfId = await this.findContact(email);
        await this.createCampaignMemberInfoCo(
          { contactId: contactSfId },
          infoCo
        );
        return contactSfId;
      }
      console.error(err);
      throw err;
    }
  }

  async findOrCreateCampaignMember(
    leadOrContactId: { leadId?: string; contactId?: string },
    infoCoId: string
  ) {
    try {
      const campaignMemberSfId = await this.findCampaignMember(
        leadOrContactId,
        infoCoId
      );
      const { leadId, contactId } = leadOrContactId;
      if (!campaignMemberSfId) {
        await this.createRecord(ObjectNames.CAMPAIGN_MEMBER, {
          ...(leadId
            ? {
                LeadId: leadId,
              }
            : { ContactId: contactId }),
          CampaignId: infoCoId,
          Status: 'Inscrit',
        });
      }
    } catch (err) {
      if ((err as SalesforceError).errorCode === ErrorCodes.DUPLICATE_VALUE) {
        return;
      }
      console.error(err);
      throw err;
    }
  }

  async createCampaignMemberInfoCo(
    leadOrContactId: { leadId?: string; contactId?: string },
    infoCoId: string
  ) {
    try {
      await this.findOrCreateCampaignMember(leadOrContactId, infoCoId);
    } catch (err) {
      if (
        (err as SalesforceError).errorCode === ErrorCodes.UNABLE_TO_LOCK_ROW
      ) {
        await this.findOrCreateCampaignMember(leadOrContactId, infoCoId);
      }
      console.error(err);
      throw err;
    }
  }

  async createCandidateLead(
    leadToCreate: LeadProp<typeof LeadRecordTypesIds.CANDIDATE>,
    workerSfId?: string
  ) {
    try {
      if (workerSfId)
        leadToCreate = { ...leadToCreate, workerSfIdAsProspect: workerSfId };
      return (await this.findOrCreateLead(
        leadToCreate,
        LeadRecordTypesIds.CANDIDATE
      )) as string;
    } catch (err) {
      if (
        (err as SalesforceError).errorCode ===
        ErrorCodes.FIELD_INTEGRITY_EXCEPTION
      ) {
        if (workerSfId) {
          delete leadToCreate.workerSfIdAsProspect;
          leadToCreate = { ...leadToCreate, workerSfIdAsContact: workerSfId };
        }
        return (await this.findOrCreateLead(
          leadToCreate,
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

  async createOrUpdateSalesforceEvent(event: EventProps | EventProps[]) {
    if (Array.isArray(event)) {
      let eventsToCreate: EventPropsWithProcessAndBinomeAndRecruiterId[] = [];

      for (let i = 0; i < event.length; i += 1) {
        const { processId, candidateMail, recruiterMail, ...restEvent } =
          event[i];

        const processSfId = await this.findProcessById(processId);
        const binomeSfId = await this.findBinomeByCandidateEmail(candidateMail);
        const recruiterSfId = await this.findContact(
          recruiterMail,
          ContactRecordTypesIds.COMPANY
        );

        eventsToCreate = [
          ...eventsToCreate,
          {
            ...restEvent,
            processSfId,
            binomeSfId,
            recruiterSfId,
          },
        ];
      }

      return (await this.createOrUpdateEvent(eventsToCreate)) as string;
    } else {
      const { processId, candidateMail, recruiterMail, ...restEvent } = event;

      const processSfId = await this.findProcessById(processId);
      const binomeSfId = await this.findBinomeByCandidateEmail(candidateMail);
      const recruiterSfId = await this.findContact(
        recruiterMail,
        ContactRecordTypesIds.COMPANY
      );

      return (await this.createOrUpdateEvent({
        ...restEvent,
        processSfId,
        binomeSfId,
        recruiterSfId,
      })) as string;
    }
  }

  async findOrCreateLeadFromExternalMessage({
    firstName,
    lastName,
    email,
    phone,
    zone,
    subject,
    candidateFirstName,
    candidateLastName,
    candidateEmail,
    externalMessageId,
    optInNewsletter,
  }: ExternalMessageProps): Promise<TaskProps> {
    const leadSfId = (await this.findOrCreateLead(
      {
        firstName,
        lastName,
        company: 'NA - Formulaire Contact Candidat',
        email,
        phone,
        zone,
        autreSource: 'Formulaire_Contact_Candidat',
        message: subject,
        newsletter: optInNewsletter ? 'Newsletter LinkedOut' : null,
      },
      LeadRecordTypesIds.COMPANY
    )) as string;

    const binomeSfId = await this.findBinomeByCandidateEmail(candidateEmail);

    const ownerSfId = await this.findOwnerByLeadSfId(leadSfId);

    const contactSfId = await this.findContact(email);

    return {
      binomeSfId,
      externalMessageId,
      ownerSfId,
      leadSfId,
      contactSfId,
      subject: `Message envoyé à ${candidateFirstName} ${candidateLastName} LinkedOut via le site`,
      zone,
    };
  }

  async createOrUpdateSalesforceTask(
    task: ExternalMessageProps | ExternalMessageProps[]
  ) {
    if (Array.isArray(task)) {
      let tasksToCreate: TaskProps[] = [];

      for (let i = 0; i < task.length; i += 1) {
        tasksToCreate = [
          ...tasksToCreate,
          await this.findOrCreateLeadFromExternalMessage(task[i]),
        ];
      }

      return (await this.createOrUpdateTask(tasksToCreate)) as string;
    } else {
      const taskToCreate = await this.findOrCreateLeadFromExternalMessage(task);

      return (await this.createOrUpdateTask(taskToCreate)) as string;
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

  async findEventFromOpportunityUserEventId(
    opportunityUserEventId: string
  ): Promise<EventProps> {
    const opportunityUserEventDb =
      await this.opportunityUsersService.findOneOpportunityUserEventComplete(
        opportunityUserEventId
      );

    const {
      contract,
      opportunityUser,
      ...opportunityUserEvent
    }: OpportunityUserEvent = opportunityUserEventDb.toJSON();

    return {
      ...opportunityUserEvent,
      processId: opportunityUser.id,
      candidateFirstName: opportunityUser.user.firstName,
      candidateMail: opportunityUser.user.email,
      recruiterMail:
        opportunityUser.opportunity.contactMail ||
        opportunityUser.opportunity.recruiterMail,
      offerTitle: opportunityUser.opportunity.title,
      department: opportunityUser.opportunity.department,
    };
  }

  async findTaskFromExternalMessageId(
    externalMessageId: string
  ): Promise<ExternalMessageProps> {
    const externalMessageDb = await this.externalMessagesService.findOne(
      externalMessageId
    );

    const { user, ...externalMessage }: ExternalMessage =
      externalMessageDb.toJSON();

    return {
      candidateEmail: user.email,
      candidateFirstName: user.firstName,
      candidateLastName: user.lastName,
      email: externalMessage.senderEmail,
      externalMessageId: externalMessage.id,
      firstName: externalMessage.senderFirstName,
      lastName: externalMessage.senderLastName,
      phone: externalMessage.senderEmail,
      subject: externalMessage.subject,
      zone: user.zone,
      optInNewsletter: externalMessage.optInNewsletter,
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

  async createOrUpdateSalesforceOpportunityUserEvent(
    opportunityUserEventId: string | string[]
  ) {
    this.setIsWorker(true);

    if (Array.isArray(opportunityUserEventId)) {
      const eventsToCreate = await Promise.all(
        opportunityUserEventId.map((singleOpportunityUserEventId) => {
          return this.findEventFromOpportunityUserEventId(
            singleOpportunityUserEventId
          );
        })
      );
      return this.createOrUpdateSalesforceEvent(eventsToCreate);
    } else {
      const eventToCreate = await this.findEventFromOpportunityUserEventId(
        opportunityUserEventId
      );
      return this.createOrUpdateSalesforceEvent(eventToCreate);
    }
  }

  async createOrUpdateSalesforceExternalMessage(
    externalMessageId: string | string[]
  ) {
    this.setIsWorker(true);

    if (Array.isArray(externalMessageId)) {
      const tasksToCreate = await Promise.all(
        externalMessageId.map((singleExternalMessageId) => {
          return this.findTaskFromExternalMessageId(singleExternalMessageId);
        })
      );
      return this.createOrUpdateSalesforceTask(tasksToCreate);
    } else {
      const taskToCreate = await this.findTaskFromExternalMessageId(
        externalMessageId
      );
      return this.createOrUpdateSalesforceTask(taskToCreate);
    }
  }

  async createOrUpdateCompanySalesforceLead(lead: CompanyLeadProps) {
    this.setIsWorker(false);
    return this.findOrCreateLeadFromCompanyForm(lead);
  }

  async createOrUpdateContactCandidateSalesforceLead(
    lead: CandidateAndWorkerLeadProps
  ) {
    this.setIsWorker(false);
    return this.findOrCreateLeadFromContactCandidateForm(lead);
  }

  async createOrUpdateInscriptionCandidateSalesforceLead(
    lead: CandidateInscriptionLeadProps
  ) {
    this.setIsWorker(false);
    return this.findOrCreateLeadFromInscriptionCandidateForm(lead);
  }

  async getCampaigns() {
    this.setIsWorker(false);
    await this.refreshSalesforceInstance();

    const {
      records: timeZoneRecords,
    }: { records: { TimeZoneSidKey: string }[] } = await this.salesforce.query(
      `SELECT TimeZoneSidKey
       FROM Organization ${
         process.env.SF_ORGANIZATION_ID
           ? `WHERE Id = '${process.env.SF_ORGANIZATION_ID}'`
           : ''
       } LIMIT 1`
    );

    const timeZone = timeZoneRecords[0]?.TimeZoneSidKey;

    const { records }: { records: SalesforceCampaign[] } =
      await this.salesforce.query(
        `SELECT Id,
                Code_postal__c,
                Adresse_de_l_v_nement__c,
                Antenne__c,
                StartDate,
                Heure_de_d_but__c
         FROM ${ObjectNames.CAMPAIGN}
         WHERE ParentId = '${process.env.SF_INFOCO_CAMPAIGN_ID}'
           AND StartDate > TODAY
           AND IsActive = true
           AND Status != 'Aborted'
         ORDER BY StartDate asc`
      );

    // Remove the "Z" behind the time fetched from Salesforce to use it as is and not as UTC
    // Parse it using the timezone from Salesforce to manage DST

    return records.map((record) => {
      return {
        id: record.Id,
        antenne: record.Antenne__c,
        address: record.Adresse_de_l_v_nement__c
          ? `${record.Adresse_de_l_v_nement__c}${
              record.Code_postal__c ? ` ${record.Code_postal__c}` : ''
            }`
          : null,
        time: moment
          .tz(
            `${record.StartDate} ${record.Heure_de_d_but__c.replace('Z', '')}`,
            timeZone
          )
          .format(),
      };
    });
  }
}
