import { AiFeature } from 'src/external-services/llm-observability/ai-feature.enum';
import {
  traceAiWorkflow,
  traceLlmCall,
} from 'src/external-services/llm-observability/llm-observability';
import { tracer } from 'src/tracer';

// Pure unit tests (no database, no network): the Datadog tracer is mocked.
jest.mock('src/tracer', () => ({
  tracer: { llmobs: { trace: jest.fn(), annotate: jest.fn() } },
}));

const span = { name: 'span' };
const trace = tracer.llmobs.trace as jest.Mock;
const annotate = tracer.llmobs.annotate as jest.Mock;

beforeEach(() => {
  trace.mockReset().mockImplementation((_options, fn) => fn(span));
  annotate.mockReset();
});

describe('AiFeature', () => {
  it('is the closed list of the AI flows', () => {
    expect(Object.values(AiFeature).sort()).toEqual([
      'ai_assistant',
      'cv_extraction',
      'help_groups_title',
      'presentation_generation',
    ]);
  });
});

describe('traceAiWorkflow', () => {
  it('opens a workflow span with the given name', async () => {
    await traceAiWorkflow(
      { feature: AiFeature.CV_EXTRACTION, name: 'cv-extraction' },
      async () => 'done'
    );

    expect(trace).toHaveBeenCalledWith(
      { kind: 'workflow', name: 'cv-extraction' },
      expect.any(Function)
    );
  });

  it('returns the result and tags the feature with a success outcome', async () => {
    const result = await traceAiWorkflow(
      {
        feature: AiFeature.PRESENTATION_GENERATION,
        name: 'presentation-generation',
        tags: { role: 'candidate' },
      },
      async () => 'text'
    );

    expect(result).toBe('text');
    expect(annotate).toHaveBeenCalledWith(span, {
      tags: {
        role: 'candidate',
        feature: 'presentation_generation',
        outcome: 'success',
      },
    });
  });

  it('tags the outcome set by the flow, and the extra tags and metadata', async () => {
    await traceAiWorkflow(
      { feature: AiFeature.HELP_GROUPS_TITLE, name: 'help-groups-title' },
      async ({ setOutcome, annotate: annotateFlow }) => {
        annotateFlow({ tags: { isRetry: 'true' }, metadata: { pages: 2 } });
        setOutcome('empty');
      }
    );

    expect(annotate).toHaveBeenCalledWith(span, {
      tags: { isRetry: 'true', feature: 'help_groups_title', outcome: 'empty' },
      metadata: { pages: 2 },
    });
  });

  it('cannot be given a feature tag or an outcome tag by the flow', async () => {
    await traceAiWorkflow(
      { feature: AiFeature.AI_ASSISTANT, name: 'ai-assistant' },
      async ({ annotate: annotateFlow }) => {
        annotateFlow({ tags: { feature: 'other', outcome: 'other' } });
      }
    );

    expect(annotate).toHaveBeenCalledWith(span, {
      tags: { feature: 'ai_assistant', outcome: 'success' },
    });
  });

  it('tags an error outcome and rethrows the error unchanged', async () => {
    const error = new Error('boom');

    await expect(
      traceAiWorkflow(
        { feature: AiFeature.AI_ASSISTANT, name: 'ai-assistant' },
        async () => {
          throw error;
        }
      )
    ).rejects.toBe(error);

    expect(annotate).toHaveBeenCalledWith(span, {
      tags: { feature: 'ai_assistant', outcome: 'error' },
    });
  });

  it('keeps the outcome set by the flow when it then throws', async () => {
    await expect(
      traceAiWorkflow(
        { feature: AiFeature.CV_EXTRACTION, name: 'cv-extraction' },
        async ({ setOutcome }) => {
          setOutcome('cancelled');
          throw new Error('aborted');
        }
      )
    ).rejects.toThrow('aborted');

    expect(annotate).toHaveBeenCalledWith(span, {
      tags: { feature: 'cv_extraction', outcome: 'cancelled' },
    });
  });

  it('does not fail the flow when the annotation fails', async () => {
    annotate.mockImplementation(() => {
      throw new Error('Cannot annotate a finished span');
    });

    await expect(
      traceAiWorkflow(
        { feature: AiFeature.CV_EXTRACTION, name: 'cv-extraction' },
        async () => 'done'
      )
    ).resolves.toBe('done');
  });
});

describe('traceLlmCall', () => {
  const options = {
    name: 'cv-extraction-llm',
    modelName: 'claude-sonnet-5-5',
    modelProvider: 'anthropic',
  };

  it('opens an llm span with the model and the provider', async () => {
    await traceLlmCall(options, async () => 'done');

    expect(trace).toHaveBeenCalledWith(
      { kind: 'llm', ...options },
      expect.any(Function)
    );
  });

  it('annotates the messages, the output and the tokens', async () => {
    const result = await traceLlmCall(options, async (annotateCall) => {
      annotateCall({
        inputMessages: [
          { role: 'system', content: 'rules' },
          { role: 'user', content: 'analyse' },
        ],
        outputMessages: [{ role: 'assistant', content: '{"a":1}' }],
        metrics: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      });
      return 'done';
    });

    expect(result).toBe('done');
    expect(annotate).toHaveBeenCalledWith(span, {
      inputData: [
        { role: 'system', content: 'rules' },
        { role: 'user', content: 'analyse' },
      ],
      outputData: [{ role: 'assistant', content: '{"a":1}' }],
      metrics: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
    });
  });

  it('only annotates what it is given, and never fails the call', async () => {
    annotate.mockImplementationOnce(() => {
      throw new Error('Cannot annotate a finished span');
    });

    await expect(
      traceLlmCall(options, async (annotateCall) => {
        annotateCall({ metadata: { pages: 1 } });
        return 'done';
      })
    ).resolves.toBe('done');
    expect(annotate).toHaveBeenCalledWith(span, { metadata: { pages: 1 } });
  });

  it('tags the span with its tags and a success outcome', async () => {
    await traceLlmCall(
      { ...options, tags: { step: 'reading' } },
      async () => 1
    );

    expect(annotate).toHaveBeenCalledWith(span, {
      tags: { step: 'reading', outcome: 'success' },
    });
  });

  it('tags the outcome given by the call', async () => {
    await traceLlmCall(options, async (annotateCall) => {
      annotateCall({ outcome: 'empty' });
    });

    expect(annotate).toHaveBeenCalledTimes(1);
    expect(annotate).toHaveBeenCalledWith(span, { tags: { outcome: 'empty' } });
  });

  it('tags an error outcome when the call throws, and keeps the outcome it gave', async () => {
    await expect(
      traceLlmCall(options, async () => {
        throw new Error('boom');
      })
    ).rejects.toThrow('boom');
    expect(annotate).toHaveBeenLastCalledWith(span, {
      tags: { outcome: 'error' },
    });

    await expect(
      traceLlmCall(options, async (annotateCall) => {
        annotateCall({ outcome: 'cancelled' });
        throw new Error('aborted');
      })
    ).rejects.toThrow('aborted');
    expect(annotate).toHaveBeenLastCalledWith(span, {
      tags: { outcome: 'cancelled' },
    });
  });

  it('rethrows the error of the call', async () => {
    await expect(
      traceLlmCall(options, async () => {
        throw new Error('rate limited');
      })
    ).rejects.toThrow('rate limited');
  });
});
