import { CvExtractionService } from 'src/external-services/cv-extraction/cv-extraction.service';

describe('CvExtractionService.extractCVFromImages', () => {
  const anthropic = { createMessageUntraced: jest.fn() };
  const llmMetrics = { recordAnthropicUsage: jest.fn() };
  const savedEnv = { ...process.env };

  const build = () => ({
    service: new CvExtractionService(anthropic as never, llmMetrics as never),
    create: anthropic.createMessageUntraced,
  });

  const structuredResponse = (
    data: unknown,
    extra: Record<string, unknown> = {}
  ) => ({
    stop_reason: 'end_turn',
    content: [{ type: 'text', text: JSON.stringify(data) }],
    usage: { input_tokens: 10, output_tokens: 5 },
    ...extra,
  });

  beforeEach(() => {
    anthropic.createMessageUntraced.mockReset();
    llmMetrics.recordAnthropicUsage.mockReset();
    delete process.env.CV_EXTRACTION_MAX_TOKENS;
    delete process.env.AI_EFFORT_CV_EXTRACTION;
    delete process.env.AI_MODEL_CV_EXTRACTION;
    delete process.env.CV_EXTRACTION_TWO_PASSES;
  });

  afterAll(() => {
    process.env = { ...savedEnv };
  });

  it('sends every page as an image and asks for the extraction schema', async () => {
    const { service, create } = build();
    create.mockResolvedValue(structuredResponse({ description: 'A cook' }));
    const signal = new AbortController().signal;

    const result = await service.extractCVFromImages(
      ['page1', 'page2'],
      signal
    );

    expect(result).toEqual({
      data: { description: 'A cook' },
      transcript: null,
    });
    const [body, options] = create.mock.calls[0];
    expect(options).toEqual({ signal });
    expect(body.model).toBe('claude-sonnet-5-5');
    expect(body.max_tokens).toBe(8192);
    expect(body.output_config.effort).toBe('medium');
    expect(body.output_config.format.type).toBe('json_schema');
    // No forced tool: the structured output is the way to get JSON back
    expect(body).not.toHaveProperty('tool_choice');
    expect(body).not.toHaveProperty('tools');
    const content = body.messages[0].content;
    expect(content.filter((c: { type: string }) => c.type === 'image')).toEqual(
      [
        {
          type: 'image',
          source: { type: 'base64', media_type: 'image/png', data: 'page1' },
        },
        {
          type: 'image',
          source: { type: 'base64', media_type: 'image/png', data: 'page2' },
        },
      ]
    );
    // The pages come before the instruction
    expect(content[content.length - 1].type).toBe('text');
  });

  it('sends a schema that Anthropic accepts', async () => {
    const { service, create } = build();
    create.mockResolvedValue(structuredResponse({}));

    await service.extractCVFromImages(['p']);

    const schema = create.mock.calls[0][0].output_config.format.schema;
    const serialized = JSON.stringify(schema);
    // Constraints that are not supported are moved into the descriptions
    expect(serialized).not.toContain('"maxLength"');
    expect(serialized).not.toContain('"maxItems"');
    expect(schema.additionalProperties).toBe(false);
    // The lists are required so that the schema has at most 24 optional properties
    expect(schema.required).toEqual(
      expect.arrayContaining([
        'skills',
        'experiences',
        'formations',
        'languages',
        'interests',
      ])
    );
    const optionalCount = (function count(node: {
      properties?: Record<string, unknown>;
      required?: string[];
      items?: unknown;
    }): number {
      let total = 0;
      if (node.properties) {
        const required = new Set(node.required ?? []);
        for (const [key, child] of Object.entries(node.properties)) {
          total += required.has(key) ? 0 : 1;
          total += count(child as never);
        }
      }
      if (node.items) {
        total += count(node.items as never);
      }
      return total;
    })(schema);
    expect(optionalCount).toBeLessThanOrEqual(24);
  });

  it('lets the environment set the output token limit', async () => {
    process.env.CV_EXTRACTION_MAX_TOKENS = '1000';
    const { service, create } = build();
    create.mockResolvedValue(structuredResponse({}));

    await service.extractCVFromImages(['p']);

    expect(create.mock.calls[0][0].max_tokens).toBe(1000);
  });

  it('lets the environment set the model and the effort', async () => {
    process.env.AI_MODEL_CV_EXTRACTION = 'claude-haiku-5-5';
    process.env.AI_EFFORT_CV_EXTRACTION = 'high';
    const { service, create } = build();
    create.mockResolvedValue(structuredResponse({}));

    await service.extractCVFromImages(['p']);

    expect(create.mock.calls[0][0].model).toBe('claude-haiku-5-5');
    expect(create.mock.calls[0][0].output_config.effort).toBe('high');
  });

  it('records the token usage', async () => {
    const { service, create } = build();
    const usage = { input_tokens: 10, output_tokens: 5 };
    create.mockResolvedValue(structuredResponse({}, { usage }));

    await service.extractCVFromImages(['p']);

    expect(llmMetrics.recordAnthropicUsage).toHaveBeenCalledWith(
      'claude-sonnet-5-5',
      usage,
      'cv_extraction',
      'cv_extraction'
    );
  });

  it('explains that the answer was cut when the token limit was reached', async () => {
    const { service, create } = build();
    create.mockResolvedValue({
      stop_reason: 'max_tokens',
      content: [{ type: 'text', text: '{"description":' }],
      usage: { input_tokens: 10, output_tokens: 8192 },
    });

    await expect(service.extractCVFromImages(['p'])).rejects.toThrow(
      /limite de tokens \(stop_reason=max_tokens\)/
    );
  });

  it('fails when the model refused to answer', async () => {
    const { service, create } = build();
    create.mockResolvedValue({
      stop_reason: 'refusal',
      stop_details: { type: 'refusal', category: null },
      content: [],
      usage: { input_tokens: 10, output_tokens: 0 },
    });

    await expect(service.extractCVFromImages(['p'])).rejects.toThrow(
      /stop_reason=refusal/
    );
  });

  it('fails when the answer has no text', async () => {
    const { service, create } = build();
    create.mockResolvedValue({
      stop_reason: 'end_turn',
      content: [],
      usage: { input_tokens: 10, output_tokens: 0 },
    });

    await expect(service.extractCVFromImages(['p'])).rejects.toThrow(
      /Aucun contenu structuré/
    );
  });

  it('ignores the thinking blocks of the answer', async () => {
    const { service, create } = build();
    create.mockResolvedValue({
      stop_reason: 'end_turn',
      content: [
        { type: 'thinking', thinking: 'hmm' },
        { type: 'text', text: '{"description":"A cook"}' },
      ],
      usage: { input_tokens: 10, output_tokens: 5 },
    });

    const result = await service.extractCVFromImages(['p']);

    expect(result.data).toEqual({ description: 'A cook' });
  });

  it('fails when the response has no usage and no content', async () => {
    const { service, create } = build();
    create.mockResolvedValue({ stop_reason: 'end_turn', content: [] });

    await expect(service.extractCVFromImages(['p'])).rejects.toThrow(
      /Impossible d'extraire les données du CV/
    );
  });

  it('fails when the answer is not valid JSON', async () => {
    const { service, create } = build();
    create.mockResolvedValue({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: '{oops' }],
      usage: { input_tokens: 10, output_tokens: 5 },
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
