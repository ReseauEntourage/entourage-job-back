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

export const MailchimpMocks = { sendContact: jest.fn() };
