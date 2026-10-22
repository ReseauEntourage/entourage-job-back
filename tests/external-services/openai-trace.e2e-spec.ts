import { OpenAiService } from 'src/external-services/openai/openai.service';
import { tracer } from 'src/tracer';

// Pure unit tests (no database, no network): the Datadog tracer is mocked, and
// `openai` is replaced by a double for the whole e2e suite (tests/setup.ts)
jest.mock('src/tracer', () => ({
  tracer: { llmobs: { trace: jest.fn(), annotate: jest.fn() } },
}));

type OpenAiDouble = { chat: { completions: { create: jest.Mock } } };

const span = { name: 'llm-span' };
const trace = tracer.llmobs.trace as jest.Mock;
const annotate = tracer.llmobs.annotate as jest.Mock;

describe('OpenAiService.extractCVFromImages - LLM Observability trace', () => {
  const llmMetrics = { recordOpenAiUsage: jest.fn() };
  const saved = {
    enabled: process.env.LLM_OBS_CV_IMAGES_ENABLED,
    maxBytes: process.env.LLM_OBS_CV_IMAGES_MAX_BYTES,
  };

  const build = () => {
    const service = new OpenAiService(llmMetrics as never);
    const create = (service as unknown as { openai: OpenAiDouble }).openai.chat
      .completions.create;
    return { service, create };
  };

  const toolCallResponse = (extra: Record<string, unknown> = {}) => ({
    choices: [
      {
        finish_reason: 'stop',
        message: {
          tool_calls: [
            {
              type: 'function',
              function: {
                name: 'extract_cv_data',
                arguments: '{"description":"A cook"}',
              },
            },
          ],
        },
      },
    ],
    ...extra,
  });

  type TracedMessage = {
    role: string;
    content: string;
    imageParts?: unknown[];
  };
  type Annotations = {
    inputData: TracedMessage[];
    outputData?: unknown;
    metrics?: unknown;
    metadata?: unknown;
  };

  /** Merges every annotation made on the llm span, as Datadog does. */
  const annotations = (): Annotations =>
    annotate.mock.calls.reduce((merged, [calledSpan, options]) => {
      expect(calledSpan).toBe(span);
      return { ...merged, ...options };
    }, {} as Annotations);

  const restore = (key: string, value: string | undefined) => {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  };

  beforeEach(() => {
    trace.mockReset().mockImplementation((_options, fn) => fn(span));
    annotate.mockReset();
    llmMetrics.recordOpenAiUsage.mockReset();
    delete process.env.LLM_OBS_CV_IMAGES_ENABLED;
    delete process.env.LLM_OBS_CV_IMAGES_MAX_BYTES;
  });

  afterAll(() => {
    restore('LLM_OBS_CV_IMAGES_ENABLED', saved.enabled);
    restore('LLM_OBS_CV_IMAGES_MAX_BYTES', saved.maxBytes);
  });

  it('opens an llm span for the model and the provider of the call', async () => {
    const { service, create } = build();
    create.mockResolvedValue(toolCallResponse());

    await service.extractCVFromImages(['p1']);

    expect(trace).toHaveBeenCalledTimes(1);
    expect(trace).toHaveBeenCalledWith(
      {
        kind: 'llm',
        name: 'cv-extraction-llm',
        modelName: 'o4-mini-2025-04-16',
        modelProvider: 'openai',
      },
      expect.any(Function)
    );
  });

  it('attaches the pages to the trace when it is enabled, the tokens and the output', async () => {
    process.env.LLM_OBS_CV_IMAGES_ENABLED = 'true';
    const { service, create } = build();
    create.mockResolvedValue(
      toolCallResponse({
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      })
    );

    await service.extractCVFromImages(['page1', 'page2']);

    const merged = annotations();
    const [system, user] = merged.inputData;
    expect(system.role).toBe('system');
    expect(user).toEqual({
      role: 'user',
      content: expect.stringContaining('Analyse ce CV'),
      imageParts: [
        { mimeType: 'image/png', content: 'page1' },
        { mimeType: 'image/png', content: 'page2' },
      ],
    });
    expect(user.content).not.toContain('[image]');
    expect(merged.outputData).toEqual([
      { role: 'assistant', content: '{"description":"A cook"}' },
    ]);
    expect(merged.metrics).toEqual({
      inputTokens: 10,
      outputTokens: 5,
      totalTokens: 15,
    });
    expect(merged.metadata).toEqual({
      pageCount: 2,
      imagesBytes: 10,
      attachedPages: 2,
    });
  });

  it('attaches no page by default, and says so in the trace', async () => {
    const { service, create } = build();
    create.mockResolvedValue(toolCallResponse());

    await service.extractCVFromImages(['page1', 'page2']);

    const user = annotations().inputData[1];
    expect(user.imageParts).toBeUndefined();
    expect(user.content).toContain(
      '[2 pages non jointes : envoi des images désactivé]'
    );
    expect(annotations().metadata).toMatchObject({
      pageCount: 2,
      attachedPages: 0,
    });
  });

  it('cuts the trace at the size budget but still sends every page to the model', async () => {
    process.env.LLM_OBS_CV_IMAGES_ENABLED = 'true';
    process.env.LLM_OBS_CV_IMAGES_MAX_BYTES = '12';
    const { service, create } = build();
    create.mockResolvedValue(toolCallResponse());

    await service.extractCVFromImages(['aaaaaaaa', 'bbbbbbbb', 'cc']);

    const user = annotations().inputData[1];
    expect(user.imageParts).toEqual([
      { mimeType: 'image/png', content: 'aaaaaaaa' },
    ]);
    expect(user.content).toContain('[2 pages non jointes : plafond de taille]');
    const sent = create.mock.calls[0][0].messages[1].content.filter(
      (part: { type: string }) => part.type === 'image_url'
    );
    expect(sent).toHaveLength(3);
  });

  it('keeps the input in the trace when the call fails', async () => {
    process.env.LLM_OBS_CV_IMAGES_ENABLED = 'true';
    const { service, create } = build();
    create.mockRejectedValue(new Error('rate limited'));

    await expect(service.extractCVFromImages(['page1'])).rejects.toThrow(
      "Impossible d'extraire les données du CV à partir d'images: rate limited"
    );

    const merged = annotations();
    expect(merged.inputData[1].imageParts).toHaveLength(1);
    expect(merged.outputData).toBeUndefined();
  });
});
