import { createLink } from '@short.io/client-node';
import { AnthropicService } from 'src/external-services/anthropic/anthropic.service';
import { LlmMetricsService } from 'src/external-services/llm-metrics/llm-metrics.service';
import { AiFeature } from 'src/external-services/llm-observability/ai-feature.enum';
import { ShortioService } from 'src/external-services/shortio/shortio.service';
import { Jobs } from 'src/queues/queues.types';
import { SmsService } from 'src/sms/sms.service';
import { tracer } from 'src/tracer';
import { UserRoles } from 'src/users/users.types';

// Pure unit tests (no database, no network): every third party SDK is mocked.
jest.mock('@short.io/client-node', () => ({
  createLink: jest.fn(),
  setApiKey: jest.fn(),
}));

const mockMessagesCreate = jest.fn();
const mockMessagesStream = jest.fn();
jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    messages: { create: mockMessagesCreate, stream: mockMessagesStream },
  })),
}));

jest.mock('src/tracer', () => ({
  tracer: { dogstatsd: { increment: jest.fn(), flush: jest.fn() } },
}));

describe('ShortioService', () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env.SHORTIO_DOMAIN = 'short.invalid';
    process.env.SHORTIO_API_KEY = 'api-key';
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.env = { ...envBackup };
    jest.restoreAllMocks();
    (createLink as jest.Mock).mockReset();
  });

  it('refuses to start when Short.io is not configured', () => {
    delete process.env.SHORTIO_API_KEY;
    expect(() => new ShortioService()).toThrow('Short.io is not configured');
    process.env.SHORTIO_API_KEY = 'api-key';
    delete process.env.SHORTIO_DOMAIN;
    expect(() => new ShortioService()).toThrow('Short.io is not configured');
  });

  it('returns the short URL created by Short.io', async () => {
    (createLink as jest.Mock).mockResolvedValue({
      data: { shortURL: 'https://short.invalid/abc' },
    });

    const shortUrl = await new ShortioService().shortenUrl(
      'https://long.invalid'
    );

    expect(shortUrl).toBe('https://short.invalid/abc');
    expect(createLink).toHaveBeenCalledWith({
      body: { originalURL: 'https://long.invalid', domain: 'short.invalid' },
    });
  });

  it('fails when the API answers without short URL', async () => {
    (createLink as jest.Mock).mockResolvedValue({ data: {} });

    await expect(
      new ShortioService().shortenUrl('https://long.invalid')
    ).rejects.toThrow(
      'Failed to shorten URL: Invalid response from Short.io API'
    );
  });

  it('wraps the errors of the client, error instance or not', async () => {
    const service = new ShortioService();
    (createLink as jest.Mock).mockRejectedValueOnce(new Error('timeout'));
    await expect(service.shortenUrl('https://a.invalid')).rejects.toThrow(
      'Failed to shorten URL: timeout'
    );

    (createLink as jest.Mock).mockRejectedValueOnce('plain string failure');
    await expect(service.shortenUrl('https://a.invalid')).rejects.toThrow(
      'Failed to shorten URL: plain string failure'
    );
  });
});

describe('LlmMetricsService', () => {
  const increment = tracer.dogstatsd.increment as jest.Mock;
  const flush = tracer.dogstatsd.flush as jest.Mock;
  const service = new LlmMetricsService();

  beforeEach(() => {
    increment.mockClear();
    flush.mockClear();
  });

  it('records the Anthropic tokens including cache reads and writes', () => {
    service.recordAnthropicUsage(
      'model-a',
      {
        input_tokens: 10,
        output_tokens: 5,
        cache_read_input_tokens: 3,
        cache_creation_input_tokens: 2,
      } as never,
      'classify',
      AiFeature.AI_ASSISTANT
    );

    const tags = {
      model: 'model-a',
      provider: 'anthropic',
      operation: 'classify',
      feature: 'ai_assistant',
    };
    expect(increment).toHaveBeenCalledWith('ai.tokens.input', 10, tags);
    expect(increment).toHaveBeenCalledWith('ai.tokens.output', 5, tags);
    expect(increment).toHaveBeenCalledWith('ai.tokens.cache_read', 3, tags);
    expect(increment).toHaveBeenCalledWith('ai.tokens.cache_write', 2, tags);
    expect(flush).toHaveBeenCalledTimes(1);
  });

  it('skips the cache metrics when there is no cache usage', () => {
    service.recordAnthropicUsage(
      'model-a',
      { input_tokens: 1, output_tokens: 1 } as never,
      'op',
      AiFeature.AI_ASSISTANT
    );

    expect(increment).toHaveBeenCalledTimes(2);
  });

  it('records the OpenAI tokens', () => {
    service.recordOpenAiUsage(
      'gpt',
      { prompt_tokens: 7, completion_tokens: 4 } as never,
      'op',
      AiFeature.AI_ASSISTANT
    );

    expect(increment).toHaveBeenCalledWith(
      'ai.tokens.input',
      7,
      expect.objectContaining({ provider: 'openai' })
    );
    expect(increment).toHaveBeenCalledWith(
      'ai.tokens.output',
      4,
      expect.objectContaining({ provider: 'openai' })
    );
    expect(flush).toHaveBeenCalled();
  });

  it('records the VoyageAI tokens, defaulting to zero', () => {
    service.recordVoyageAiUsage(
      'voyage',
      { totalTokens: 9 } as never,
      'op',
      AiFeature.AI_ASSISTANT
    );
    service.recordVoyageAiUsage('voyage', {} as never, 'op', 'feat');

    expect(increment).toHaveBeenNthCalledWith(
      1,
      'ai.tokens.input',
      9,
      expect.objectContaining({ provider: 'voyageai' })
    );
    expect(increment).toHaveBeenNthCalledWith(
      2,
      'ai.tokens.input',
      0,
      expect.anything()
    );
  });
});

