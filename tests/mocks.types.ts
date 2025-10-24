import { Queue } from 'bull';
import { Cache } from 'cache-manager';
import { CloudFrontService } from 'src/external-services/aws/cloud-front.service';
import { S3Service } from 'src/external-services/aws/s3.service';
import { MailjetService } from 'src/external-services/mailjet/mailjet.service';
import { SalesforceService } from 'src/external-services/salesforce/salesforce.service';
import { SlackService } from 'src/external-services/slack/slack.service';

type ProviderMock<T> = { [K in keyof T]: jest.Mock };

export const QueueMocks: Partial<ProviderMock<Queue>> & {
  redisOptions: Record<string, unknown>;
} = {
  add: jest.fn(),
  redisOptions: {},
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
  copyFile: jest.fn(async () => {
    return {};
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

export const SalesforceMocks: ProviderMock<SalesforceService> = {
  loginToSalesforce: jest.fn(),
  refreshSalesforceInstance: jest.fn(),
  createRecord: jest.fn(),
  updateRecord: jest.fn(),
  upsertRecord: jest.fn(),
  createOrUpdateTask: jest.fn(),
  searchAccountByName: jest.fn(),
  searchAccount: jest.fn(),
  findBinomeByCandidateEmail: jest.fn(),
  findContact: jest.fn(),
  findLead: jest.fn(),
  findBinomeByCandidateSfId: jest.fn(),
  findTaskById: jest.fn(),
  findOwnerByLeadSfId: jest.fn(),
  createAccount: jest.fn(),
  createContact: jest.fn(),
  updateContact: jest.fn(),
  updateContactSocialSituation: jest.fn(),
  updateContactEmailAndPhone: jest.fn(),
  updateLeadPhoneAndRecordType: jest.fn(),
  createLead: jest.fn(),
  updateLead: jest.fn(),
  createCandidateLead: jest.fn(),
  findOrCreateAccount: jest.fn(),
  findOrCreateCompanyContact: jest.fn(),
  findOrCreateLead: jest.fn(),
  findOrCreateLeadFromCompanyForm: jest.fn(),
  findOrCreateHouseholdAccount: jest.fn(),
  createOrUpdateSalesforceExternalMessage: jest.fn(),
  findTaskFromExternalMessageId: jest.fn(),
  findContactFromUserId: jest.fn(),
  createOrUpdateCompanySalesforceLead: jest.fn(),
  createOrUpdateSalesforceTask: jest.fn(),
  updateContactCasquetteAndAppId: jest.fn(),
  setIsWorker: jest.fn(),
  findCampaignMember: jest.fn(),
  findOrCreateCampaignMember: jest.fn(),
  findOrCreateAssociationAccount: jest.fn(),
  findOrCreateLeadFromExternalMessage: jest.fn(),
  findOrCreateContactFromUserRegistrationForm: jest.fn(),
  createOrUpdateSalesforceUser: jest.fn(),
  addLeadOrContactToCampaign: jest.fn(),
  getCandidateCampaigns: jest.fn(),
  getCoachCampaigns: jest.fn(),
  checkIfConnected: jest.fn(),
} as const;

export const MailjetMock: ProviderMock<MailjetService> = {
  sendMail: jest.fn(),
  sendContact: jest.fn(),
  refreshInstances: jest.fn(),
} as const;

export const SlackMocks: ProviderMock<SlackService> = {
  sendMessage: jest.fn(),
  generateSlackBlockMsg: jest.fn(),
  sendMessageUserReported: jest.fn(),
  generateProfileReportedBlocks: jest.fn(),
  getUserIdByEmail: jest.fn(),
} as const;
