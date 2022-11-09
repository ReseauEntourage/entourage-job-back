import { Injectable } from '@nestjs/common';
import * as jsforce from 'jsforce';
import { Connection, SuccessResult, Record } from 'jsforce';
import { Opportunity } from 'src/opportunities/models';
import { OpportunitiesService } from 'src/opportunities/opportunities.service';
import {
  CompanyFormProps,
  CompanyProps,
  ContactProps,
  ErrorCodes,
  LeadProps,
  ObjectNames,
  OfferAndProcessProps,
  OfferProps,
  ProcessProps,
  RecordType,
  RecordTypesIds,
  SalesforceBinome,
  SalesforceContact,
  SalesforceError,
  SalesforceLead,
  SalesforceObject,
  SalesforceOffer,
  SalesforceProcess,
} from './salesforce.types';
import {
  formatBusinessLines,
  formatCompanyName,
  formatDepartment,
  formatRegions,
  mapProcessFromOpportunityUser,
  mapSalesforceOfferFields,
  mapSalesforceProcessFields,
  parseAddress,
} from './salesforce.utils';

@Injectable()
export class SalesforceService {
  private salesforce: Connection;

  constructor(private opportunitiesService: OpportunitiesService) {
    this.salesforce = new jsforce.Connection({
      oauth2: {
        loginUrl: process.env.SALESFORCE_LOGIN_URL,
        clientId: process.env.SALESFORCE_CLIENT_ID,
        clientSecret: process.env.SALESFORCE_CLIENT_SECRET,
        redirectUri: process.env.SALESFORCE_REDIRECT_URI,
      },
    });
  }

  async loginToSalesforce() {
    await this.salesforce.login(
      process.env.SALESFORCE_USERNAME,
      process.env.SALESFORCE_PASSWORD + process.env.SALESFORCE_SECURITY_TOKEN
    );
  }

  async refreshSalesforceInstance() {
    try {
      await this.salesforce.identity();
    } catch (err) {
      console.error(
        `Error after check if still logged in '${
          (err as SalesforceError).message
        }'`
      );
      await this.loginToSalesforce();
    }
  }

