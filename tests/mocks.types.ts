import { Queue } from 'bull';
import { Cache } from 'cache-manager';
import { CloudFrontService } from 'src/external-services/aws/cloud-front.service';
import { S3Service } from 'src/external-services/aws/s3.service';
import { BitlyService } from 'src/external-services/bitly/bitly.service';
import { MailjetService } from 'src/external-services/mailjet/mailjet.service';
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
  createOrUpdateEvent: jest.fn(),
  createOrUpdateTask: jest.fn(),
  searchAccountByName: jest.fn(),
  findBinomeByCandidateEmail: jest.fn(),
  findContact: jest.fn(),
  findLead: jest.fn(),
  findBinomeByCandidateSfId: jest.fn(),
  findEventById: jest.fn(),
  findOfferById: jest.fn(),
  findOfferRelationsById: jest.fn(),
  findProcessById: jest.fn(),
  findTaskById: jest.fn(),
  findOwnerByLeadSfId: jest.fn(),
  createAccount: jest.fn(),
  createContact: jest.fn(),
  createLead: jest.fn(),
  createCandidateLead: jest.fn(),
  findOrCreateAccount: jest.fn(),
  findOrCreateContact: jest.fn(),
  findOrCreateLead: jest.fn(),
  findOrCreateCompanyAndContactFromOffer: jest.fn(),
  findOrCreateLeadFromCompanyForm: jest.fn(),
  findOrCreateLeadFromContactCandidateForm: jest.fn(),
  getProcessToCreate: jest.fn(),
  createOrUpdateSalesforceProcess: jest.fn(),
  createOrUpdateSalesforceOffer: jest.fn(),
  createOrUpdateSalesforceEvent: jest.fn(),
  createOrUpdateSalesforceOpportunityUserEvent: jest.fn(),
  createOrUpdateSalesforceExternalMessage: jest.fn(),
  findOfferFromOpportunityId: jest.fn(),
  findEventFromOpportunityUserEventId: jest.fn(),
  findTaskFromExternalMessageId: jest.fn(),
  createOrUpdateSalesforceOpportunity: jest.fn(),
  createOrUpdateCompanySalesforceLead: jest.fn(),
  createOrUpdateSalesforceTask: jest.fn(),
  createOrUpdateContactCandidateSalesforceLead: jest.fn(),
  setIsWorker: jest.fn(),
  updateLead: jest.fn(),
  findCampaignMember: jest.fn(),
  findOrCreateLeadFromInscriptionCandidateForm: jest.fn(),
  findOrCreateLeadFromExternalMessage: jest.fn(),
  createCampaignMemberInfoCo: jest.fn(),
  createOrUpdateInscriptionCandidateSalesforceLead: jest.fn(),
  getCampaigns: jest.fn(),
} as const;

export const MailjetMock: ProviderMock<MailjetService> = {
  sendContact: jest.fn(),
  createContact: jest.fn(),
  sendMail: jest.fn(),
  createMail: jest.fn(),
} as const;
