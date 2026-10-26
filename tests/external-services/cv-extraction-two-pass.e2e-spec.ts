import Anthropic from '@anthropic-ai/sdk';
import { CvExtractionService } from 'src/external-services/cv-extraction/cv-extraction.service';
import { tracer } from 'src/tracer';

// Pure unit tests (no database, no network): the Datadog tracer and the
// Anthropic service are replaced by doubles
jest.mock('src/tracer', () => ({
  tracer: { llmobs: { trace: jest.fn(), annotate: jest.fn() } },
}));

type Span = { name: string };

const trace = tracer.llmobs.trace as jest.Mock;
const annotate = tracer.llmobs.annotate as jest.Mock;

const CV_TEXT =
  '# Expériences\\nCuisinier chez Chez Paul depuis 2019\\n# Formations\\nCAP Cuisine, 2012';
const USAGE = { input_tokens: 10, output_tokens: 5 };

describe('CvExtractionService - two-pass CV extraction', () => {
  const anthropic = { createMessageUntraced: jest.fn() };
  const llmMetrics = { recordAnthropicUsage: jest.fn() };
  const saved = {
    twoPasses: process.env.CV_EXTRACTION_TWO_PASSES,
    traceText: process.env.LLM_OBS_CV_TEXT_ENABLED,
  };

  const build = () => ({
    service: new CvExtractionService(anthropic as never, llmMetrics as never),
    create: anthropic.createMessageUntraced,
  });

  const readingResponse = (
    text: string | null,
    stopReason = 'end_turn',
    usage: unknown = USAGE
  ) => ({
    stop_reason: stopReason,
    content: text === null ? [] : [{ type: 'text', text }],
    usage,
  });

  const buildingResponse = (args: unknown = { description: 'A cook' }) => ({
    stop_reason: 'end_turn',
    content: [{ type: 'text', text: JSON.stringify(args) }],
    usage: USAGE,
  });

  type SpanAnnotations = {
    tags: Record<string, string>;
    inputData: Array<{ role: string; content: string }>;
    outputData?: unknown;
    metadata?: unknown;
    metrics?: Record<string, number>;
  };

  /** Everything annotated on the spans of one step, as Datadog merges it. */
  const spanAnnotations = (name: string): SpanAnnotations =>
    annotate.mock.calls
      .filter(([span]) => (span as Span).name === name)
      .reduce(
        (merged, [, options]) => ({
          ...merged,
          ...options,
          tags: { ...merged.tags, ...options.tags },
        }),
        { tags: {}, inputData: [] } as SpanAnnotations
      );

  const restore = (key: string, value: string | undefined) => {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  };

  beforeEach(() => {
    trace
      .mockReset()
      .mockImplementation((options: { name: string }, fn) =>
        fn({ name: options.name })
      );
    annotate.mockReset();
    anthropic.createMessageUntraced.mockReset();
    llmMetrics.recordAnthropicUsage.mockReset();
    process.env.CV_EXTRACTION_TWO_PASSES = 'true';
    delete process.env.LLM_OBS_CV_TEXT_ENABLED;
  });

  afterAll(() => {
    restore('CV_EXTRACTION_TWO_PASSES', saved.twoPasses);
    restore('LLM_OBS_CV_TEXT_ENABLED', saved.traceText);
  });

  describe('the switch', () => {
    it.each([[undefined], ['false'], ['1'], ['']])(
      'extracts in a single call, as before, when it is %p',
      async (value) => {
        restore('CV_EXTRACTION_TWO_PASSES', value);
        const { service, create } = build();
        create.mockResolvedValue(buildingResponse());

        const result = await service.extractCVFromImages(['p1', 'p2']);

        expect(create).toHaveBeenCalledTimes(1);
        expect(create.mock.calls[0][0].output_config.format.type).toBe(
          'json_schema'
        );
        expect(result).toEqual({
          data: { description: 'A cook' },
          transcript: null,
        });
      }
    );
  });

  describe('reading then building', () => {
    it('reads the pages, then builds the profile from the text alone', async () => {
      const { service, create } = build();
      create
        .mockResolvedValueOnce(readingResponse(CV_TEXT))
        .mockResolvedValueOnce(buildingResponse());

      const result = await service.extractCVFromImages(['p1', 'p2']);

      expect(result).toEqual({
        data: { description: 'A cook' },
        transcript: CV_TEXT,
      });
      expect(create).toHaveBeenCalledTimes(2);

      const [reading, building] = create.mock.calls.map(([body]) => body);
      // Reading: the pages, free text out
      expect(reading.output_config.format).toBeUndefined();
      expect(
        reading.messages[0].content.filter(
          (part: { type: string }) => part.type === 'image'
        )
      ).toHaveLength(2);
      // Building: the text only, in a data block, as a structured output
      expect(typeof building.messages[0].content).toBe('string');
      expect(building.messages[0].content).toBe(`<cv>\n${CV_TEXT}\n</cv>`);
      expect(JSON.stringify(building)).not.toContain('"image"');
      expect(building.output_config.format.type).toBe('json_schema');
      expect(building).not.toHaveProperty('tool_choice');
    });

    it('gives the same signal to both calls', async () => {
      const { service, create } = build();
      create
        .mockResolvedValueOnce(readingResponse(CV_TEXT))
        .mockResolvedValueOnce(buildingResponse());
      const signal = new AbortController().signal;

      await service.extractCVFromImages(['p1'], signal);

      expect(create.mock.calls[0][1]).toEqual({ signal });
      expect(create.mock.calls[1][1]).toEqual({ signal });
    });

    it('does not launch the building when the job is cancelled between the passes', async () => {
      const { service, create } = build();
      const controller = new AbortController();
      create.mockImplementationOnce(async () => {
        controller.abort();
        return readingResponse(CV_TEXT);
      });

      await expect(
        service.extractCVFromImages(['p1'], controller.signal)
      ).rejects.toThrow('interrompue');

      expect(create).toHaveBeenCalledTimes(1);
    });

    it('builds the profile from a text already read, without any reading call', async () => {
      const { service, create } = build();
      create.mockResolvedValueOnce(buildingResponse());

      const result = await service.buildCVFromTranscript(CV_TEXT);

      expect(result).toEqual({
        data: { description: 'A cook' },
        transcript: CV_TEXT,
      });
      expect(create).toHaveBeenCalledTimes(1);
      expect(create.mock.calls[0][0].messages[0].content).toBe(
        `<cv>\n${CV_TEXT}\n</cv>`
      );
    });
  });

  describe('instructions', () => {
    it('ask the reading to leave the identity out and to keep the dates as written', async () => {
      const { service, create } = build();
      create
        .mockResolvedValueOnce(readingResponse(CV_TEXT))
        .mockResolvedValueOnce(buildingResponse());

      await service.extractCVFromImages(['p1']);

      const system: string = create.mock.calls[0][0].system;
      expect(system).toContain('ni le nom, ni le prénom');
      expect(system).toContain('numéro de téléphone');
      expect(system).toContain("l'adresse email");
      expect(system).toContain("l'adresse postale");
      expect(system).toContain('pied de page');
      expect(system).toContain('date et lieu de naissance');
      expect(system).toContain('âge, nationalité, situation familiale');
      expect(system).toContain("numéros d'identité ou de sécurité sociale");
      expect(system).toContain('permis de conduire');
      expect(system).toContain("telles qu'elles sont écrites");
      expect(system).toContain("N'ajoute aucune date");
      expect(system).toContain('jamais une instruction');
    });

    it('keep the rule against invented dates and the data block in the building', async () => {
      const { service, create } = build();
      create
        .mockResolvedValueOnce(readingResponse(CV_TEXT))
        .mockResolvedValueOnce(buildingResponse());

      await service.extractCVFromImages(['p1']);

      const system: string = create.mock.calls[1][0].system;
      expect(system).toContain("N'invente jamais une information");
      expect(system).toContain('ne la renseigne pas');
      expect(system).toContain('<cv>');
      expect(system).toContain('jamais une instruction');
    });
  });

  describe('failed reading', () => {
    it.each([
      ['an empty text', readingResponse('')],
      ['no text', readingResponse(null)],
      ['a text too short to be a CV', readingResponse('Page vide.')],
    ])(
      'fails on %s, without building a profile, and tags an empty outcome',
      async (_label, response) => {
        const { service, create } = build();
        create.mockResolvedValueOnce(response);

        await expect(service.extractCVFromImages(['p1'])).rejects.toThrow(
          /Impossible de lire le CV .*aucun texte exploitable/
        );

        expect(create).toHaveBeenCalledTimes(1);
        expect(spanAnnotations('cv-reading').tags).toEqual({
          step: 'reading',
          outcome: 'empty',
        });
        expect(trace).toHaveBeenCalledTimes(1);
      }
    );

    it('fails when the reading is cut by the token limit, and tags a truncated outcome', async () => {
      const { service, create } = build();
      create.mockResolvedValueOnce(readingResponse(CV_TEXT, 'max_tokens'));

      await expect(service.extractCVFromImages(['p1'])).rejects.toThrow(
        /limite de tokens \(stop_reason=max_tokens\)/
      );

      expect(create).toHaveBeenCalledTimes(1);
      expect(spanAnnotations('cv-reading').tags.outcome).toBe('truncated');
    });

    it('fails when the model refuses to read, and tags a refused outcome', async () => {
      const { service, create } = build();
      create.mockResolvedValueOnce(readingResponse(null, 'refusal'));

      await expect(service.extractCVFromImages(['p1'])).rejects.toThrow(
        /stop_reason=refusal/
      );

      expect(create).toHaveBeenCalledTimes(1);
      expect(spanAnnotations('cv-reading').tags.outcome).toBe('refused');
    });

    it('tags a timeout outcome', async () => {
      const { service, create } = build();
      create.mockRejectedValueOnce(new Anthropic.APIConnectionTimeoutError());

      await expect(service.extractCVFromImages(['p1'])).rejects.toThrow(
        'Request timed out.'
      );

      expect(spanAnnotations('cv-reading').tags.outcome).toBe('timeout');
    });

    it('tags a cancelled outcome when the job was cancelled', async () => {
      const { service, create } = build();
      const controller = new AbortController();
      create.mockImplementationOnce(async () => {
        controller.abort();
        throw new Error('Request aborted');
      });

      await expect(
        service.extractCVFromImages(['p1'], controller.signal)
      ).rejects.toThrow('Request aborted');

      expect(spanAnnotations('cv-reading').tags.outcome).toBe('cancelled');
    });
  });

  describe('failed building', () => {
    it('fails with the context of the building, after a successful reading', async () => {
      const { service, create } = build();
      create
        .mockResolvedValueOnce(readingResponse(CV_TEXT))
        .mockRejectedValueOnce(new Error('rate limited'));

      await expect(service.extractCVFromImages(['p1'])).rejects.toThrow(
        'Impossible de construire le profil à partir du texte du CV: rate limited'
      );

      expect(spanAnnotations('cv-reading').tags.outcome).toBe('success');
      expect(spanAnnotations('cv-building').tags).toEqual({
        step: 'building',
        outcome: 'error',
      });
    });
  });

  describe('trace', () => {
    it('has one LLM span per step, tagged with its step and its outcome', async () => {
      const { service, create } = build();
      create
        .mockResolvedValueOnce(readingResponse(CV_TEXT))
        .mockResolvedValueOnce(buildingResponse());

      await service.extractCVFromImages(['p1']);

      expect(trace.mock.calls.map(([options]) => options)).toEqual([
        {
          kind: 'llm',
          name: 'cv-reading',
          modelName: 'claude-sonnet-5-5',
          modelProvider: 'anthropic',
        },
        {
          kind: 'llm',
          name: 'cv-building',
          modelName: 'claude-haiku-5-5',
          modelProvider: 'anthropic',
        },
      ]);
      expect(spanAnnotations('cv-reading').tags).toEqual({
        step: 'reading',
        outcome: 'success',
      });
      expect(spanAnnotations('cv-building').tags).toEqual({
        step: 'building',
        outcome: 'success',
      });
    });

    it('keeps the CV text out of the trace by default, with a marker of its size', async () => {
      const { service, create } = build();
      create
        .mockResolvedValueOnce(readingResponse(CV_TEXT))
        .mockResolvedValueOnce(buildingResponse());

      await service.extractCVFromImages(['p1']);

      const marker = `[texte du CV non joint à la trace : ${CV_TEXT.length} caractères]`;
      const reading = spanAnnotations('cv-reading');
      const building = spanAnnotations('cv-building');
      expect(reading.outputData).toEqual([
        { role: 'assistant', content: marker },
      ]);
      expect(building.inputData[1]).toEqual({ role: 'user', content: marker });
      expect(JSON.stringify(annotate.mock.calls)).not.toContain('Cuisinier');
      expect(reading.inputData[1].content).toContain(
        '[1 page de CV non jointe à la trace]'
      );
      expect(building.metadata).toEqual({
        textChars: CV_TEXT.length,
        effort: 'low',
      });
    });

    it('puts the CV text in the trace when the setting is enabled', async () => {
      process.env.LLM_OBS_CV_TEXT_ENABLED = 'true';
      const { service, create } = build();
      create
        .mockResolvedValueOnce(readingResponse(CV_TEXT))
        .mockResolvedValueOnce(buildingResponse());

      await service.extractCVFromImages(['p1']);

      expect(spanAnnotations('cv-reading').outputData).toEqual([
        { role: 'assistant', content: CV_TEXT },
      ]);
      expect(spanAnnotations('cv-building').inputData[1]).toEqual({
        role: 'user',
        content: `<cv>\n${CV_TEXT}\n</cv>`,
      });
    });

    it('never attaches a page image to the trace', async () => {
      const { service, create } = build();
      create
        .mockResolvedValueOnce(readingResponse(CV_TEXT))
        .mockResolvedValueOnce(buildingResponse());

      await service.extractCVFromImages(['page-base64-1', 'page-base64-2']);

      expect(JSON.stringify(annotate.mock.calls)).not.toContain('page-base64');
      expect(JSON.stringify(annotate.mock.calls)).not.toContain('imageParts');
    });
  });

  describe('token metrics', () => {
    it('records each pass with its own operation and the cv_extraction feature', async () => {
      const { service, create } = build();
      create
        .mockResolvedValueOnce(readingResponse(CV_TEXT))
        .mockResolvedValueOnce(buildingResponse());

      await service.extractCVFromImages(['p1']);

      expect(llmMetrics.recordAnthropicUsage.mock.calls).toEqual([
        ['claude-sonnet-5-5', USAGE, 'cv_reading', 'cv_extraction'],
        ['claude-haiku-5-5', USAGE, 'cv_building', 'cv_extraction'],
      ]);
    });
  });

  describe('span metrics', () => {
    it('sends the tokens of each call to its span', async () => {
      const { service, create } = build();
      create
        .mockResolvedValueOnce(readingResponse(CV_TEXT))
        .mockResolvedValueOnce(buildingResponse());

      await service.extractCVFromImages(['p1']);

      expect(spanAnnotations('cv-reading').metrics).toEqual({
        inputTokens: 10,
        outputTokens: 5,
        totalTokens: 15,
      });
      expect(spanAnnotations('cv-building').metrics).toEqual({
        inputTokens: 10,
        outputTokens: 5,
        totalTokens: 15,
      });
    });
  });

  describe('model of each step', () => {
    const modelEnv = [
      'AI_MODEL_CV_EXTRACTION',
      'AI_MODEL_CV_READING',
      'AI_MODEL_CV_BUILDING',
    ];

    afterEach(() => {
      modelEnv.forEach((name) => delete process.env[name]);
    });

    it('calls the model of each step, and traces and records that model', async () => {
      process.env.AI_MODEL_CV_READING = 'claude-haiku-5-5';
      process.env.AI_MODEL_CV_BUILDING = 'claude-sonnet-5-5';
      const { service, create } = build();
      create
        .mockResolvedValueOnce(readingResponse(CV_TEXT))
        .mockResolvedValueOnce(buildingResponse());

      await service.extractCVFromImages(['p1']);

      expect(create.mock.calls.map(([body]) => body.model)).toEqual([
        'claude-haiku-5-5',
        'claude-sonnet-5-5',
      ]);
      expect(trace.mock.calls.map(([options]) => options.modelName)).toEqual([
        'claude-haiku-5-5',
        'claude-sonnet-5-5',
      ]);
      expect(
        llmMetrics.recordAnthropicUsage.mock.calls.map(([model]) => model)
      ).toEqual(['claude-haiku-5-5', 'claude-sonnet-5-5']);
    });

    it('keeps the default model of each step without a setting', async () => {
      const { service, create } = build();
      create
        .mockResolvedValueOnce(readingResponse(CV_TEXT))
        .mockResolvedValueOnce(buildingResponse());

      await service.extractCVFromImages(['p1']);

      expect(create.mock.calls.map(([body]) => body.model)).toEqual([
        'claude-sonnet-5-5',
        'claude-haiku-5-5',
      ]);
    });

    it('calls the model of the single-call extraction', async () => {
      process.env.CV_EXTRACTION_TWO_PASSES = 'false';
      process.env.AI_MODEL_CV_EXTRACTION = 'claude-opus-5-5';
      const { service, create } = build();
      create.mockResolvedValueOnce(buildingResponse());

      await service.extractCVFromImages(['p1']);

      expect(create.mock.calls[0][0].model).toBe('claude-opus-5-5');
      expect(trace.mock.calls[0][0].modelName).toBe('claude-opus-5-5');
      expect(llmMetrics.recordAnthropicUsage.mock.calls[0][0]).toBe(
        'claude-opus-5-5'
      );
    });

    it('builds from a stored text with the building model', async () => {
      process.env.AI_MODEL_CV_BUILDING = 'claude-opus-5-5';
      const { service, create } = build();
      create.mockResolvedValueOnce(buildingResponse());

      await service.buildCVFromTranscript(CV_TEXT);

      expect(create.mock.calls[0][0].model).toBe('claude-opus-5-5');
    });

    it('does not fall back on the default model when the provider refuses the model', async () => {
      process.env.AI_MODEL_CV_READING = 'gpt-5-mini';
      const { service, create } = build();
      create.mockRejectedValueOnce(new Error('model not found'));

      await expect(service.extractCVFromImages(['p1'])).rejects.toThrow(
        'Impossible de lire le CV à partir des images: model not found'
      );

      expect(create).toHaveBeenCalledTimes(1);
      expect(create.mock.calls[0][0].model).toBe('gpt-5-mini');
    });
  });

  describe('effort of each step', () => {
    const effortEnv = [
      'AI_EFFORT_CV_EXTRACTION',
      'AI_EFFORT_CV_READING',
      'AI_EFFORT_CV_BUILDING',
    ];

    afterEach(() => {
      effortEnv.forEach((name) => delete process.env[name]);
    });

    it('keeps a low effort by default, so that a transcription does not think for long', async () => {
      const { service, create } = build();
      create
        .mockResolvedValueOnce(readingResponse(CV_TEXT))
        .mockResolvedValueOnce(buildingResponse());

      await service.extractCVFromImages(['p1']);

      expect(
        create.mock.calls.map(([body]) => body.output_config.effort)
      ).toEqual(['low', 'low']);
    });

    it('sends the effort of each step and puts it in the span metadata', async () => {
      process.env.AI_EFFORT_CV_READING = 'medium';
      process.env.AI_EFFORT_CV_BUILDING = 'high';
      const { service, create } = build();
      create
        .mockResolvedValueOnce(readingResponse(CV_TEXT))
        .mockResolvedValueOnce(buildingResponse());

      await service.extractCVFromImages(['p1']);

      expect(
        create.mock.calls.map(([body]) => body.output_config.effort)
      ).toEqual(['medium', 'high']);
      expect(
        annotate.mock.calls
          .map(([, annotation]) => annotation?.metadata?.effort)
          .filter(Boolean)
      ).toEqual(['medium', 'high']);
    });
  });
});
