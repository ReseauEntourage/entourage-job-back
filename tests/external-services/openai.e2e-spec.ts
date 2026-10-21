import { OpenAiService } from 'src/external-services/openai/openai.service';

// `openai` is replaced by a double for the whole e2e suite (see tests/setup.ts)
type OpenAiDouble = { chat: { completions: { create: jest.Mock } } };

describe('OpenAiService.extractCVFromImages', () => {
  const llmMetrics = { recordOpenAiUsage: jest.fn() };
  const savedMaxTokens = process.env.OPENAI_MAX_COMPLETION_TOKENS;

  const build = () => {
    const service = new OpenAiService(llmMetrics as never);
    const create = (service as unknown as { openai: OpenAiDouble }).openai.chat
      .completions.create;
    return { service, create };
  };

  const toolCallResponse = (
    args: unknown,
    extra: Record<string, unknown> = {}
  ) => ({
    choices: [
      {
        finish_reason: 'stop',
        message: {
          tool_calls: [
            {
              type: 'function',
              function: {
                name: 'extract_cv_data',
                arguments: JSON.stringify(args),
              },
            },
          ],
        },
      },
    ],
    ...extra,
  });

  beforeEach(() => {
    llmMetrics.recordOpenAiUsage.mockReset();
    delete process.env.OPENAI_MAX_COMPLETION_TOKENS;
  });

  afterAll(() => {
    if (savedMaxTokens === undefined) {
      delete process.env.OPENAI_MAX_COMPLETION_TOKENS;
    } else {
      process.env.OPENAI_MAX_COMPLETION_TOKENS = savedMaxTokens;
    }
  });

  it('sends every page as an image and forces the extraction tool', async () => {
    const { service, create } = build();
    create.mockResolvedValue(toolCallResponse({ description: 'A cook' }));
    const signal = new AbortController().signal;

    const result = await service.extractCVFromImages(
      ['page1', 'page2'],
      signal
    );

    expect(result).toEqual({ description: 'A cook' });
    const [body, options] = create.mock.calls[0];
    expect(options).toEqual({ signal });
    expect(body.tool_choice).toEqual({
      type: 'function',
      function: { name: 'extract_cv_data' },
    });
    expect(body.max_completion_tokens).toBe(4096);
    const userContent = body.messages[1].content;
    expect(
      userContent.filter((c: { type: string }) => c.type === 'image_url')
    ).toEqual([
      { type: 'image_url', image_url: { url: 'data:image/png;base64,page1' } },
      { type: 'image_url', image_url: { url: 'data:image/png;base64,page2' } },
    ]);
  });

  it('lets the environment set the completion token limit', async () => {
    process.env.OPENAI_MAX_COMPLETION_TOKENS = '1000';
    const { service, create } = build();
    create.mockResolvedValue(toolCallResponse({}));

    await service.extractCVFromImages(['p']);

    expect(create.mock.calls[0][0].max_completion_tokens).toBe(1000);
  });

  it('records the token usage when the API reports it', async () => {
    const { service, create } = build();
    const usage = { prompt_tokens: 10, completion_tokens: 5 };
    create.mockResolvedValue(toolCallResponse({}, { usage }));

    await service.extractCVFromImages(['p']);

    expect(llmMetrics.recordOpenAiUsage).toHaveBeenCalledWith(
      'o4-mini-2025-04-16',
      usage,
      'cv_extraction',
      'cv_extraction'
    );
  });

  it('explains that the answer was cut when the token limit was reached', async () => {
    const { service, create } = build();
    create.mockResolvedValue({
      choices: [{ finish_reason: 'length', message: {} }],
      usage: { total_tokens: 4096 },
    });

    await expect(service.extractCVFromImages(['p'])).rejects.toThrow(
      /limite de tokens \(finish_reason=length\)/
    );
  });

  it('fails when the model did not call the tool', async () => {
    const { service, create } = build();
    create.mockResolvedValue({
      choices: [{ finish_reason: 'stop', message: { tool_calls: [] } }],
    });

    await expect(service.extractCVFromImages(['p'])).rejects.toThrow(
      /Aucun tool_call/
    );
  });

  it('fails when the response has no choice at all', async () => {
    const { service, create } = build();
    create.mockResolvedValue({});

    await expect(service.extractCVFromImages(['p'])).rejects.toThrow(
      /Impossible d'extraire les données du CV/
    );
  });

  it('fails when the tool arguments are not valid JSON', async () => {
    const { service, create } = build();
    create.mockResolvedValue({
      choices: [
        {
          finish_reason: 'stop',
          message: {
            tool_calls: [
              { type: 'function', function: { arguments: '{oops' } },
            ],
          },
        },
      ],
    });

    await expect(service.extractCVFromImages(['p'])).rejects.toThrow(
      /Impossible d'extraire les données du CV/
    );
  });

  it('wraps the API errors', async () => {
    const { service, create } = build();
    create.mockRejectedValue(new Error('rate limited'));

    await expect(service.extractCVFromImages(['p'])).rejects.toThrow(
      "Impossible d'extraire les données du CV à partir d'images: rate limited"
    );
  });

  it('wraps an abort as a regular failure', async () => {
    const { service, create } = build();
    const controller = new AbortController();
    controller.abort();
    create.mockRejectedValue(new Error('aborted'));

    await expect(
      service.extractCVFromImages(['p'], controller.signal)
    ).rejects.toThrow('aborted');
  });

  it('wraps a failure that is not an Error', async () => {
    const { service, create } = build();
    create.mockRejectedValue('weird');

    await expect(service.extractCVFromImages(['p'])).rejects.toThrow(
      "à partir d'images: weird"
    );
  });
});
