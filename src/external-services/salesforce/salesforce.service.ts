import { Injectable } from '@nestjs/common';
import * as jsforce from 'jsforce';
import { Connection, ErrorResult, SuccessResult } from 'jsforce';
import moment from 'moment-timezone';

import { CandidateYesNoNSPPValue } from 'src/contacts/contacts.types';
import { MessagesService } from 'src/messages/messages.service';
import { ExternalMessage } from 'src/messages/models';
import { Opportunity } from 'src/opportunities/models';
import { OpportunityUserEvent } from 'src/opportunities/models/opportunity-user-event.model';
import { OpportunitiesService } from 'src/opportunities/opportunities.service';
import { OpportunityUsersService } from 'src/opportunities/opportunity-users.service';
import { UsersService } from 'src/users/users.service';
import { NormalUserRole, Program, Programs } from 'src/users/users.types';
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
  ContactRecordTypeFromRole,
  ContactRecordTypesIds,
  ErrorCodes,
  EventProps,
  EventPropsWithProcessAndBinomeAndRecruiterId,
  EventRecordTypesIds,
  ExternalMessageProps,
  LeadProp,
  LeadRecordType,
  LeadRecordTypeFromRole,
  LeadRecordTypesIds,
  ObjectName,
  ObjectNames,
  OfferAndProcessProps,
  OfferProps,
  OfferPropsWithRecruiterId,
  ProcessProps,
  ProgramString,
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
  UserProps,
} from './salesforce.types';

import {
  escapeQuery,
  executeBulkAction,
  formatBusinessLines,
  formatCompanyName,
  formatDepartment,
  getDepartmentFromPostalCode,
  getPostalCodeFromDepartment,
  mapProcessFromOpportunityUser,
  mapSalesforceContactFields,
  mapSalesforceEventFields,
  mapSalesforceLeadFields,
  mapSalesforceOfferFields,
  mapSalesforceProcessFields,
  mapSalesforceTaskFields,
  parseAddress,
  prependDuplicateIfCondition,
} from './salesforce.utils';

const RETRY_DELAY = 60 * 10;
const RETRY_NUMBER = 5;