describe('AnthropicService', () => {
  const llmMetrics = { recordAnthropicUsage: jest.fn() };
  const buildService = () =>
    new AnthropicService(llmMetrics as unknown as LlmMetricsService);

  beforeEach(() => {
    mockMessagesCreate.mockReset();
    mockMessagesStream.mockReset();
    llmMetrics.recordAnthropicUsage.mockReset();
  });

  it('createStream asks the SDK for a streamed answer with the system blocks', () => {
    mockMessagesStream.mockReturnValue('stream');
    const system = [{ type: 'text', text: 'sys' }] as never;
    const messages = [{ role: 'user', content: 'hi' }] as never;

    expect(buildService().createStream(system, messages)).toBe('stream');
    expect(mockMessagesStream).toHaveBeenCalledWith(
      expect.objectContaining({ max_tokens: 4096, system, messages })
    );
  });

  it('generateText returns the text block and records the usage with default options', async () => {
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'ESCALATE' }],
      usage: { input_tokens: 1, output_tokens: 1 },
    });

    const text = await buildService().generateText('system', 'user');

    expect(text).toBe('ESCALATE');
    expect(mockMessagesCreate).toHaveBeenCalledWith(
      expect.objectContaining({ max_tokens: 5 }),
      undefined
    );
    expect(llmMetrics.recordAnthropicUsage).toHaveBeenCalledWith(
      'claude-haiku-4-5-20251001',
      { input_tokens: 1, output_tokens: 1 },
      'classify',
      'ai_assistant'
    );
  });

  it('generateText disables the retries when a timeout is set and returns an empty string for non text blocks', async () => {
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'tool_use' }],
      usage: {},
    });

    const text = await buildService().generateText('system', 'user', {
      timeoutMs: 1500,
      maxTokens: 50,
      operation: 'summarize',
      feature: AiFeature.PRESENTATION_GENERATION,
    });

    expect(text).toBe('');
    expect(mockMessagesCreate).toHaveBeenCalledWith(
      expect.objectContaining({ max_tokens: 50 }),
      { timeout: 1500, maxRetries: 0 }
    );
    expect(llmMetrics.recordAnthropicUsage).toHaveBeenCalledWith(
      expect.any(String),
      {},
      'summarize',
      AiFeature.PRESENTATION_GENERATION
    );
  });
});

describe('SmsService', () => {
  const envBackup = { ...process.env };
  const queuesService = { addToWorkQueue: jest.fn() };
  const shortioService = { shortenUrl: jest.fn() };

  beforeEach(() => {
    process.env.FRONT_URL = 'https://front.invalid';
    queuesService.addToWorkQueue.mockReset().mockResolvedValue({ id: 'job-1' });
    shortioService.shortenUrl
      .mockReset()
      .mockResolvedValue('https://s.invalid/x');
    (tracer.dogstatsd.increment as jest.Mock).mockClear();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.env = { ...envBackup };
    jest.restoreAllMocks();
  });

  it.each([
    [UserRoles.CANDIDATE, UserRoles.COACH, 'candidate'],
    [UserRoles.COACH, UserRoles.CANDIDATE, 'coach'],
  ] as const)(
    'queues a reminder to a %s mentioning the %s sender',
    async (recipientRole, senderRole, metricTag) => {
      const service = new SmsService(
        queuesService as never,
        shortioService as never
      );

      const result = await service.sendUnansweredConversationSms(
        '+33600000000',
        recipientRole,
        'Alice',
        'sender-1'
      );

      expect(result).toEqual({ id: 'job-1' });
      expect(shortioService.shortenUrl).toHaveBeenCalledWith(
        'https://front.invalid/backoffice/messaging?userId=sender-1'
      );
      expect(queuesService.addToWorkQueue).toHaveBeenCalledWith(Jobs.SEND_SMS, {
        to: '+33600000000',
        text: `Alice, ${senderRole} sur Entourage Pro, vous a envoyé un message. Répondre à son message : https://s.invalid/x`,
      });
      expect(tracer.dogstatsd.increment).toHaveBeenCalledWith(
        'sms.reminder.sent',
        1,
        { role: metricTag }
      );
    }
  );

  it('does not queue anything when the URL cannot be shortened', async () => {
    shortioService.shortenUrl.mockRejectedValue(new Error('short.io down'));
    const service = new SmsService(
      queuesService as never,
      shortioService as never
    );

    await expect(
      service.sendUnansweredConversationSms(
        '+33600000000',
        UserRoles.COACH,
        'Alice',
        'sender-1'
      )
    ).rejects.toThrow('short.io down');
    expect(queuesService.addToWorkQueue).not.toHaveBeenCalled();
  });
});
