import { Logger } from '@nestjs/common';
import {
  MAILJET_RELAY_TIMEOUT_MS,
  MailjetRelayClient,
  MailjetRelayError,
} from 'src/external-services/mailjet/mailjet-relay.client';
import { MailjetService } from 'src/external-services/mailjet/mailjet.service';
import {
  MailjetContactSource,
  MailjetTemplates,
} from 'src/external-services/mailjet/mailjet.types';

/**
 * Direct Mailjet calls recorded by the `node-mailjet` double below. These
 * tests never open a database or network connection: `node-mailjet` and
 * `fetch` are both replaced.
 */
const mockDirectCalls: {
  body: unknown;
  kind: 'send' | 'contact';
  listId?: number;
  pub: string;
}[] = [];
let mockDirectError: unknown = null;
const mockApiConnect = jest.fn();

jest.mock('node-mailjet', () => ({
  __esModule: true,
  default: {
    apiConnect: (...args: unknown[]) => {
      mockApiConnect(...args);
      const pub = args[0] as string;
      const outcome = () =>
        mockDirectError
          ? Promise.reject(mockDirectError)
          : Promise.resolve({ response: { status: 200 }, body: {} });
      return {
        post: () => ({
          request: (body: unknown) => {
            mockDirectCalls.push({ kind: 'send', pub, body });
            return outcome();
          },
          id: (listId: number) => ({
            action: () => ({
              request: (body: unknown) => {
                mockDirectCalls.push({ kind: 'contact', pub, listId, body });
                return outcome();
              },
            }),
          }),
        }),
      };
    },
  },
}));

const RELAY_URL = 'https://relay.example.org';
const RELAY_SECRET = 'relay-secret-value';
const LIST_ID = 12345;

const ENV_KEYS = [
  'MAILJET_PUB',
  'MAILJET_SEC',
  'MAILJET_NEWSLETTER_PUB',
  'MAILJET_NEWSLETTER_SEC',
  'MAILJET_NEWSLETTER_LIST_ID',
  'MAILJET_FROM_EMAIL',
  'MAILJET_FROM_NAME',
  'MAILJET_SUPPORT_EMAIL',
  'MAILJET_RELAY_URL',
  'MAILJET_RELAY_SECRET',
  'FIXIE_URL',
];

const mailParams = {
  templateId: MailjetTemplates.PASSWORD_RESET,
  toEmail: 'user@example.org',
  subject: 'Reset your password',
  replyTo: 'staff@entourage.social',
  variables: { firstName: 'Ada', token: 'SECRET-TOKEN', otpCode: '123456' },
};

const relayResponse = (
  status: number,
  body: unknown,
  source?: 'mailjet' | 'relay'
) =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: source ? { 'x-relay-source': source } : {},
  });

