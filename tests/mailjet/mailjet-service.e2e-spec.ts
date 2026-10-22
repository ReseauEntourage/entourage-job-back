import { randomBytes } from 'crypto';
import { MailjetService } from 'src/external-services/mailjet/mailjet.service';
import {
  ContactStatuses,
  MailjetContactSource,
  MailjetTemplates,
} from 'src/external-services/mailjet/mailjet.types';
import { createMail } from 'src/external-services/mailjet/mailjet.utils';
import { Genders, UserRoles } from 'src/users/users.types';
import { ZoneName } from 'src/utils/types/zones.types';

// Plain text mails need no template: the type requires one, hence the cast
const textMail = (params: unknown): never => params as never;

// Pure unit tests (no database, no network): the Mailjet clients are replaced by mocks.
// Generated at runtime: no credential-like literal in the repository.
const sensitiveToken = randomBytes(8).toString('hex');

describe('MailjetService', () => {
  const envBackup = { ...process.env };

  const setKeys = () => {
    process.env.MAILJET_PUB = randomBytes(8).toString('hex');
    process.env.MAILJET_SEC = randomBytes(8).toString('hex');
    process.env.MAILJET_NEWSLETTER_PUB = randomBytes(8).toString('hex');
    process.env.MAILJET_NEWSLETTER_SEC = randomBytes(8).toString('hex');
    process.env.MAILJET_NEWSLETTER_LIST_ID = '1234';
    delete process.env.MAILJET_RELAY_URL;
  };

  const buildService = (userModel: unknown = { findOne: jest.fn() }) => {
    const service = new MailjetService(userModel as never);
    const sendRequest = jest.fn().mockResolvedValue({ body: {} });
    const contactRequest = jest
      .fn()
      .mockResolvedValue({ response: { status: 201 } });
    const contactChain = {
      id: jest.fn().mockReturnThis(),
      action: jest.fn().mockReturnThis(),
      request: contactRequest,
    };
    (service as unknown as Record<string, unknown>).mailjetTransactional = {
      post: jest.fn(() => ({ request: sendRequest })),
    };
    (service as unknown as Record<string, unknown>).mailjetNewsletter = {
      post: jest.fn(() => contactChain),
    };
    jest.spyOn(service['logger'], 'error').mockImplementation(() => undefined);
    jest.spyOn(service['logger'], 'log').mockImplementation(() => undefined);
    jest.spyOn(service['logger'], 'warn').mockImplementation(() => undefined);
    return { service, sendRequest, contactRequest, contactChain, userModel };
  };

  beforeEach(setKeys);

  afterEach(() => {
    process.env = { ...envBackup };
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it.each([
      ['MAILJET_PUB', 'Mailjet transactional API keys are not set'],
      ['MAILJET_SEC', 'Mailjet transactional API keys are not set'],
      ['MAILJET_NEWSLETTER_PUB', 'Mailjet newsletter API keys are not set'],
      ['MAILJET_NEWSLETTER_SEC', 'Mailjet newsletter API keys are not set'],
    ])('refuses to start without %s', (variable, message) => {
      delete process.env[variable];
      expect(() => new MailjetService({} as never)).toThrow(message);
    });

    it('requires the relay secret when the relay URL is set', () => {
      process.env.MAILJET_RELAY_URL = 'https://relay.invalid';
      delete process.env.MAILJET_RELAY_SECRET;

      expect(() => new MailjetService({} as never)).toThrow(
        'MAILJET_RELAY_SECRET is not set'
      );
    });

    it('creates the relay client when fully configured', () => {
      process.env.MAILJET_RELAY_URL = 'https://relay.invalid';
      process.env.MAILJET_RELAY_SECRET = randomBytes(8).toString('hex');

      const service = new MailjetService({} as never);

      expect(service['relayClient']).not.toBeNull();
    });
  });

  describe('sendMail', () => {
    it('sends a single mail directly and accepts a list of mails', async () => {
      const { service, sendRequest } = buildService();

      await service.sendMail(
        textMail({
          toEmail: 'a@example.com',
          subject: 's',
          text: 't',
        })
      );
      await service.sendMail(
        textMail([
          { toEmail: 'a@example.com', subject: 's', text: 't' },
          { toEmail: 'b@example.com', subject: 's', text: 't' },
        ])
      );

      expect(sendRequest.mock.calls[0][0].Messages).toHaveLength(1);
      expect(sendRequest.mock.calls[1][0].Messages).toHaveLength(2);
    });

    it('sends through the relay when configured', async () => {
      const { service, sendRequest } = buildService();
      const relaySend = jest
        .fn()
        .mockResolvedValue({ response: { status: 200 } });
      service['relayClient'] = { send: relaySend } as never;

      await service.sendMail(
        textMail({
          toEmail: 'a@example.com',
          subject: 's',
          text: 't',
        })
      );

      expect(relaySend).toHaveBeenCalledTimes(1);
      expect(sendRequest).not.toHaveBeenCalled();
    });

    it.each([
      [{ source: 'mailjet', statusCode: 400 }, 'Mailjet rejected the request'],
      [{ source: 'relay' }, 'the Mailjet relay rejected the request'],
      [{ source: 'network' }, 'the Mailjet relay could not be reached'],
      [new Error('plain'), 'direct call to Mailjet failed'],
      ['a string', 'direct call to Mailjet failed'],
    ])(
      'logs a redacted trace and rethrows when sending fails (%#)',
      async (error, origin) => {
        const { service, sendRequest } = buildService();
        sendRequest.mockRejectedValue(error);

        await expect(
          service.sendMail(
            textMail({
              toEmail: { to: 'a@example.com', cc: ['c@example.com'] },
              subject: 's',
              templateId: MailjetTemplates.WELCOME_CANDIDATE_COACH,
              variables: {
                token: sensitiveToken,
                otpCode: '123456',
                conversationUrl: 'https://front.invalid/x?token=abc&page=2',
                name: 'Jane',
                count: 3,
              },
            })
          )
        ).rejects.toBe(error);

        const logged = (service['logger'].error as jest.Mock).mock
          .calls[0][0] as string;
        expect(logged).toContain(origin);
        expect(logged).toContain('[REDACTED]');
        expect(logged).not.toContain(sensitiveToken);
        expect(logged).not.toContain('123456');
        expect(logged).not.toContain('token=abc');
        expect(logged).toContain('page=2');
        expect(logged).toContain('Jane');
      }
    );
  });

  describe('createContact', () => {
    it('skips the call when the newsletter list is not configured', async () => {
      delete process.env.MAILJET_NEWSLETTER_LIST_ID;
      const { service, contactRequest } = buildService();

      await service.createContact({
        email: 'a@example.com',
        source: MailjetContactSource.SITE_EP,
      });

      expect(contactRequest).not.toHaveBeenCalled();
      expect(service['logger'].warn).toHaveBeenCalled();
    });

    it('adds the contact with its status, zone and source as properties', async () => {
      const { service, contactRequest, contactChain } = buildService();

      await service.createContact({
        email: 'a@example.com',
        zone: ZoneName.IDF,
        status: ContactStatuses.CANDIDATE,
        source: MailjetContactSource.SITE_EP,
      });
      await service.createContact({
        email: 'b@example.com',
        status: ContactStatuses.COMPANY,
        source: MailjetContactSource.SITE_EP,
      });
      await service.createContact({
        email: 'c@example.com',
        status: ContactStatuses.ASSOCIATION,
        source: MailjetContactSource.SITE_EP,
      });

      expect(contactChain.id).toHaveBeenCalledWith(1234);
      const properties = (index: number) =>
        Object.values(contactRequest.mock.calls[index][0].Properties);
      expect(properties(0)).toContain('Oui');
      expect(contactRequest.mock.calls[0][0].Email).toBe('a@example.com');
      expect(properties(1).filter((value) => value === 'Oui')).toHaveLength(1);
      expect(properties(2).filter((value) => value === 'Oui')).toHaveLength(1);
    });

    it('goes through the relay when configured', async () => {
      const { service, contactRequest } = buildService();
      const manageContact = jest
        .fn()
        .mockResolvedValue({ response: { status: 200 } });
      service['relayClient'] = { manageContact } as never;

      await service.createContact({
        email: 'a@example.com',
        source: MailjetContactSource.SITE_EP,
      });

      expect(manageContact).toHaveBeenCalledWith(1234, expect.any(Object));
      expect(contactRequest).not.toHaveBeenCalled();
    });

    it('logs and rethrows when Mailjet fails', async () => {
      const { service, contactRequest } = buildService();
      const error = { source: 'mailjet', statusCode: 400, ErrorMessage: 'bad' };
      contactRequest.mockRejectedValue(error);

      await expect(
        service.createContact({
          email: 'a@example.com',
          source: MailjetContactSource.SITE_EP,
        })
      ).rejects.toBe(error);
      expect(service['logger'].error).toHaveBeenCalledWith(
        expect.stringContaining('Mailjet rejected the request'),
        undefined
      );
    });
  });

  describe('createContactForUser', () => {
    const userFixture = (overrides: Record<string, unknown> = {}) => ({
      email: 'jane@example.com',
      firstName: 'Jane',
      lastName: 'Doe',
      gender: Genders.FEMALE,
      role: UserRoles.COACH,
      zone: ZoneName.IDF,
      OrganizationId: null as string | null,
      companies: [] as unknown[],
      userProfile: { department: 'Paris (75)' },
      ...overrides,
    });

    it('skips the call when the newsletter list is not configured', async () => {
      delete process.env.MAILJET_NEWSLETTER_LIST_ID;
      const { service, contactRequest } = buildService();

      await service.createContactForUser(
        'user-1',
        MailjetContactSource.SITE_EP
      );

      expect(contactRequest).not.toHaveBeenCalled();
    });

    it('throws when the user does not exist', async () => {
      const { service } = buildService({
        findOne: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.createContactForUser('ghost', MailjetContactSource.SITE_EP)
      ).rejects.toThrow('User ghost not found');
    });

    it('maps a coach attached to a company with a known department', async () => {
      const findOne = jest
        .fn()
        .mockResolvedValue(userFixture({ companies: [{ id: 'c' }] }));
      const { service, contactRequest } = buildService({ findOne });

      await service.createContactForUser(
        'user-1',
        MailjetContactSource.SITE_EP
      );

      const body = contactRequest.mock.calls[0][0];
      expect(body.Name).toBe('Jane Doe');
      const values = Object.values(body.Properties);
      expect(values).toEqual(
        expect.arrayContaining(['Mme', '75', 'Jane', 'Doe'])
      );
      expect(
        values.filter((value) => value === 'Oui').length
      ).toBeGreaterThanOrEqual(2);
    });

    it.each([
      [Genders.MALE, 'M'],
      [Genders.OTHER, null],
    ])('maps the gender %s to the civility %s', async (gender, civility) => {
      const findOne = jest.fn().mockResolvedValue(
        userFixture({
          gender,
          role: UserRoles.CANDIDATE,
          OrganizationId: 'org-1',
          userProfile: undefined,
          zone: undefined,
        })
      );
      const { service, contactRequest } = buildService({ findOne });

      await service.createContactForUser(
        'user-1',
        MailjetContactSource.SITE_EP
      );

      const values = Object.values(contactRequest.mock.calls[0][0].Properties);
      expect(values.includes(civility)).toBe(true);
    });

    it('logs and rethrows when Mailjet fails', async () => {
      const findOne = jest.fn().mockResolvedValue(userFixture());
      const { service, contactRequest } = buildService({ findOne });
      const error = new Error('mailjet down');
      contactRequest.mockRejectedValue(error);

      await expect(
        service.createContactForUser('user-1', MailjetContactSource.SITE_EP)
      ).rejects.toBe(error);
      expect(service['logger'].error).toHaveBeenCalled();
    });
  });
});

describe('createMail', () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env.MAILJET_FROM_EMAIL = 'from@example.com';
    process.env.MAILJET_FROM_NAME = 'Entourage Pro';
    process.env.FRONT_URL = 'https://front.invalid';
  });

  afterEach(() => {
    process.env = { ...envBackup };
  });

  it('builds a text mail for a single recipient with a reply-to', () => {
    const mail = createMail(
      textMail({
        toEmail: 'a@example.com',
        replyTo: 'reply@example.com',
        subject: 'Hello',
        text: 'text',
        html: '<p>text</p>',
      })
    );

    expect(mail.To).toEqual([{ Email: 'a@example.com' }]);
    expect(mail.Headers).toEqual({ 'Reply-To': 'reply@example.com' });
    expect(mail).toMatchObject({
      Subject: 'Hello',
      'Text-part': 'text',
      'HTML-part': '<p>text</p>',
    });
  });

  it('accepts a list of recipients and has no header without reply-to', () => {
    const mail = createMail(
      textMail({
        toEmail: ['a@example.com', 'b@example.com'],
        subject: 's',
        text: 't',
      })
    );

    expect(mail.To).toEqual([
      { Email: 'a@example.com' },
      { Email: 'b@example.com' },
    ]);
    expect(mail.Headers).toBeUndefined();
  });

  it('accepts to, cc and bcc as one address or as lists', () => {
    const single = createMail(
      textMail({
        toEmail: {
          to: 'a@example.com',
          cc: 'c@example.com',
          bcc: 'b@example.com',
        },
        subject: 's',
        text: 't',
      })
    );
    const lists = createMail(
      textMail({
        toEmail: {
          to: ['a@example.com', 'a2@example.com'],
          cc: ['c@example.com', 'c2@example.com'],
          bcc: ['b@example.com', 'b2@example.com'],
        },
        subject: 's',
        text: 't',
      })
    );

    expect(single.To).toEqual([{ Email: 'a@example.com' }]);
    expect(single.Cc).toEqual([{ Email: 'c@example.com' }]);
    expect(single.Bcc).toEqual([{ Email: 'b@example.com' }]);
    expect(lists.To).toHaveLength(2);
    expect(lists.Cc).toHaveLength(2);
    expect(lists.Bcc).toHaveLength(2);
  });

  it('builds a template mail with the site link among the variables', () => {
    const mail = createMail(
      textMail({
        toEmail: 'a@example.com',
        subject: 's',
        templateId: MailjetTemplates.WELCOME_CANDIDATE_COACH,
        variables: { firstName: 'Jane' },
      })
    );

    expect(mail).toMatchObject({
      TemplateID: MailjetTemplates.WELCOME_CANDIDATE_COACH,
      TemplateLanguage: true,
      Variables: { siteLink: 'https://front.invalid', firstName: 'Jane' },
    });
    expect(mail).not.toHaveProperty('Text-part');
  });
});
