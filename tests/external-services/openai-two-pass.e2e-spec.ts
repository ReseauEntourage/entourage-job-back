import { OpenAiService } from 'src/external-services/openai/openai.service';
import { tracer } from 'src/tracer';

// Pure unit tests (no database, no network): the Datadog tracer is mocked, and
// `openai` is replaced by a double for the whole e2e suite (tests/setup.ts)
jest.mock('src/tracer', () => ({
  tracer: { llmobs: { trace: jest.fn(), annotate: jest.fn() } },
}));

type OpenAiDouble = { chat: { completions: { create: jest.Mock } } };
type Span = { name: string };

const trace = tracer.llmobs.trace as jest.Mock;
const annotate = tracer.llmobs.annotate as jest.Mock;

const CV_TEXT =
  '# Expériences\\nCuisinier chez Chez Paul depuis 2019\\n# Formations\\nCAP Cuisine, 2012';
const USAGE = { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 };

describe('OpenAiService - two-pass CV extraction', () => {
  const llmMetrics = { recordOpenAiUsage: jest.fn() };
  const saved = {
    twoPasses: process.env.CV_EXTRACTION_TWO_PASSES,
    traceText: process.env.LLM_OBS_CV_TEXT_ENABLED,
  };

  const build = () => {
    const service = new OpenAiService(llmMetrics as never);
    const create = (service as unknown as { openai: OpenAiDouble }).openai.chat
      .completions.create;
    return { service, create };
  };

  const readingResponse = (
    text: string | null,
    finishReason = 'stop',
    usage: unknown = USAGE
  ) => ({
    choices: [{ finish_reason: finishReason, message: { content: text } }],
    usage,
  });

  const buildingResponse = (args: unknown = { description: 'A cook' }) => ({
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
    llmMetrics.recordOpenAiUsage.mockReset();
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
        expect(create.mock.calls[0][0].tools).toHaveLength(1);
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
      // Reading: the pages, no forced tool
      expect(reading.tools).toBeUndefined();
      expect(
        reading.messages[1].content.filter(
          (part: { type: string }) => part.type === 'image_url'
        )
      ).toHaveLength(2);
      // Building: the text only, in a data block, with the forced tool
      expect(typeof building.messages[1].content).toBe('string');
      expect(building.messages[1].content).toBe(`<cv>\n${CV_TEXT}\n</cv>`);
      expect(JSON.stringify(building)).not.toContain('image_url');
      expect(building.tool_choice).toEqual({
        type: 'function',
        function: { name: 'extract_cv_data' },
      });
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
      expect(create.mock.calls[0][0].messages[1].content).toBe(
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

      const system: string = create.mock.calls[0][0].messages[0].content;
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

      const system: string = create.mock.calls[1][0].messages[0].content;
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
      create.mockResolvedValueOnce(readingResponse(CV_TEXT, 'length'));

      await expect(service.extractCVFromImages(['p1'])).rejects.toThrow(
        /limite de tokens \(finish_reason=length\)/
      );

      expect(create).toHaveBeenCalledTimes(1);
      expect(spanAnnotations('cv-reading').tags.outcome).toBe('truncated');
    });

    it('tags a timeout outcome', async () => {
      const { service, create } = build();
      const timeout = new Error('Request timed out.');
      timeout.name = 'APIConnectionTimeoutError';
      create.mockRejectedValueOnce(timeout);

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
          modelName: 'gpt-5-mini',
          modelProvider: 'openai',
        },
        {
          kind: 'llm',
          name: 'cv-building',
          modelName: 'gpt-5-mini',
          modelProvider: 'openai',
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
      expect(building.metadata).toEqual({ textChars: CV_TEXT.length });
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

      expect(llmMetrics.recordOpenAiUsage.mock.calls).toEqual([
        ['gpt-5-mini', USAGE, 'cv_reading', 'cv_extraction'],
        ['gpt-5-mini', USAGE, 'cv_building', 'cv_extraction'],
      ]);
    });
  });

  describe('reasoning tokens', () => {
    const REASONING_USAGE = {
      ...USAGE,
      completion_tokens_details: { reasoning_tokens: 3 },
    };

    it('sends them to each span as a breakdown of the output tokens', async () => {
      const { service, create } = build();
      create
        .mockResolvedValueOnce(
          readingResponse(CV_TEXT, 'stop', REASONING_USAGE)
        )
        .mockResolvedValueOnce({
          ...buildingResponse(),
          usage: { ...REASONING_USAGE, completion_tokens: 9 },
        });

      await service.extractCVFromImages(['p1']);

      expect(spanAnnotations('cv-reading').metrics).toEqual({
        inputTokens: 10,
        outputTokens: 5,
        totalTokens: 15,
        reasoningOutputTokens: 3,
      });
      expect(spanAnnotations('cv-building').metrics).toMatchObject({
        outputTokens: 9,
        reasoningOutputTokens: 3,
      });
    });

    it('sends none when the model does not report any', async () => {
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
    });

    it('counts them in the token metrics of the call', async () => {
      const { service, create } = build();
      create
        .mockResolvedValueOnce(
          readingResponse(CV_TEXT, 'stop', REASONING_USAGE)
        )
        .mockResolvedValueOnce(buildingResponse());

      await service.extractCVFromImages(['p1']);

      expect(llmMetrics.recordOpenAiUsage.mock.calls[0][1]).toEqual(
        REASONING_USAGE
      );
    });

    it('sends them for the single-call extraction too', async () => {
      process.env.CV_EXTRACTION_TWO_PASSES = 'false';
      const { service, create } = build();
      create.mockResolvedValueOnce({
        ...buildingResponse(),
        usage: { ...REASONING_USAGE, completion_tokens: 12 },
      });

      await service.extractCVFromImages(['p1']);

      expect(spanAnnotations('cv-extraction-llm').metrics).toMatchObject({
        outputTokens: 12,
        reasoningOutputTokens: 3,
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
      process.env.AI_MODEL_CV_READING = 'gpt-4.1-mini';
      process.env.AI_MODEL_CV_BUILDING = 'gpt-4.1';
      const { service, create } = build();
      create
        .mockResolvedValueOnce(readingResponse(CV_TEXT))
        .mockResolvedValueOnce(buildingResponse());

      await service.extractCVFromImages(['p1']);

      expect(create.mock.calls.map(([body]) => body.model)).toEqual([
        'gpt-4.1-mini',
        'gpt-4.1',
      ]);
      expect(trace.mock.calls.map(([options]) => options.modelName)).toEqual([
        'gpt-4.1-mini',
        'gpt-4.1',
      ]);
      expect(
        llmMetrics.recordOpenAiUsage.mock.calls.map(([model]) => model)
      ).toEqual(['gpt-4.1-mini', 'gpt-4.1']);
    });

    it('keeps the default model of each step without a setting', async () => {
      const { service, create } = build();
      create
        .mockResolvedValueOnce(readingResponse(CV_TEXT))
        .mockResolvedValueOnce(buildingResponse());

      await service.extractCVFromImages(['p1']);

      expect(create.mock.calls.map(([body]) => body.model)).toEqual([
        'gpt-5-mini',
        'gpt-5-mini',
      ]);
    });

    it('calls the model of the single-call extraction', async () => {
      process.env.CV_EXTRACTION_TWO_PASSES = 'false';
      process.env.AI_MODEL_CV_EXTRACTION = 'gpt-4.1';
      const { service, create } = build();
      create.mockResolvedValueOnce(buildingResponse());

      await service.extractCVFromImages(['p1']);

      expect(create.mock.calls[0][0].model).toBe('gpt-4.1');
      expect(trace.mock.calls[0][0].modelName).toBe('gpt-4.1');
      expect(llmMetrics.recordOpenAiUsage.mock.calls[0][0]).toBe('gpt-4.1');
    });

    it('builds from a stored text with the building model', async () => {
      process.env.AI_MODEL_CV_BUILDING = 'gpt-4.1';
      const { service, create } = build();
      create.mockResolvedValueOnce(buildingResponse());

      await service.buildCVFromTranscript(CV_TEXT);

      expect(create.mock.calls[0][0].model).toBe('gpt-4.1');
    });

    it('does not fall back on the default model when the provider refuses the model', async () => {
      process.env.AI_MODEL_CV_READING = 'claude-haiku-5-5';
      const { service, create } = build();
      create.mockRejectedValueOnce(new Error('model not found'));

      await expect(service.extractCVFromImages(['p1'])).rejects.toThrow(
        'Impossible de lire le CV à partir des images: model not found'
      );

      expect(create).toHaveBeenCalledTimes(1);
      expect(create.mock.calls[0][0].model).toBe('claude-haiku-5-5');
    });
  });

  describe('reasoning effort of each step', () => {
    const effortEnv = [
      'AI_REASONING_EFFORT_CV_EXTRACTION',
      'AI_REASONING_EFFORT_CV_READING',
      'AI_REASONING_EFFORT_CV_BUILDING',
    ];

    afterEach(() => {
      effortEnv.forEach((name) => delete process.env[name]);
    });

    it('does not send the parameter without a setting', async () => {
      const { service, create } = build();
      create
        .mockResolvedValueOnce(readingResponse(CV_TEXT))
        .mockResolvedValueOnce(buildingResponse());

      await service.extractCVFromImages(['p1']);

      create.mock.calls.forEach(([body]) => {
        expect(body).not.toHaveProperty('reasoning_effort');
      });
    });

    it('sends the effort of each step and puts it in the span metadata', async () => {
      process.env.AI_REASONING_EFFORT_CV_READING = 'low';
      process.env.AI_REASONING_EFFORT_CV_BUILDING = 'medium';
      const { service, create } = build();
      create
        .mockResolvedValueOnce(readingResponse(CV_TEXT))
        .mockResolvedValueOnce(buildingResponse());

      await service.extractCVFromImages(['p1']);

      expect(create.mock.calls.map(([body]) => body.reasoning_effort)).toEqual([
        'low',
        'medium',
      ]);
      expect(
        annotate.mock.calls
          .map(([, annotation]) => annotation?.metadata?.reasoningEffort)
          .filter(Boolean)
      ).toEqual(['low', 'medium']);
    });
  });
});
