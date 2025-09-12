import { Injectable } from '@nestjs/common';
import * as jsforce from 'jsforce';
import { Connection, ErrorResult, SuccessResult } from 'jsforce';
import moment from 'moment-timezone';

import {
  CandidateAccommodation,
  CandidateGender,
  CandidateResource,
  CandidateYesNoNSPPValue,
  JobSearchDuration,
  Nationality,
  StudiesLevel,
  WorkingExperience,
  YesNoJNSPRValue,
} from 'src/contacts/contacts.types';
import { MessagesService } from 'src/messages/messages.service';
import { ExternalMessage } from 'src/messages/models';
import { UsersService } from 'src/users/users.service';
import { RegistrableUserRole, UserRoles } from 'src/users/users.types';
import {
  AccountProps,
  AccountRecordType,
  AccountRecordTypesIds,
  CompanyLeadProps,
  ContactProps,
  ContactRecordType,
  ContactRecordTypeFromRole,
  ErrorCodes,
  ExternalMessageProps,
  LeadProp,
  LeadRecordType,
  LeadRecordTypesIds,
  ObjectName,
  ObjectNames,
  Casquette,
  SalesforceAccount,
  SalesforceBinome,
  SalesforceCampaign,
  SalesforceCampaignMember,
  SalesforceError,
  SalesforceLead,
  SalesforceObject,
  SalesforceTask,
  TaskProps,
  UserProps,
} from './salesforce.types';

