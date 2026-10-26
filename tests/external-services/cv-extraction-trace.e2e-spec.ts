import { CvExtractionService } from 'src/external-services/cv-extraction/cv-extraction.service';
import { tracer } from 'src/tracer';

// Pure unit tests (no database, no network): the Datadog tracer and the
// Anthropic service are replaced by doubles
jest.mock('src/tracer', () => ({
  tracer: { llmobs: { trace: jest.fn(), annotate: jest.fn() } },
}));

const span = { name: 'llm-span' };
const trace = tracer.llmobs.trace as jest.Mock;
const annotate = tracer.llmobs.annotate as jest.Mock;

describe('CvExtractionService.extractCVFromImages - LLM Observability trace', () => {
  const anthropic = { createMessageUntraced: jest.fn() };
  const llmMetrics = { recordAnthropicUsage: jest.fn() };

  const build = () => ({
    service: new CvExtractionService(anthropic as never, llmMetrics as never),
    create: anthropic.createMessageUntraced,
  });

  const structuredResponse = (extra: Record<string, unknown> = {}) => ({
    stop_reason: 'end_turn',
    content: [{ type: 'text', text: '{"description":"A cook"}' }],
    usage: { input_tokens: 10, output_tokens: 5 },
    ...extra,
  });

  type TracedMessage = { role: string; content: string };
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

  beforeEach(() => {
    trace.mockReset().mockImplementation((_options, fn) => fn(span));
    annotate.mockReset();
    anthropic.createMessageUntraced.mockReset();
    llmMetrics.recordAnthropicUsage.mockReset();
  });

  it('opens an llm span for the model and the provider of the call', async () => {
    const { service, create } = build();
    create.mockResolvedValue(structuredResponse());

    await service.extractCVFromImages(['p1']);

    expect(trace).toHaveBeenCalledTimes(1);
    expect(trace).toHaveBeenCalledWith(
      {
        kind: 'llm',
        name: 'cv-extraction-llm',
        modelName: 'claude-sonnet-5-5',
        modelProvider: 'anthropic',
      },
      expect.any(Function)
    );
  });

  it('traces the prompt, the output and the tokens, without any page image', async () => {
    const { service, create } = build();
    create.mockResolvedValue(structuredResponse());

    await service.extractCVFromImages(['page1', 'page2']);

    const merged = annotations();
    const [system, user] = merged.inputData;
    expect(system.role).toBe('system');
    expect(user).toEqual({
      role: 'user',
      content: expect.stringContaining('Analyse ce CV'),
    });
    expect(user.content).toContain('[2 pages de CV non jointes à la trace]');
    expect(JSON.stringify(merged)).not.toContain('page1');
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
      effort: 'medium',
    });
  });

  it('says a single page in the singular', async () => {
    const { service, create } = build();
    create.mockResolvedValue(structuredResponse());

    await service.extractCVFromImages(['page1']);

    expect(annotations().inputData[1].content).toContain(
      '[1 page de CV non jointe à la trace]'
    );
  });

  it('still sends every page to the model', async () => {
    const { service, create } = build();
    create.mockResolvedValue(structuredResponse());

    await service.extractCVFromImages(['aaaaaaaa', 'bbbbbbbb', 'cc']);

    const sent = create.mock.calls[0][0].messages[0].content.filter(
      (part: { type: string }) => part.type === 'image'
    );
    expect(sent).toHaveLength(3);
  });

  it('keeps the input in the trace when the call fails', async () => {
    const { service, create } = build();
    create.mockRejectedValue(new Error('rate limited'));

    await expect(service.extractCVFromImages(['page1'])).rejects.toThrow(
      "Impossible d'extraire les données du CV à partir d'images: rate limited"
    );

    const merged = annotations();
    expect(merged.inputData[1].content).toContain('Analyse ce CV');
    expect(merged.outputData).toBeUndefined();
  });
});
