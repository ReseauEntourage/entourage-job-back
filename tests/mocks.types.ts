export const QueueMocks = { add: jest.fn() } as const;

export const CacheMocks = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
} as const;

export const S3Mocks = {
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

export const CloudFrontMocks = {
  invalidateCache: jest.fn(async () => {
    return 'id';
  }),
} as const;

export const BitlyMocks = {
  getShortenedOfferURL: jest.fn(async () => {
    return 'url';
  }),
};

export const SalesforceMocks = {
  loginToSalesforce: jest.fn(),
  refreshSalesforceInstance: jest.fn(),
  createRecord: jest.fn(),
  upsertRecord: jest.fn(),
  createOrUpdateProcess: jest.fn(),
  createOrUpdateOffer: jest.fn(),
  searchCompanyByName: jest.fn(),
  findBinomeByCandidateEmail: jest.fn(),
  findContactByEmail: jest.fn(),
  findBinomeByCandidateSfId: jest.fn(),
  findOfferById: jest.fn(),
  findOfferRelationsById: jest.fn(),
  findProcessById: jest.fn(),
  createCompany: jest.fn(),
  createContact: jest.fn(),
  findOrCreateCompany: jest.fn(),
  findOrCreateContact: jest.fn(),
  findOrCreateCompanyAndContactFromOffer: jest.fn(),
  getProcessToCreate: jest.fn(),
  createOrUpdateSalesforceProcess: jest.fn(),
  createOrUpdateSalesforceOffer: jest.fn(),
  findOfferFromOpportunityId: jest.fn(),
  createOrUpdateSalesforceOpportunity: jest.fn(),
};

export const AirtableMocks = {
  insertOpportunityAirtable: jest.fn(),
  updateOpportunityAirtable: jest.fn(),
};