import {
  escapeQuery,
  executeBulkAction,
  formatBusinessSectors,
  formatCompanyName,
  formatDepartment,
  getCasquette,
  getPostalCodeFromDepartment,
  mapSalesforceContactFields,
  mapSalesforceContactSocialSituationFields,
  mapSalesforceLeadFields,
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
    findIdFunction: 'findTaskById'
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
  ): Promise<{ Id: string; Casquettes_r_les__c: Casquette[] } | null> {
    await this.checkIfConnected();
    const sfEmail = email
      .replace(/\+/g, '.')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const {
      records,
    }: { records: { Id: string; Casquettes_r_les__c: string }[] } =
      await this.salesforce.query(
        `SELECT Id, Casquettes_r_les__c, AccountId
         FROM ${ObjectNames.CONTACT}
         WHERE Email = '${sfEmail}' ${
          recordType ? `AND RecordTypeId = '${recordType}'` : ''
        } LIMIT 1`
      );
    return records[0]
      ? {
          Id: records[0]?.Id,
          Casquettes_r_les__c: ((records[0]?.Casquettes_r_les__c).split(';') ||
            []) as Casquette[],
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

  async createAccount(
    {
      name,
      businessSectors,
      address,
      department,
      mainAccountSfId,
    }: AccountProps,
    recordType: AccountRecordType
  ) {
    const parsedAddress = parseAddress(address);

    return this.createRecord(ObjectNames.ACCOUNT, {
      Name: mainAccountSfId
        ? formatCompanyName(name, address, department)
        : name || 'Inconnu',
      M_tiers_LinkedOut__c: formatBusinessSectors(businessSectors),
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

  async updateLeadPhoneAndRecordType<T extends LeadRecordType>(
    leadSfId: string,
    leadProps: Pick<LeadProp<T>, 'phone'>,
    recordType: T
  ) {
    return this.updateRecord(ObjectNames.LEAD, {
      Id: leadSfId,
      Phone: leadProps.phone,
      RecordTypeId: recordType,
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

  async updateContactSocialSituation(
    contactSfId: string,
    contactProps: Pick<
      ContactProps,
      | 'nationality'
      | 'accommodation'
      | 'hasSocialWorker'
      | 'resources'
      | 'studiesLevel'
      | 'workingExperience'
      | 'jobSearchDuration'
    >
  ) {
    const socialSituationSfFields =
      mapSalesforceContactSocialSituationFields(contactProps);
    return this.updateRecord(ObjectNames.CONTACT, {
      Id: contactSfId,
      ...socialSituationSfFields,
    });
  }

  async updateContactCasquetteAndAppId(
    contactSfId: string,
    contactProps: Pick<ContactProps, 'casquettes' | 'id'>
  ) {
    return this.updateRecord(ObjectNames.CONTACT, {
      Id: contactSfId,
      ID_App_Entourage_Pro__c: contactProps.id,
      Casquettes_r_les__c: contactProps.casquettes.join(';'),
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

  async findOrCreateAssociationAccount({
    name,
    address,
    department,
  }: AccountProps) {
    let companySfId = await this.searchAccount(name);

    if (!companySfId) {
      companySfId = (await this.createAccount(
        {
          name,
          address: address,
          department: department,
        },
        AccountRecordTypesIds.ASSOCIATION
      )) as string;
    }
    return companySfId;
  }

  async findOrCreateAccount(
    {
      name,
      address,
      department,
      businessSectors,
      mainAccountSfId,
    }: AccountProps,
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
          businessSectors,
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
              casquettes: [Casquette.CONTACT_ENTREPRISE_FINANCEUR],
            }
          : {
              firstName,
              lastName,
              email,
              phone,
              position,
              department,
              companySfId: mainCompanySfId || companySfId,
              casquettes: [Casquette.CONTACT_ENTREPRISE_FINANCEUR],
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
    const leadSfId = await this.findLead(lead.email);

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

  async findOrCreateContactFromUserRegistrationForm({
    id,
    firstName,
    lastName,
    email,
    phone,
    department,
    role,
    birthDate,
    nationality,
    accommodation,
    hasSocialWorker,
    resources,
    studiesLevel,
    workingExperience,
    jobSearchDuration,
    gender,
    structure,
    refererEmail,
  }: UserProps) {
    const contactSf = await this.findContact(email);
    let contactSfId = contactSf?.Id;

    const casquette: Casquette = getCasquette(role);

    const refererId = refererEmail
      ? (await this.findContact(refererEmail))?.Id
      : undefined;

    // Contact doesnt exist in SF -> Create
    if (!contactSfId) {
      const leadSfId = await this.findLead(email);

      const companySfId =
        role === UserRoles.REFERER
          ? await this.findOrCreateAssociationAccount({
              name: structure,
              department: department,
              address: getPostalCodeFromDepartment(department),
            })
          : await this.findOrCreateHouseholdAccount({
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
        nationality,
        accommodation,
        hasSocialWorker,
        resources,
        studiesLevel,
        workingExperience,
        jobSearchDuration,
        gender,
        refererId,
      };

      contactSfId = (await this.createContact(
        {
          ...contactToCreate,
          casquettes: [casquette],
        },
        ContactRecordTypeFromRole[role]
      )) as string;

      if (leadSfId) {
        // Hack to have a contact with the same mail and phone as the prospect if it exists
        await this.updateContactEmailAndPhone(contactSfId, { email, phone });
      }
    } else {
      // Contact exist in SF -> Update

      // Update the casquette field
      const uniqueCasquettes = contactSf.Casquettes_r_les__c;
      if (!uniqueCasquettes.includes(casquette)) {
        uniqueCasquettes.push(casquette);
      }

      await this.updateContactCasquetteAndAppId(contactSfId, {
        id,
        casquettes: uniqueCasquettes,
      });

      // Update the socialSituation fields
      contactSfId = (await this.updateContactSocialSituation(contactSfId, {
        nationality,
        accommodation,
        hasSocialWorker,
        resources,
        studiesLevel,
        workingExperience,
        jobSearchDuration,
      })) as string;
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
      role: userDb.role as RegistrableUserRole,
    };
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
      birthDate: Date;
      campaign?: string;
      workingRight?: CandidateYesNoNSPPValue;
      nationality?: Nationality;
      accommodation?: CandidateAccommodation;
      hasSocialWorker?: YesNoJNSPRValue;
      resources?: CandidateResource;
      studiesLevel?: StudiesLevel;
      workingExperience?: WorkingExperience;
      jobSearchDuration?: JobSearchDuration;
      gender?: CandidateGender;
      refererEmail?: string;
      structure?: string;
    }
  ) {
    this.setIsWorker(true);

    const userToCreate = await this.findContactFromUserId(userId);

    return this.findOrCreateContactFromUserRegistrationForm({
      ...userToCreate,
      birthDate: otherInfo.birthDate,
      campaign: otherInfo.campaign,
      workingRight: otherInfo.workingRight,
      nationality: otherInfo.nationality,
      accommodation: otherInfo.accommodation,
      hasSocialWorker: otherInfo.hasSocialWorker,
      resources: otherInfo.resources,
      studiesLevel: otherInfo.studiesLevel,
      workingExperience: otherInfo.workingExperience,
      jobSearchDuration: otherInfo.jobSearchDuration,
      gender: otherInfo.gender,
      refererEmail: otherInfo.refererEmail,
      structure: otherInfo.structure,
    });
  }

  async createOrUpdateCompanySalesforceLead(lead: CompanyLeadProps) {
    this.setIsWorker(false);
    return this.findOrCreateLeadFromCompanyForm(lead);
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