describe('Mailjet relay transport', () => {
  const savedEnv: Record<string, string | undefined> = {};
  let fetchMock: jest.SpyInstance;
  let errorLog: jest.SpyInstance;

  const configureEnv = (overrides: Record<string, string | undefined> = {}) => {
    const env: Record<string, string | undefined> = {
      MAILJET_PUB: 'tx-pub',
      MAILJET_SEC: 'tx-sec',
      MAILJET_NEWSLETTER_PUB: 'nl-pub',
      MAILJET_NEWSLETTER_SEC: 'nl-sec',
      MAILJET_NEWSLETTER_LIST_ID: String(LIST_ID),
      MAILJET_FROM_EMAIL: 'noreply@example.org',
      MAILJET_FROM_NAME: 'Entourage Pro',
      MAILJET_SUPPORT_EMAIL: 'support@example.org',
      MAILJET_RELAY_URL: undefined,
      MAILJET_RELAY_SECRET: undefined,
      FIXIE_URL: undefined,
      ...overrides,
    };
    ENV_KEYS.forEach((key) => {
      if (env[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = env[key];
      }
    });
  };

  const buildService = (userModel: unknown = { findOne: jest.fn() }) =>
    new MailjetService(userModel as never);

  const withRelay = () =>
    configureEnv({
      MAILJET_RELAY_URL: RELAY_URL,
      MAILJET_RELAY_SECRET: RELAY_SECRET,
    });

  const relayCall = (index = 0) => {
    const [url, init] = fetchMock.mock.calls[index];
    return {
      url: url as string,
      init: init as RequestInit,
      body: JSON.parse((init as RequestInit).body as string),
    };
  };

  beforeEach(() => {
    ENV_KEYS.forEach((key) => {
      savedEnv[key] = process.env[key];
    });
    mockDirectCalls.length = 0;
    mockDirectError = null;
    mockApiConnect.mockClear();
    configureEnv();
    fetchMock = jest
      .spyOn(global, 'fetch')
      .mockImplementation(async () => relayResponse(200, { ok: true }));
    errorLog = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => {
    ENV_KEYS.forEach((key) => {
      if (savedEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = savedEnv[key];
      }
    });
    jest.restoreAllMocks();
  });

  describe('MailjetRelayClient', () => {
    const client = () => new MailjetRelayClient(`${RELAY_URL}/`, RELAY_SECRET);

    it('posts a send to <url>/send with the secret header, normalizing a trailing slash', async () => {
      const body = { Messages: [{ TemplateID: 1 }] };

      await client().send(body);

      const call = relayCall();
      expect(call.url).toBe(`${RELAY_URL}/send`);
      expect(call.init.method).toBe('POST');
      expect(call.init.headers).toMatchObject({
        'x-relay-secret': RELAY_SECRET,
        'content-type': 'application/json',
      });
      expect(call.body).toEqual(body);
    });

    it('posts a contact to <url>/contacts with the list id and the contact body', async () => {
      const contact = { Email: 'a@b.c', Action: 'addnoforce' };

      await client().manageContact(LIST_ID, contact);

      const call = relayCall();
      expect(call.url).toBe(`${RELAY_URL}/contacts`);
      expect(call.body).toEqual({ listId: LIST_ID, body: contact });
    });

    it('waits longer than the relay limit of 20 s and aborts after that', async () => {
      await client().send({ Messages: [] });

      expect(MAILJET_RELAY_TIMEOUT_MS).toBeGreaterThan(20000);
      expect((relayCall().init.signal as AbortSignal).aborted).toBe(false);
      expect(relayCall().init.signal).toBeInstanceOf(AbortSignal);
    });

    it('resolves a 2xx with the status and the parsed body', async () => {
      fetchMock.mockResolvedValue(relayResponse(200, { Messages: [] }));

      await expect(client().send({ Messages: [] })).resolves.toEqual({
        response: { status: 200 },
        body: { Messages: [] },
      });
    });

    it('throws a mailjet-source error for a rejection forwarded from Mailjet', async () => {
      fetchMock.mockResolvedValue(
        relayResponse(400, { ErrorMessage: 'bad template' }, 'mailjet')
      );

      const error = await client()
        .send({ Messages: [] })
        .catch((e) => e);

      expect(error).toBeInstanceOf(MailjetRelayError);
      expect(error).toMatchObject({
        source: 'mailjet',
        statusCode: 400,
        ErrorMessage: 'bad template',
        response: { data: { ErrorMessage: 'bad template' } },
      });
    });

    it('throws a relay-source error for a rejection produced by the relay', async () => {
      fetchMock.mockResolvedValue(
        relayResponse(401, { error: 'unauthorized' }, 'relay')
      );

      const error = await client()
        .send({ Messages: [] })
        .catch((e) => e);

      expect(error).toMatchObject({ source: 'relay', statusCode: 401 });
    });

    it('assumes the relay answered itself when x-relay-source is missing', async () => {
      fetchMock.mockResolvedValue(relayResponse(502, 'bad gateway'));

      const error = await client()
        .send({ Messages: [] })
        .catch((e) => e);

      expect(error).toMatchObject({
        source: 'relay',
        statusCode: 502,
        response: { data: 'bad gateway' },
      });
    });

    it('throws a network error when the relay times out', async () => {
      fetchMock.mockRejectedValue(
        Object.assign(new Error('The operation timed out'), {
          name: 'TimeoutError',
        })
      );

      const error = await client()
        .send({ Messages: [] })
        .catch((e) => e);

      expect(error).toBeInstanceOf(MailjetRelayError);
      expect(error.source).toBe('network');
      expect(error.statusCode).toBeUndefined();
    });

    it('throws a network error with the code when the connection is reset', async () => {
      fetchMock.mockRejectedValue(
        Object.assign(new Error('fetch failed'), {
          cause: { code: 'ECONNRESET' },
        })
      );

      const error = await client()
        .send({ Messages: [] })
        .catch((e) => e);

      expect(error).toMatchObject({ source: 'network', code: 'ECONNRESET' });
    });
  });

  describe('transport selection and startup', () => {
    it('starts with the relay when URL and secret are set', () => {
      withRelay();

      expect(() => buildService()).not.toThrow();
    });

    it('starts without the relay when the URL is not set', () => {
      expect(() => buildService()).not.toThrow();
    });

    it('refuses to start when the URL is set without the secret, naming the missing variable', () => {
      configureEnv({ MAILJET_RELAY_URL: RELAY_URL });

      expect(() => buildService()).toThrow(/MAILJET_RELAY_SECRET/);
    });

    it('still requires the direct Mailjet keys, kept for the fallback', () => {
      configureEnv({
        MAILJET_RELAY_URL: RELAY_URL,
        MAILJET_RELAY_SECRET: RELAY_SECRET,
        MAILJET_PUB: undefined,
      });

      expect(() => buildService()).toThrow(/transactional API keys/);
    });
  });

  describe('sendMail', () => {
    it('sends directly to Mailjet with the transactional keys when no relay is configured', async () => {
      await buildService().sendMail(mailParams);

      expect(fetchMock).not.toHaveBeenCalled();
      expect(mockDirectCalls).toHaveLength(1);
      expect(mockDirectCalls[0]).toMatchObject({
        kind: 'send',
        pub: 'tx-pub',
      });
    });

    it('sends through the relay, without any direct call, with the same body as a direct call', async () => {
      await buildService().sendMail(mailParams);
      const directBody = mockDirectCalls[0].body;
      mockDirectCalls.length = 0;

      withRelay();
      await buildService().sendMail(mailParams);

      expect(mockDirectCalls).toHaveLength(0);
      const call = relayCall();
      expect(call.url).toBe(`${RELAY_URL}/send`);
      expect(call.init.headers).toMatchObject({
        'x-relay-secret': RELAY_SECRET,
      });
      expect(call.body).toEqual(JSON.parse(JSON.stringify(directBody)));
      expect(call.body.Messages[0]).toMatchObject({
        TemplateID: MailjetTemplates.PASSWORD_RESET,
        Subject: 'Reset your password',
        Headers: { 'Reply-To': 'staff@entourage.social' },
      });
    });

    it('completes when the relay answers 2xx', async () => {
      withRelay();

      await expect(buildService().sendMail(mailParams)).resolves.toEqual({
        response: { status: 200 },
        body: { ok: true },
      });
    });

    it.each([
      ['a 4xx', () => relayResponse(400, { ErrorMessage: 'x' }, 'mailjet')],
      ['a 5xx', () => relayResponse(503, { error: 'down' }, 'relay')],
    ])(
      'fails the job on %s from the relay, with no fallback to a direct call',
      async (_label, makeResponse) => {
        withRelay();
        fetchMock.mockResolvedValue(makeResponse());

        await expect(
          buildService().sendMail(mailParams)
        ).rejects.toBeInstanceOf(MailjetRelayError);
        expect(mockDirectCalls).toHaveLength(0);
        expect(fetchMock).toHaveBeenCalledTimes(1);
      }
    );

    it('fails the job when the relay is unreachable, with no fallback to a direct call', async () => {
      withRelay();
      fetchMock.mockRejectedValue(
        Object.assign(new Error('fetch failed'), {
          cause: { code: 'ECONNRESET' },
        })
      );

      await expect(buildService().sendMail(mailParams)).rejects.toMatchObject({
        source: 'network',
      });
      expect(mockDirectCalls).toHaveLength(0);
    });

    it('logs that Mailjet rejected the request when the relay forwards a Mailjet error', async () => {
      withRelay();
      fetchMock.mockResolvedValue(
        relayResponse(400, { ErrorMessage: 'bad template' }, 'mailjet')
      );

      await buildService()
        .sendMail(mailParams)
        .catch((): void => undefined);

      const message = errorLog.mock.calls[0][0] as string;
      expect(message).toContain('Mailjet rejected the request');
      expect(message).not.toContain('relay rejected');
      expect(message).toContain('"source":"mailjet"');
      expect(message).toContain('"statusCode":400');
      expect(message).toContain('bad template');
      expect(message).toContain('user@example.org');
    });

    it('logs that the relay rejected the request, distinct from invalid Mailjet keys', async () => {
      withRelay();
      fetchMock.mockResolvedValue(
        relayResponse(401, { error: 'unauthorized' }, 'relay')
      );

      await buildService()
        .sendMail(mailParams)
        .catch((): void => undefined);

      const message = errorLog.mock.calls[0][0] as string;
      expect(message).toContain('the Mailjet relay rejected the request');
      expect(message).toContain('"source":"relay"');
      expect(message).toContain('"statusCode":401');
    });

    it('never writes the token or OTP values of a failed mail to the logs', async () => {
      withRelay();
      fetchMock.mockResolvedValue(
        relayResponse(400, { ErrorMessage: 'x' }, 'mailjet')
      );

      await buildService()
        .sendMail(mailParams)
        .catch((): void => undefined);

      const message = errorLog.mock.calls[0][0] as string;
      expect(message).toContain('[REDACTED]');
      expect(message).not.toContain('SECRET-TOKEN');
      expect(message).not.toContain('123456');
      expect(message).toContain('Ada');
    });
  });

  describe('contacts', () => {
    const user = {
      email: 'ada@example.org',
      firstName: 'Ada',
      lastName: 'Lovelace',
      gender: 1,
      role: 'Candidat',
      zone: 'IDF',
      OrganizationId: null as string | null,
      companies: [] as unknown[],
      userProfile: { department: 'Paris (75)' },
    };

    it('creates a contact directly with the newsletter keys when no relay is configured', async () => {
      await buildService().createContact({
        email: 'a@b.c',
        source: MailjetContactSource.SITE_EP,
      });

      expect(fetchMock).not.toHaveBeenCalled();
      expect(mockDirectCalls[0]).toMatchObject({
        kind: 'contact',
        pub: 'nl-pub',
        listId: LIST_ID,
      });
    });

    it('creates a contact through the relay with the list id and the contact body', async () => {
      withRelay();

      await buildService().createContact({
        email: 'a@b.c',
        source: MailjetContactSource.SITE_EP,
      });

      expect(mockDirectCalls).toHaveLength(0);
      const call = relayCall();
      expect(call.url).toBe(`${RELAY_URL}/contacts`);
      expect(call.body.listId).toBe(LIST_ID);
      expect(call.body.body).toMatchObject({
        Email: 'a@b.c',
        Properties: { source: MailjetContactSource.SITE_EP },
      });
    });

    it('creates the contact of a user through the relay with the body built from the user', async () => {
      withRelay();
      const service = buildService({
        findOne: jest.fn().mockResolvedValue(user),
      });

      await service.createContactForUser(
        'user-id',
        MailjetContactSource.BACKOFFICE_EP
      );

      expect(mockDirectCalls).toHaveLength(0);
      const call = relayCall();
      expect(call.url).toBe(`${RELAY_URL}/contacts`);
      expect(call.body.listId).toBe(LIST_ID);
      expect(call.body.body).toMatchObject({
        Email: 'ada@example.org',
        Name: 'Ada Lovelace',
        Properties: { first_name: 'Ada', last_name: 'Lovelace' },
      });
    });

    it('fails the contact call when the relay rejects, and says where the failure comes from', async () => {
      withRelay();
      fetchMock.mockResolvedValue(
        relayResponse(400, { ErrorMessage: 'bad contact' }, 'mailjet')
      );

      await expect(
        buildService().createContact({
          email: 'a@b.c',
          source: MailjetContactSource.SITE_EP,
        })
      ).rejects.toBeInstanceOf(MailjetRelayError);

      expect(mockDirectCalls).toHaveLength(0);
      expect(errorLog.mock.calls[0][0]).toContain(
        'Mailjet rejected the request'
      );
    });
  });

  describe('proxy removal', () => {
    it('ignores FIXIE_URL: only the two direct clients are built, with no proxy option', () => {
      configureEnv({ FIXIE_URL: 'http://user:pass@proxy.example.org:8080' });

      buildService();

      expect(mockApiConnect).toHaveBeenCalledTimes(2);
      mockApiConnect.mock.calls.forEach((args) => {
        expect(args).toHaveLength(2);
      });
    });

    it('logs and propagates a connection reset in direct mode, without a second attempt', async () => {
      configureEnv({ FIXIE_URL: 'http://user:pass@proxy.example.org:8080' });
      mockDirectError = Object.assign(new Error('socket hang up'), {
        code: 'ECONNRESET',
      });

      await expect(buildService().sendMail(mailParams)).rejects.toBe(
        mockDirectError
      );

      expect(mockDirectCalls).toHaveLength(1);
      expect(fetchMock).not.toHaveBeenCalled();
      expect(errorLog.mock.calls[0][0]).toContain(
        'direct call to Mailjet failed'
      );
    });
  });
});
