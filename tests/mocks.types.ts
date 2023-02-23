import { Queue } from 'bull';
import { Cache } from 'cache-manager';
import { AirtableService } from 'src/external-services/airtable/airtable.service';
import { CloudFrontService } from 'src/external-services/aws/cloud-front.service';
import { S3Service } from 'src/external-services/aws/s3.service';
import { BitlyService } from 'src/external-services/bitly/bitly.service';
import { PleziService } from 'src/external-services/plezi/plezi.service';
import { SalesforceService } from 'src/external-services/salesforce/salesforce.service';

type ProviderMock<T> = { [K in keyof T]: jest.Mock };

export const QueueMocks: Partial<ProviderMock<Queue>> = {
  add: jest.fn(),
} as const;

export const CacheMocks: Partial<ProviderMock<Cache>> = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
} as const;

export const S3Mocks: ProviderMock<S3Service> = {
  upload: jest.fn(async () => {
    return 'key';
  }),
  deleteFiles: jest.fn(async () => {
    return {};
  }),
  getHead: jest.fn(async () => {
    return {};
  }),
  getSignedUrl: jest.fn(async () => {
    return 'url';
  }),
} as const;

export const CloudFrontMocks: ProviderMock<CloudFrontService> = {
  invalidateCache: jest.fn(async () => {
    return 'id';
  }),
} as const;

export const BitlyMocks: ProviderMock<BitlyService> = {
  getShortenedOfferURL: jest.fn(async () => {
    return 'url';
  }),
} as const;

export const SalesforceMocks: ProviderMock<SalesforceService> = {
  loginToSalesforce: jest.fn(),
  refreshSalesforceInstance: jest.fn(),
  createRecord: jest.fn(),
  updateRecord: jest.fn(),
  upsertRecord: jest.fn(),
  createOrUpdateProcess: jest.fn(),
  createOrUpdateOffer: jest.fn(),
  createOrUpdateOfferWithRecruiter: jest.fn(),
  searchAccountByName: jest.fn(),
  findBinomeByCandidateEmail: jest.fn(),
  findContact: jest.fn(),
  findLead: jest.fn(),
  findBinomeByCandidateSfId: jest.fn(),
  findOfferById: jest.fn(),
  findOfferRelationsById: jest.fn(),
  findProcessById: jest.fn(),
  createAccount: jest.fn(),
  createContact: jest.fn(),
  createLead: jest.fn(),
  createCandidateLead: jest.fn(),
  findOrCreateAccount: jest.fn(),
  findOrCreateContact: jest.fn(),
  findOrCreateLead: jest.fn(),
  findOrCreateCompanyAndContactFromOffer: jest.fn(),
  findOrCreateLeadFromCompanyForm: jest.fn(),
  findOrCreateLeadFromCandidateForm: jest.fn(),
  getProcessToCreate: jest.fn(),
  createOrUpdateSalesforceProcess: jest.fn(),
  createOrUpdateSalesforceOffer: jest.fn(),
  findOfferFromOpportunityId: jest.fn(),
  createOrUpdateSalesforceOpportunity: jest.fn(),
  createOrUpdateCompanySalesforceLead: jest.fn(),
  createOrUpdateCandidateSalesforceLead: jest.fn(),
  setIsWorker: jest.fn(),
  updateLead: jest.fn(),
} as const;

export const AirtableMocks: ProviderMock<AirtableService> = {
  insertOpportunityAirtable: jest.fn(),
  updateOpportunityAirtable: jest.fn(),
} as const;

export const PleziMocks: ProviderMock<PleziService> = {
  sendContactToPlezi: jest.fn(),
} as const;
