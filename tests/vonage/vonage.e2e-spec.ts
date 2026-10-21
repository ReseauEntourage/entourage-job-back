import { VonageService } from 'src/external-services/vonage/vonage.service';

const mockSend = jest.fn();
const mockVonageConstructor = jest.fn();

// The Vonage SDK is mocked: no SMS is ever sent for real.
jest.mock('@vonage/server-sdk', () => ({
  Vonage: jest.fn().mockImplementation((...args: unknown[]) => {
    mockVonageConstructor(...args);
    return { messages: { send: mockSend } };
  }),
}));
jest.mock('@vonage/messages', () => ({ Channels: { SMS: 'sms' } }));

describe('VonageService', () => {
  const savedEnv = {
    key: process.env.VONAGE_API_KEY,
    secret: process.env.VONAGE_API_SECRET,
  };

  const restore = (name: string, value: string | undefined) => {
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  };

  beforeEach(() => {
    process.env.VONAGE_API_KEY = 'key';
    process.env.VONAGE_API_SECRET = 'secret';
    mockSend.mockReset();
    mockVonageConstructor.mockReset();
  });

  afterAll(() => {
    restore('VONAGE_API_KEY', savedEnv.key);
    restore('VONAGE_API_SECRET', savedEnv.secret);
  });

  it('creates the Vonage client with the credentials of the environment', () => {
    new VonageService();

    expect(mockVonageConstructor).toHaveBeenCalledWith({
      apiKey: 'key',
      apiSecret: 'secret',
    });
  });

  it.each([
    ['API key', 'VONAGE_API_KEY'],
    ['API secret', 'VONAGE_API_SECRET'],
  ])('refuses to start without the %s', (_label, variable) => {
    delete process.env[variable];

    expect(() => new VonageService()).toThrow(
      'Vonage API credentials are not set'
    );
  });

  it('sends the text as an SMS from Entourage with a normalized phone number', async () => {
    mockSend.mockResolvedValue({ messageUUID: 'uuid-1' });
    const service = new VonageService();

    await service.sendSms('+33 6 12 34 56 78', 'Hello there');

    expect(mockSend).toHaveBeenCalledWith({
      messageType: 'text',
      channel: 'sms',
      text: 'Hello there',
      to: '33612345678',
      from: 'Entourage',
    });
  });

  it('rethrows the Vonage error so that the job can be retried', async () => {
    const error = Object.assign(new Error('Unauthorized'), {
      code: 'ERR_UNAUTHORIZED',
      response: { status: 401 },
    });
    mockSend.mockRejectedValue(error);
    const service = new VonageService();

    await expect(service.sendSms('+33612345678', 'Hello')).rejects.toBe(error);
  });

  it('rethrows an error that carries no details', async () => {
    mockSend.mockRejectedValue({});
    const service = new VonageService();

    await expect(service.sendSms('+33612345678', 'Hello')).rejects.toEqual({});
  });
});