  async createRecord(
    name: string,
    params: SalesforceObject
  ): Promise<string | string[]> {
    await this.refreshSalesforceInstance();

    try {
      const result = await this.salesforce.sobject(name).create(params);
      if (Array.isArray(result)) {
        return result.map(({ id, success, errors }) => {
          if (!success) {
            console.error(errors);
            return null;
          }
          return id;
        });
      }
      return (result as SuccessResult).id;
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

  async upsertRecord<T extends Record<object>>(
    name: string,
    params: T | T[],
    extIdField: keyof T,
    findIdFunction: 'findProcessById' | 'findOfferById'
  ): Promise<string | string[]> {
    await this.refreshSalesforceInstance();

    try {
      const result = await this.salesforce
        .sobject(name)
        .upsert(params, extIdField as string);

      if (Array.isArray(result)) {
        return Promise.all(
          result.map(async ({ id, success, errors }, index) => {
            if (!success) {
              console.error(errors);
              return null;
            }
            return (
              id ||
              (await this[findIdFunction]((params as T[])[index][extIdField]))
            );
          })
        );
      }
      return (
        (result as SuccessResult).id ||
        (await this[findIdFunction]((params as T)[extIdField]))
      );
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
    let records;
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
    let records;
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
    const { searchRecords } = await this.salesforce.search(
      `FIND {${escapedSearch}} IN NAME FIELDS RETURNING ${ObjectNames.COMPANY}(Id) LIMIT 1`
    );

    return searchRecords[0]?.Id;
  }

  async findBinomeByCandidateEmail(email: string) {
    const candidateSfId = await this.findContactByEmail(
      email,
      RecordTypesIds.CANDIDATE
    );
    if (!candidateSfId) {
      return null;
    }
    return this.findBinomeByCandidateSfId(candidateSfId);
  }

  async findContactByEmail(email: string, recordType: RecordType) {
    await this.refreshSalesforceInstance();
    const { records }: { records: Partial<SalesforceContact>[] } =
      await this.salesforce.query(
        `SELECT Id FROM ${ObjectNames.CONTACT} WHERE (Adresse_email_unique__c='${email}' OR Email='${email}') AND RecordTypeId='${recordType}' LIMIT 1`
      );
    return records[0]?.Id;
  }

  async findContact(
    firstName: string,
    lastName: string,
    email: string,
    phone: string,
    recordType: RecordType
  ) {
    await this.refreshSalesforceInstance();
    const { records }: { records: Partial<SalesforceContact>[] } =
      await this.salesforce.query(
        `SELECT Id FROM ${ObjectNames.CONTACT} WHERE (Adresse_email_unique__c='${email}' OR Email='${email}') 
                       AND Phone='${phone}' AND FirstName='${firstName}' 
                       AND LastName='${firstName}'
                       AND RecordTypeId='${recordType}' LIMIT 1`
      );
    return records[0]?.Id;
  }

  async findLead(
    firstName: string,
    lastName: string,
    email: string,
    phone: string,
    recordType: RecordType
  ) {
    await this.refreshSalesforceInstance();
    const { records }: { records: Partial<SalesforceLead>[] } =
      await this.salesforce.query(
        `
            SELECT Id FROM ${ObjectNames.LEAD} 
            WHERE (Adresse_email_unique__c='${email}' OR Email='${email}') 
              AND Phone='${phone}' AND FirstName='${firstName}' 
              AND LastName='${firstName}'
              AND RecordTypeId='${recordType}' LIMIT 1
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
        : name,
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
      LastName: lastName,
      FirstName: firstName,
      Email: email,
      Phone: phone,
      Title: position,
      AccountId: companySfId,
      Type_de_contact__c: 'Entreprise',
      Reseaux__c: 'LinkedOut',
      RecordTypeId: RecordTypesIds.COMPANY,
      Antenne__c: formatDepartment(department),
    });
  }

  async createLead({
    firstName,
    lastName,
    email,
    phone,
    regions,
    companySfId,
  }: LeadProps) {
    return this.createRecord(ObjectNames.LEAD, {
      LastName: lastName,
      FirstName: firstName,
      Email: email,
      Phone: phone,
      AccountId: companySfId,
      Type_de_contact__c: 'Entreprise',
      Reseaux__c: 'LinkedOut',
      RecordTypeId: RecordTypesIds.COMPANY,
      Antenne__c: formatRegions(regions),
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
      companySfId = await this.searchCompanyByName(`${name}`);
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
      firstName,
      lastName,
      contactMail || email,
      phone,
      RecordTypesIds.COMPANY
    );

    if (!contactSfId) {
      contactSfId = (await this.createContact(
        contactMail
          ? {
              lastName: 'Inconnu',
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
    email,
    phone,
    regions,
    companySfId,
  }: LeadProps) {
    let leadSfId = await this.findLead(
      firstName,
      lastName,
      email,
      phone,
      RecordTypesIds.COMPANY
    );

    if (!leadSfId) {
      leadSfId = (await this.createLead({
        firstName,
        lastName,
        email,
        phone,
        regions,
        companySfId,
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

    return { contactSfId, companySfId };
  }

  async findOrCreateCompanyAndLeadFromCompanyForm(lead: CompanyFormProps) {
    const { firstName, lastName, email, phone, company, regions } = lead;

    const companySfId = await this.findOrCreateCompany({
      name: company,
    });

    const leadSfId = (await this.findOrCreateLead({
      firstName,
      lastName,
      email,
      phone,
      regions,
      companySfId,
    })) as string;

    return { leadSfId, companySfId };
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
      const processToCreate = await Promise.all(
        process.map(async (singleProcess) => {
          return this.getProcessToCreate(singleProcess, offerSfId);
        })
      );
      return this.createOrUpdateProcess(processToCreate);
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
        (acc, curr) => {
          return {
            offers: [...acc.offers, curr.offer],
            processes: [
              ...acc.processes,
              ...(Array.isArray(curr.process) ? curr.process : [curr.process]),
            ],
          };
        },
        { offers: [], processes: [] }
      );

      const offersToCreate = await Promise.all(
        offersAndProcessesToCreate.offers.map(async (offer) => {
          const { contactSfId, companySfId } =
            await this.findOrCreateCompanyAndContactFromOffer(
              offer,
              mainCompanySfId,
              mainContactSfId
            );

          return {
            ...offer,
            contactSfId,
            companySfId,
          };
        })
      );

      await this.createOrUpdateOffer(offersToCreate);

      await this.createOrUpdateSalesforceProcess(
        offersAndProcessesToCreate.processes
      );
    } else {
      const { offer, process } = offerAndProcess;
      const { contactSfId, companySfId } =
        await this.findOrCreateCompanyAndContactFromOffer(offer);

      const offerSfId = (await this.createOrUpdateOffer({
        ...offer,
        contactSfId,
        companySfId,
      })) as string;

      await this.createOrUpdateSalesforceProcess(process, offerSfId);
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
      ) as ProcessProps[],
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

  async createOrUpdateSalesforceLead(lead: CompanyFormProps) {
    return this.findOrCreateCompanyAndLeadFromCompanyForm(lead);
  }
}