const REGEX_ESCAPE = /[?&|!{}[\]()^~*:\\"'+-]/gi;

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
    private messagesService: MessagesService,
    private usersService: UsersService
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

  async checkIfConnected() {
    try {
      await this.salesforce
        .sobject(ObjectNames.USER)
        .find({ Email: process.env.SALESFORCE_USERNAME });
    } catch (error) {
      await this.refreshSalesforceInstance();
    }
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
    await this.checkIfConnected();

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
    params: Partial<SalesforceObject<T, K> | SalesforceObject<T, K>[]>
  ): Promise<string | string[]> {
    await this.checkIfConnected();

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
    await this.checkIfConnected();

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
    const escapedSearch = search.replace(REGEX_ESCAPE, '\\$&');
    await this.checkIfConnected();
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

  async searchAccount(search: string) {
    const escapedSearch = search.replace(REGEX_ESCAPE, '\\$&');
    await this.checkIfConnected();

    const { searchRecords } = await this.salesforce.search(
      `FIND {${escapedSearch}} RETURNING ${ObjectNames.ACCOUNT}(Id) LIMIT 1`
    );

    return searchRecords[0]?.Id;
  }

  async findBinomeByCandidateEmail(email: string) {
    const candidateSf = await this.findContact(email);

    if (!candidateSf) {
      console.error('Error finding Salesforce candidate by mail : ' + email);
      return null;
    }

    const binomeSfId = await this.findBinomeByCandidateSfId(candidateSf.Id);
    if (!binomeSfId) {
      console.error('Error finding Salesforce binome by mail : ' + email);
      return null;
    }

    return binomeSfId;
  }

  async findContact(
    email: string,
    recordType?: ContactRecordType
  ): Promise<{ Id: string; Casquettes_r_les__c: string } | null> {
    await this.checkIfConnected();
    const { records }: { records: Partial<SalesforceContact>[] } =
      await this.salesforce.query(
        `SELECT Id, Casquettes_r_les__c, AccountId
         FROM ${ObjectNames.CONTACT}
         WHERE Email = '${email}' ${
          recordType ? `AND RecordTypeId = '${recordType}'` : ''
        } LIMIT 1`
      );
    return records[0]
      ? {
          Id: records[0]?.Id,
          Casquettes_r_les__c: records[0]?.Casquettes_r_les__c,
        }
      : null;
  }

  async findLead<T extends LeadRecordType>(email: string, recordType?: T) {
    await this.checkIfConnected();
    const { records }: { records: Partial<SalesforceLead<T>>[] } =
      await this.salesforce.query(
        `SELECT Id
         FROM ${ObjectNames.LEAD}
         WHERE Email = '${escapeQuery(email)}' ${
          recordType ? `AND RecordTypeId = '${recordType}'` : ''
        } LIMIT 1
        `
      );
    return records[0]?.Id;
  }

  async findOwnerByLeadSfId<T extends LeadRecordType>(id: string) {
    await this.checkIfConnected();
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
    campaignId: string
  ) {
    await this.checkIfConnected();
    const { records }: { records: Partial<SalesforceCampaignMember>[] } =
      await this.salesforce.query(
        `SELECT Id
         FROM ${ObjectNames.CAMPAIGN_MEMBER}
         WHERE ${leadId ? `LeadId = '${leadId}'` : `ContactId = '${contactId}'`}
           AND CampaignId = '${escapeQuery(campaignId)}' Limit 1`
      );
    return records[0]?.Id;
  }

  async findBinomeByCandidateSfId<T extends string>(id: T) {
    await this.checkIfConnected();
    const { records }: { records: Partial<SalesforceBinome>[] } =
      await this.salesforce.query(
        `SELECT Id
         FROM ${ObjectNames.BINOME}
         WHERE Candidat_LinkedOut__c = '${id}' LIMIT 1`
      );
    return records[0]?.Id;
  }

  async findOfferById<T extends string>(id: T): Promise<string> {
    await this.checkIfConnected();
    const { records }: { records: Partial<SalesforceOffer>[] } =
      await this.salesforce.query(
        `SELECT Id
         FROM ${ObjectNames.OFFER}
         WHERE ID__c = '${id}' LIMIT 1`
      );
    return records[0]?.Id;
  }

  async findEventById<T extends string>(id: T): Promise<string> {
    await this.checkIfConnected();
    const { records }: { records: Partial<SalesforceEvent>[] } =
      await this.salesforce.query(
        `SELECT Id
         FROM ${ObjectNames.EVENT}
         WHERE ID_Externe__c = '${id}'
           AND RecordTypeId = '${EventRecordTypesIds.EVENT}' LIMIT 1`
      );
    return records[0]?.Id;
  }

  async findTaskById<T extends string>(id: T): Promise<string> {
    await this.checkIfConnected();
    const { records }: { records: Partial<SalesforceTask>[] } =
      await this.salesforce.query(
        `SELECT Id
         FROM ${ObjectNames.TASK}
         WHERE ID_Externe__c = '${id}' LIMIT 1`
      );
    return records[0]?.Id;
  }

  async findOfferRelationsById<T extends string>(id: T) {
    await this.checkIfConnected();
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

  async findProcessById<T extends string>(id: T) {
    await this.checkIfConnected();
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

  async updateLeadPhone<T extends LeadRecordType>(
    leadSfId: string,
    leadProps: Pick<LeadProp<T>, 'phone'>
  ) {
    return this.updateRecord(ObjectNames.LEAD, {
      Id: leadSfId,
      Phone: leadProps.phone,
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

  async updateContact(
    contactSfId: string,
    contactProps: ContactProps,
    recordType: ContactRecordType
  ) {
    const record = mapSalesforceContactFields(contactProps, recordType);
    return this.updateRecord(ObjectNames.CONTACT, {
      Id: contactSfId,
      ...record,
    });
  }

  async updateContactCasquetteAndAppId(
    contactSfId: string,
    contactProps: Pick<ContactProps, 'casquette' | 'id'>
  ) {
    return this.updateRecord(ObjectNames.CONTACT, {
      Id: contactSfId,
      ID_App_Entourage_Pro__c: contactProps.id,
      Casquettes_r_les__c: contactProps.casquette,
    });
  }

  async updateContactEmailAndPhone(
    contactSfId: string,
    contactProps: Pick<ContactProps, 'email' | 'phone'>
  ) {
    return this.updateRecord(ObjectNames.CONTACT, {
      Id: contactSfId,
      Email: contactProps.email,
      Phone: contactProps.phone,
    });
  }

  async createContact(
    contactProps: ContactProps,
    recordType: ContactRecordType
  ) {
    const record = mapSalesforceContactFields(contactProps, recordType);

    // Hack : update Contact after creation to set right RecordTypeId because RecordTypeId isn't taken into account when using create
    const contactSfIdToUpdate = (await this.createRecord(
      ObjectNames.CONTACT,
      record
    )) as string;

    try {
      return (await this.updateContact(
        contactSfIdToUpdate,
        contactProps,
        recordType
      )) as string;
    } catch (err) {
      if ((err as SalesforceError).errorCode === ErrorCodes.NOT_FOUND) {
        return contactSfIdToUpdate;
      }
      if (
        (err as SalesforceError).errorCode === ErrorCodes.UNABLE_TO_LOCK_ROW
      ) {
        // eslint-disable-next-line no-console
        console.log('LOCK ROW IN createContact');
        return (await this.updateContact(
          contactSfIdToUpdate,
          contactProps,
          recordType
        )) as string;
      }
    }
  }

  async findOrCreateHouseholdAccount({
    name,
    department,
    address,
  }: AccountProps) {
    let companySfId = await this.searchAccount(`${name} ${address}`);

    if (!companySfId) {
      companySfId = (await this.createAccount(
        {
          name,
          department,
          address,
        },
        AccountRecordTypesIds.HOUSEHOLD
      )) as string;
    }
    return companySfId;
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

  async findOrCreateCompanyContact(
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
    const recruiterSf = await this.findContact(
      contactMail || email,
      recordType
    );
    let recruiterSfId = recruiterSf?.Id;

    if (!recruiterSfId) {
      recruiterSfId = (await this.createContact(
        contactMail
          ? {
              email: contactMail,
              department,
              companySfId: mainCompanySfId || companySfId,
              casquette: 'Contact Entreprise/Financeur',
            }
          : {
              firstName,
              lastName,
              email,
              phone,
              position,
              department,
              companySfId: mainCompanySfId || companySfId,
              casquette: 'Contact Entreprise/Financeur',
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
          // eslint-disable-next-line no-console
          console.log('LOCK ROW IN findOrCreateLead');
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
      recruiterSfId = (await this.findOrCreateCompanyContact(
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
          casquette: 'Contact Entreprise/Financeur',
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
    message,
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
        message,
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
    tsPrescripteur,
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
      tsPrescripteur,
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
    department,
    phone,
    workingRight,
    tsPrescripteur,
  }: CandidateInscriptionLeadProps) {
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
      tsPrescripteur,
      autreSource: 'Formulaire_Sourcing_Page_Travailler',
    } as const;

    try {
      const leadId = (await this.createCandidateLead(leadToCreate)) as string;
      if (infoCo) {
        await this.addLeadOrContactToCampaign({ leadId }, infoCo);
        return leadId;
      }
    } catch (err) {
      if (
        (err as SalesforceError).errorCode ===
          ErrorCodes.CANNOT_UPDATE_CONVERTED_LEAD ||
        (err as SalesforceError).errorCode ===
          ErrorCodes.FIELD_INTEGRITY_EXCEPTION
      ) {
        const contactSf = await this.findContact(email);
        const contactSfId = contactSf?.Id;
        await this.addLeadOrContactToCampaign(
          { contactId: contactSfId },
          infoCo
        );
        return contactSfId;
      }
      console.error(err);
      throw err;
    }
  }

  async findOrCreateContactFromUserRegistrationForm({
    id,
    firstName,
    lastName,
    email,
    phone,
    department,
    role,
    birthDate,
    program,
    campaign,
  }: UserProps) {
    let leadSfId = await this.findLead(email);
    const contactSf = await this.findContact(email);
    let contactSfId = contactSf?.Id;

    if (program === Programs.LONG) {
      if (leadSfId) {
        await this.updateLeadPhone(leadSfId, { phone: phone });
      } else {
        const leadToCreate = {
          id,
          firstName,
          lastName,
          birthDate,
          email,
          phone,
          department,
          zone: getZoneFromDepartment(department),
        };

        if (contactSfId) {
          // Hack to have a contact with the same mail and phone as the prospect if it exists
          await this.updateContactEmailAndPhone(contactSfId, {
            email: prependDuplicateIfCondition(email, true),
            phone: prependDuplicateIfCondition(phone, true),
          });
        }

        leadSfId = (await this.createLead(
          leadToCreate,
          LeadRecordTypeFromRole[role]
        )) as string;

        if (contactSfId) {
          // Hack to have a contact with the same mail and phone as the prospect if it exists
          await this.updateContactEmailAndPhone(contactSfId, {
            email: email,
            phone: phone,
          });
        }
      }

      if (campaign) {
        await this.addLeadOrContactToCampaign({ leadId: leadSfId }, campaign);
      }
    }

    const programString: ProgramString =
      program === Programs.LONG
        ? `PRO ${role} 360`
        : `PRO ${role} Coup de pouce`;

    if (!contactSfId) {
      const companySfId = await this.findOrCreateHouseholdAccount({
        name: `${firstName} ${lastName} Foyer`,
        department,
        address: getPostalCodeFromDepartment(department),
      });

      const contactToCreate = {
        id,
        firstName,
        lastName,
        birthDate,
        // Hack to have a contact with the same mail and phone as the prospect if it exists
        email: prependDuplicateIfCondition(email, !!leadSfId),
        phone: prependDuplicateIfCondition(phone, !!leadSfId),
        department,
        companySfId,
      };

      contactSfId = (await this.createContact(
        {
          ...contactToCreate,
          casquette: programString,
        },
        ContactRecordTypeFromRole[role]
      )) as string;

      if (leadSfId) {
        // Hack to have a contact with the same mail and phone as the prospect if it exists
        await this.updateContactEmailAndPhone(contactSfId, { email, phone });
      }
    } else {
      await this.updateContactCasquetteAndAppId(contactSfId, {
        id,
        casquette: `${programString};${(
          contactSf.Casquettes_r_les__c || ''
        ).replace(programString, '')}`,
      });
    }

    return contactSfId;
  }

  async findOrCreateCampaignMember(
    leadOrContactId: { leadId?: string; contactId?: string },
    campaignId: string
  ) {
    try {
      const campaignMemberSfId = await this.findCampaignMember(
        leadOrContactId,
        campaignId
      );
      const { leadId, contactId } = leadOrContactId;
      if (!campaignMemberSfId) {
        await this.createRecord(ObjectNames.CAMPAIGN_MEMBER, {
          ...(leadId
            ? {
                LeadId: leadId,
              }
            : { ContactId: contactId }),
          CampaignId: campaignId,
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

  async addLeadOrContactToCampaign(
    leadOrContactId: { leadId?: string; contactId?: string },
    campaignId: string
  ) {
    try {
      await this.findOrCreateCampaignMember(leadOrContactId, campaignId);
    } catch (err) {
      if (
        (err as SalesforceError).errorCode === ErrorCodes.UNABLE_TO_LOCK_ROW
      ) {
        // eslint-disable-next-line no-console
        console.log('LOCK ROW IN createCampaignMemberInfoCo');
        await this.findOrCreateCampaignMember(leadOrContactId, campaignId);
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
        const recruiterSf = await this.findContact(
          recruiterMail,
          ContactRecordTypesIds.COMPANY
        );

        const recruiterSfId = recruiterSf?.Id;

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
      const recruiterSf = await this.findContact(
        recruiterMail,
        ContactRecordTypesIds.COMPANY
      );
      const recruiterSfId = recruiterSf?.Id;

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

    const contactSf = await this.findContact(email);
    const contactSfId = contactSf?.Id;

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
    const externalMessageDb = await this.messagesService.findOneExternalMessage(
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

  async findContactFromUserId(
    userId: string
  ): Promise<
    Pick<
      UserProps,
      | 'id'
      | 'firstName'
      | 'lastName'
      | 'email'
      | 'phone'
      | 'department'
      | 'role'
    >
  > {
    const userDb = await this.usersService.findOne(userId);

    return {
      id: userDb.id,
      firstName: userDb.firstName,
      lastName: userDb.lastName,
      email: userDb.email,
      phone: userDb.phone,
      department: userDb.userProfile.department,
      role: userDb.role as NormalUserRole,
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

  async createOrUpdateSalesforceUser(
    userId: string,
    otherInfo: {
      program: Program;
      birthDate: Date;
      campaign?: string;
      workingRight?: CandidateYesNoNSPPValue;
    }
  ) {
    this.setIsWorker(true);

    const userToCreate = await this.findContactFromUserId(userId);

    return this.findOrCreateContactFromUserRegistrationForm({
      ...userToCreate,
      birthDate: otherInfo.birthDate,
      campaign: otherInfo.campaign,
      workingRight: otherInfo.workingRight,
      program: otherInfo.program,
    });
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

  async getCandidateCampaigns() {
    this.setIsWorker(false);
    await this.checkIfConnected();

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
            `${record.StartDate} ${record.Heure_de_d_but__c?.replace('Z', '')}`,
            timeZone
          )
          .format(),
      };
    });
  }

  async getCoachCampaigns() {
    this.setIsWorker(false);
    await this.checkIfConnected();

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
                StartDate,
                Heure_de_d_but__c
         FROM ${ObjectNames.CAMPAIGN}
         WHERE ParentId = '${process.env.SF_WEBINAIRE_COACH_CAMPAIGN_ID}'
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
        time: moment
          .tz(
            `${record.StartDate} ${record.Heure_de_d_but__c?.replace('Z', '')}`,
            timeZone
          )
          .format(),
      };
    });
  }
}
