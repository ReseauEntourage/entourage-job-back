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
const mockPost = jest.fn();
jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    messages: { create: mockMessagesCreate, stream: mockMessagesStream },
    post: mockPost,
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
    mockPost.mockReset();
    llmMetrics.recordAnthropicUsage.mockReset();
  });

  describe('createMessageUntraced', () => {
    it('posts the request to the messages endpoint, not through messages.create', async () => {
      // Datadog's automatic LLM span only wraps `messages.create`
      mockPost.mockResolvedValue({ id: 'msg_1' });
      const body = { model: 'm', max_tokens: 10, messages: [] } as never;
      const signal = new AbortController().signal;

      const message = await buildService().createMessageUntraced(body, {
        signal,
      });

      expect(message).toEqual({ id: 'msg_1' });
      expect(mockPost).toHaveBeenCalledWith('/v1/messages', { body, signal });
      expect(mockMessagesCreate).not.toHaveBeenCalled();
    });

    it('lets the errors of the SDK through', async () => {
      mockPost.mockRejectedValue(new Error('rate limited'));

      await expect(
        buildService().createMessageUntraced({} as never)
      ).rejects.toThrow('rate limited');
    });
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

  describe('model of each usage', () => {
    const envBackup = { ...process.env };

    afterEach(() => {
      process.env = { ...envBackup };
    });

    it('streams the assistant answer with the assistant model of the setting', () => {
      mockMessagesStream.mockReturnValue('stream');
      process.env.AI_MODEL_AI_ASSISTANT = 'claude-sonnet-5-5';

      buildService().createStream([], []);

      expect(mockMessagesStream).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'claude-sonnet-5-5' })
      );
    });

    it('streams the assistant answer with the default model without a setting', () => {
      mockMessagesStream.mockReturnValue('stream');
      delete process.env.AI_MODEL_AI_ASSISTANT;

      buildService().createStream([], []);

      expect(mockMessagesStream).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'claude-sonnet-4-6' })
      );
    });

    it('classifies with the classifier model of the setting by default, and records that model', async () => {
      mockMessagesCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'NON' }],
        usage: { input_tokens: 1, output_tokens: 1 },
      });
      process.env.AI_MODEL_AI_ASSISTANT_CLASSIFIER = 'claude-haiku-5-5';

      await buildService().generateText('system', 'user');

      expect(mockMessagesCreate).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'claude-haiku-5-5' }),
        undefined
      );
      expect(llmMetrics.recordAnthropicUsage).toHaveBeenCalledWith(
        'claude-haiku-5-5',
        expect.anything(),
        'classify',
        'ai_assistant'
      );
    });

    it('calls the model given by the caller, and records that model', async () => {
      mockMessagesCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'text' }],
        usage: { input_tokens: 1, output_tokens: 1 },
      });
      process.env.AI_MODEL_AI_ASSISTANT_CLASSIFIER = 'claude-haiku-5-5';

      await buildService().generateText('system', 'user', {
        model: 'claude-sonnet-5-5',
      });

      expect(mockMessagesCreate).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'claude-sonnet-5-5' }),
        undefined
      );
      expect(llmMetrics.recordAnthropicUsage).toHaveBeenCalledWith(
        'claude-sonnet-5-5',
        expect.anything(),
        expect.any(String),
        expect.any(String)
      );
    });
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

  describe('generateStructured', () => {
    const schema = { type: 'object' };
    const options = {
      maxTokens: 100,
      timeoutMs: 5000,
      operation: 'generate',
      feature: AiFeature.HELP_GROUPS_TITLE,
    };

    it('asks for the JSON schema, disables the retries, records the usage and returns the parsed JSON', async () => {
      mockMessagesCreate.mockResolvedValue({
        content: [{ type: 'text', text: '{"title":"Mon titre"}' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 3, output_tokens: 7 },
      });

      const result = await buildService().generateStructured(
        'system',
        'user',
        schema,
        options
      );

      expect(result).toEqual({ title: 'Mon titre' });
      expect(mockMessagesCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          max_tokens: 100,
          system: 'system',
          messages: [{ role: 'user', content: 'user' }],
          output_config: { format: { type: 'json_schema', schema } },
        }),
        { timeout: 5000, maxRetries: 0 }
      );
      expect(llmMetrics.recordAnthropicUsage).toHaveBeenCalledWith(
        'claude-haiku-4-5-20251001',
        { input_tokens: 3, output_tokens: 7 },
        'generate',
        'help_groups_title'
      );
    });

    describe('model', () => {
      const envBackup = { ...process.env };
      const answer = {
        content: [{ type: 'text', text: '{"title":"Mon titre"}' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 1, output_tokens: 1 },
      };

      afterEach(() => {
        process.env = { ...envBackup };
      });

      it('calls the model given by the caller, and records that model', async () => {
        mockMessagesCreate.mockResolvedValue(answer);

        await buildService().generateStructured('system', 'user', schema, {
          ...options,
          model: 'claude-haiku-5-5',
        });

        expect(mockMessagesCreate).toHaveBeenCalledWith(
          expect.objectContaining({ model: 'claude-haiku-5-5' }),
          expect.anything()
        );
        expect(llmMetrics.recordAnthropicUsage).toHaveBeenCalledWith(
          'claude-haiku-5-5',
          expect.anything(),
          'generate',
          'help_groups_title'
        );
      });

      it('defaults to the model of the classifier setting', async () => {
        mockMessagesCreate.mockResolvedValue(answer);
        process.env.AI_MODEL_AI_ASSISTANT_CLASSIFIER = 'claude-haiku-5-5';

        await buildService().generateStructured(
          'system',
          'user',
          schema,
          options
        );

        expect(mockMessagesCreate).toHaveBeenCalledWith(
          expect.objectContaining({ model: 'claude-haiku-5-5' }),
          expect.anything()
        );
      });
    });

    it('rejects an invalid JSON answer', async () => {
      mockMessagesCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Je suis ravi de votre enthousiasme' }],
        stop_reason: 'end_turn',
        usage: {},
      });

      await expect(
        buildService().generateStructured('system', 'user', schema, options)
      ).rejects.toThrow();
    });

    it('rejects an answer cut by max_tokens', async () => {
      mockMessagesCreate.mockResolvedValue({
        content: [{ type: 'text', text: '{"title":"Mon ti' }],
        stop_reason: 'max_tokens',
        usage: {},
      });

      await expect(
        buildService().generateStructured('system', 'user', schema, options)
      ).rejects.toThrow('truncated');
    });

    it('rejects a non text block', async () => {
      mockMessagesCreate.mockResolvedValue({
        content: [{ type: 'tool_use' }],
        stop_reason: 'end_turn',
        usage: {},
      });

      await expect(
        buildService().generateStructured('system', 'user', schema, options)
      ).rejects.toThrow('text block');
    });

    it('propagates the SDK errors, timeouts included', async () => {
      mockMessagesCreate.mockRejectedValue(new Error('timeout'));

      await expect(
        buildService().generateStructured('system', 'user', schema, options)
      ).rejects.toThrow('timeout');
    });
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
