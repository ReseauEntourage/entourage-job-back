import { Injectable } from '@nestjs/common';
import * as jsforce from 'jsforce';
import { Connection, ErrorResult, RecordResult, SuccessResult } from 'jsforce';
import { Opportunity } from 'src/opportunities/models';
import { OpportunitiesService } from 'src/opportunities/opportunities.service';
import {
  CompanyProps,
  ContactProps,
  ContactRecordType,
  ContactsRecordTypesIds,
  ErrorCodes,
  LeadProps,
  LeadRecordType,
  LeadsRecordTypesIds,
  ObjectName,
  ObjectNames,
  OfferAndProcessProps,
  OfferProps,
  ProcessProps,
  SalesforceBinome,
  SalesforceCompany,
  SalesforceContact,
  SalesforceError,
  SalesforceLead,
  SalesforceObject,
  SalesforceOffer,
  SalesforceProcess,
} from './salesforce.types';
import {
  executeBulkAction,
  formatApproach,
  formatBusinessLines,
  formatCompanyName,
  formatDepartment,
  formatHeardAbout,
  formatRegions,
  mapProcessFromOpportunityUser,
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

  constructor(private opportunitiesService: OpportunitiesService) {}

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
    return await this.salesforce.login(
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
      if (remainingRetries > 0) {
        await asyncTimeout(RETRY_DELAY);
        await this.refreshSalesforceInstance(remainingRetries - 1);
      } else {
        throw err;
      }
    }
  }

  async createRecord<T extends ObjectName>(
    name: T,
    params: SalesforceObject<T> | SalesforceObject<T>[]
  ): Promise<string | string[]> {
    await this.refreshSalesforceInstance();

    try {
      if (Array.isArray(params)) {
        const job = this.salesforce.bulk.createJob(name, 'create');

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
        const result = await this.salesforce.sobject(name).create(params);
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

  async updateRecord<T extends ObjectName>(
    name: T,
    params: SalesforceObject<T> | SalesforceObject<T>[]
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

  async searchCompanyByName(search: string) {
    const escapedSearch = search.replace(/[?&|!{}[\]()^~*:\\"'+-]/gi, '\\$&');
    await this.refreshSalesforceInstance();
    if (escapedSearch.length === 1) {
      const { records }: { records: Partial<SalesforceCompany>[] } =
        await this.salesforce.query(
          `SELECT Id FROM ${ObjectNames.COMPANY} WHERE Name LIKE '${escapedSearch}%' LIMIT 1`
        );
      return records[0]?.Id;
    }

    const { searchRecords } = await this.salesforce.search(
      `FIND {${escapedSearch}} IN NAME FIELDS RETURNING ${ObjectNames.COMPANY}(Id) LIMIT 1`
    );

    return searchRecords[0]?.Id;
  }

  async findBinomeByCandidateEmail(email: string) {
    const candidateSfId = await this.findContact(
      email,
      ContactsRecordTypesIds.CANDIDATE
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
        `SELECT Id FROM ${ObjectNames.CONTACT} WHERE (Adresse_email_unique__c='${email}' OR Email='${email}') AND RecordTypeId='${recordType}' LIMIT 1`
      );
    return records[0]?.Id;
  }

  async findLead(email: string, recordType: LeadRecordType) {
    await this.refreshSalesforceInstance();
    const { records }: { records: Partial<SalesforceLead>[] } =
      await this.salesforce.query(
        `SELECT Id FROM ${ObjectNames.LEAD} WHERE Email='${email}' AND RecordTypeId='${recordType}' LIMIT 1
          `
      );
    return records[0]?.Id;
  }

  async findBinomeByCandidateSfId<T>(id: T) {
    await this.refreshSalesforceInstance();
    const { records }: { records: Partial<SalesforceBinome>[] } =
      await this.salesforce.query(
        `SELECT Id FROM ${ObjectNames.BINOME} WHERE Candidat_LinkedOut__c='${id}' LIMIT 1`
      );
    return records[0]?.Id;
  }

  async findOfferById<T>(id: T): Promise<string> {
    await this.refreshSalesforceInstance();
    const { records }: { records: Partial<SalesforceOffer>[] } =
      await this.salesforce.query(
        `SELECT Id FROM ${ObjectNames.OFFER} WHERE ID__c='${id}' LIMIT 1`
      );
    return records[0]?.Id;
  }

  async findOfferRelationsById<T>(id: T) {
    await this.refreshSalesforceInstance();
    const { records }: { records: Partial<SalesforceOffer>[] } =
      await this.salesforce.query(
        `SELECT Entreprise_Recruteuse__c, Prenom_Nom_du_recruteur__c FROM ${ObjectNames.OFFER} WHERE ID__c='${id}' LIMIT 1`
      );
    return {
      companySfId: records[0]?.Entreprise_Recruteuse__c,
      contactSfId: records[0]?.Prenom_Nom_du_recruteur__c,
    };
  }

  async findProcessById<T>(id: T) {
    await this.refreshSalesforceInstance();
    const { records }: { records: Partial<SalesforceProcess>[] } =
      await this.salesforce.query(
        `SELECT Id FROM ${ObjectNames.PROCESS} WHERE ID_Externe__c='${id}' LIMIT 1`
      );
    return records[0]?.Id;
  }

  async createCompany({
    name,
    businessLines,
    address,
    department,
    mainCompanySfId,
  }: CompanyProps) {
    const parsedAddress = parseAddress(address);

    return this.createRecord(ObjectNames.COMPANY, {
      Name: mainCompanySfId
        ? formatCompanyName(name, address, department)
        : name || 'Inconnu',
      Industry: formatBusinessLines(businessLines),
      BillingStreet: parsedAddress.street,
      BillingCity: parsedAddress.city,
      BillingPostalCode: parsedAddress.postalCode,
      Reseaux__c: 'LinkedOut',
      Antenne__c: formatDepartment(department),
      ParentId: mainCompanySfId,
    });
  }

  async createContact({
    firstName,
    lastName,
    email,
    phone,
    position,
    department,
    companySfId,
  }: ContactProps) {
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
      Casquettes_r_les__c: 'Partenaire Entreprise',
      Reseaux__c: 'LinkedOut',
      RecordTypeId: ContactsRecordTypesIds.COMPANY,
      Antenne__c: formatDepartment(department),
      Source__c: 'Lead entrant',
    });
  }

  async createLead({
    firstName,
    lastName,
    company,
    position,
    email,
    phone,
    zone,
    approach,
    heardAbout,
  }: LeadProps) {
    return this.createRecord(ObjectNames.LEAD, {
      LastName:
        lastName?.length > 80
          ? lastName.substring(0, 80)
          : lastName || 'Inconnu',
      FirstName: firstName,
      Company: company,
      Title: position,
      Email: email
        ?.replace(/\+/g, '.')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, ''),
      Phone: phone?.length > 40 ? phone.substring(0, 40) : phone,
      Reseaux__c: 'LinkedOut',
      RecordTypeId: LeadsRecordTypesIds.COMPANY,
      Antenne__c: formatRegions(zone),
      Source__c: 'Lead entrant',
      Votre_demarche__c: formatApproach(approach),
      Comment_vous_nous_avez_connu__c: formatHeardAbout(heardAbout),
    });
  }

  async findOrCreateCompany({
    name,
    address,
    department,
    businessLines,
    mainCompanySfId,
  }: CompanyProps) {
    let companySfId = await this.searchCompanyByName(
      formatCompanyName(name, address, department)
    );

    if (!companySfId) {
      companySfId = await this.searchCompanyByName(name || 'Inconnu');
    }
    if (!companySfId) {
      companySfId = (await this.createCompany({
        name,
        businessLines,
        address,
        department,
        mainCompanySfId,
      })) as string;
    }
    return companySfId;
  }

  async findOrCreateContact({
    contactMail,
    email,
    department,
    mainCompanySfId,
    companySfId,
    firstName,
    lastName,
    phone,
    position,
  }: ContactProps & { contactMail: string; mainCompanySfId: string }) {
    let contactSfId = await this.findContact(
      contactMail || email,
      ContactsRecordTypesIds.COMPANY
    );

    if (!contactSfId) {
      contactSfId = (await this.createContact(
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
            }
      )) as string;
    }
    return contactSfId;
  }

  async findOrCreateLead({
    firstName,
    lastName,
    company,
    position,
    email,
    phone,
    zone,
    approach,
    heardAbout,
  }: LeadProps) {
    const leadSfId = await this.findLead(email, LeadsRecordTypesIds.COMPANY);

    if (!leadSfId) {
      return (await this.createLead({
        firstName,
        lastName,
        company,
        position,
        email,
        phone,
        zone,
        approach,
        heardAbout,
      })) as string;
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

    let { companySfId, contactSfId } = await this.findOfferRelationsById(
      offer.id
    );

    if (!companySfId) {
      companySfId = await this.findOrCreateCompany({
        name: company,
        businessLines,
        address,
        department,
        mainCompanySfId,
      });
    }

    // eslint-disable-next-line no-console
    console.log('Created Salesforce Company', companySfId);

    if (mainContactSfId) {
      contactSfId = mainContactSfId;
    } else if (!contactSfId) {
      contactSfId = (await this.findOrCreateContact({
        firstName: recruiterFirstName,
        lastName: recruiterName,
        email: recruiterMail,
        position: recruiterPosition,
        phone: recruiterPhone,
        contactMail,
        department,
        companySfId,
        mainCompanySfId,
      })) as string;
    }

    // eslint-disable-next-line no-console
    console.log('Created Salesforce Contact', contactSfId);

    return { contactSfId, companySfId };
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
  }: LeadProps) {
    return (await this.findOrCreateLead({
      firstName,
      lastName,
      company,
      position,
      email,
      phone,
      zone,
      approach,
      heardAbout,
    })) as string;
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

        ({ companySfId: mainCompanySfId, contactSfId: mainContactSfId } =
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

      let offersToCreate: OfferProps[] = [];
      for (let i = 0; i < offersAndProcessesToCreate.offers.length; i += 1) {
        const offer = offersAndProcessesToCreate.offers[i];
        const { contactSfId, companySfId } =
          await this.findOrCreateCompanyAndContactFromOffer(
            offer,
            mainCompanySfId,
            mainContactSfId
          );

        offersToCreate = [
          ...offersToCreate,
          {
            ...offer,
            contactSfId,
            companySfId,
          },
        ];
      }

      await this.createOrUpdateOffer(offersToCreate);

      if (
        offersAndProcessesToCreate.processes &&
        offersAndProcessesToCreate.processes.length > 0
      ) {
        await this.createOrUpdateSalesforceProcess(
          offersAndProcessesToCreate.processes
        );
      }
    } else {
      const { offer, process } = offerAndProcess;
      const { contactSfId, companySfId } =
        await this.findOrCreateCompanyAndContactFromOffer(offer);

      const offerSfId = (await this.createOrUpdateOffer({
        ...offer,
        contactSfId,
        companySfId,
      })) as string;

      if (process && process.length > 0) {
        await this.createOrUpdateSalesforceProcess(process, offerSfId);
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
        opportunity.id,
        opportunity.title,
        opportunity.company
      ).filter((singleProcess) => !!singleProcess) as ProcessProps[],
    };
  }

  async createOrUpdateSalesforceOpportunity(
    opportunityId: string | string[],
    isSameOpportunity: boolean
  ) {
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

  async createOrUpdateSalesforceLead(lead: LeadProps) {
    return this.findOrCreateLeadFromCompanyForm(lead);
  }
}
