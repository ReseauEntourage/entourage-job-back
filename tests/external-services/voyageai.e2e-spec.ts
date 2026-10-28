import { VoyageAiService } from 'src/external-services/voyageai/voyageai.service';
import { tracer } from 'src/tracer';

const mockEmbed = jest.fn();

// The VoyageAI SDK is mocked: no request is ever sent.
jest.mock('voyageai', () => {
  class VoyageAIError extends Error {
    constructor(
      message: string,
      public readonly statusCode?: number
    ) {
      super(message);
    }
  }
  return {
    VoyageAIClient: jest.fn().mockImplementation(() => ({ embed: mockEmbed })),
    VoyageAIError,
  };
});

// Pure unit tests (no database, no network): the Datadog tracer is mocked.
jest.mock('src/tracer', () => ({
  tracer: { llmobs: { trace: jest.fn(), annotate: jest.fn() } },
}));

const span = { name: 'embedding-span' };
const trace = tracer.llmobs.trace as jest.Mock;
const annotate = tracer.llmobs.annotate as jest.Mock;

describe('VoyageAiService', () => {
  const llmMetricsService = { recordVoyageAiUsage: jest.fn() };
  const build = () => new VoyageAiService(llmMetricsService as never);

  beforeEach(() => {
    mockEmbed.mockReset();
    llmMetricsService.recordVoyageAiUsage.mockReset();
    trace.mockReset().mockImplementation((_options, fn) => fn(span));
    annotate.mockReset();
    delete process.env.LLM_OBS_EMBEDDING_TEXT_ENABLED;
  });

  describe('generateEmbedding', () => {
    it('returns the embedding of the text and records the token usage', async () => {
      mockEmbed.mockResolvedValue({
        data: [{ embedding: [0.1, 0.2] }],
        usage: { totalTokens: 12 },
      });

      const embedding = await build().generateEmbedding('hello');

      expect(embedding).toEqual([0.1, 0.2]);
      expect(mockEmbed).toHaveBeenCalledWith({
        input: 'hello',
        model: 'voyage-4-lite',
      });
      expect(llmMetricsService.recordVoyageAiUsage).toHaveBeenCalledWith(
        'voyage-4-lite',
        { totalTokens: 12 },
        'embedding',
        'profile_recommendation'
      );
    });

    it('opens a single embedding span, redacting the input text by default', async () => {
      mockEmbed.mockResolvedValue({
        data: [{ embedding: [0.1, 0.2] }],
        usage: { totalTokens: 12 },
      });

      await build().generateEmbedding('hello');

      expect(trace).toHaveBeenCalledTimes(1);
      expect(trace).toHaveBeenCalledWith(
        {
          kind: 'embedding',
          name: 'voyageai-embed',
          modelName: 'voyage-4-lite',
          modelProvider: 'voyageai',
        },
        expect.any(Function)
      );
      expect(annotate).toHaveBeenCalledWith(span, {
        metadata: {
          input: '[5 caractères de profil non joints à la trace]',
        },
        metrics: { inputTokens: 12, totalTokens: 12 },
      });
    });

    it('attaches the raw input text when the setting is enabled', async () => {
      process.env.LLM_OBS_EMBEDDING_TEXT_ENABLED = 'true';
      mockEmbed.mockResolvedValue({
        data: [{ embedding: [0.1, 0.2] }],
        usage: { totalTokens: 12 },
      });

      await build().generateEmbedding('hello');

      expect(annotate).toHaveBeenCalledWith(span, {
        metadata: { input: 'hello' },
        metrics: { inputTokens: 12, totalTokens: 12 },
      });
    });

    it('does not record any usage when the API does not report it', async () => {
      mockEmbed.mockResolvedValue({ data: [{ embedding: [1] }] });

      await build().generateEmbedding('hello');

      expect(llmMetricsService.recordVoyageAiUsage).not.toHaveBeenCalled();
    });

    it.each([
      ['an API error', 'VoyageAIError'],
      ['an unexpected error', 'Error'],
    ])('fails with a generic message on %s', async (_label, kind) => {
      const { VoyageAIError } = jest.requireMock('voyageai');
      mockEmbed.mockRejectedValue(
        kind === 'VoyageAIError'
          ? new VoyageAIError('rate limited', 429)
          : new Error('network')
      );

      await expect(build().generateEmbedding('hello')).rejects.toThrow(
        'Failed to generate embedding'
      );
    });
  });

  describe('generateEmbeddingsBatch', () => {
    it('does not call the API for an empty batch', async () => {
      const result = await build().generateEmbeddingsBatch([]);

      expect(result).toEqual([]);
      expect(mockEmbed).not.toHaveBeenCalled();
    });

    it('returns the embeddings in the order of the inputs with a single call', async () => {
      mockEmbed.mockResolvedValue({
        data: [{ embedding: [1] }, { embedding: [2] }],
        usage: { totalTokens: 4 },
      });

      const result = await build().generateEmbeddingsBatch(['a', 'b']);

      expect(result).toEqual([[1], [2]]);
      expect(mockEmbed).toHaveBeenCalledTimes(1);
      expect(mockEmbed).toHaveBeenCalledWith({
        input: ['a', 'b'],
        model: 'voyage-4-lite',
      });
      expect(llmMetricsService.recordVoyageAiUsage).toHaveBeenCalledTimes(1);
    });

    it('opens a single embedding span for the whole batch, redacting each text', async () => {
      mockEmbed.mockResolvedValue({
        data: [{ embedding: [1] }, { embedding: [2] }],
        usage: { totalTokens: 4 },
      });

      await build().generateEmbeddingsBatch(['a', 'bb']);

      expect(trace).toHaveBeenCalledTimes(1);
      expect(trace).toHaveBeenCalledWith(
        {
          kind: 'embedding',
          name: 'voyageai-embed',
          modelName: 'voyage-4-lite',
          modelProvider: 'voyageai',
        },
        expect.any(Function)
      );
      expect(annotate).toHaveBeenCalledWith(span, {
        metadata: {
          input: [
            '[1 caractères de profil non joints à la trace]',
            '[2 caractères de profil non joints à la trace]',
          ],
        },
        metrics: { inputTokens: 4, totalTokens: 4 },
      });
    });

    it('works without usage information', async () => {
      mockEmbed.mockResolvedValue({ data: [{ embedding: [1] }] });

      await build().generateEmbeddingsBatch(['a']);

      expect(llmMetricsService.recordVoyageAiUsage).not.toHaveBeenCalled();
    });

    it('fails mentioning the batch size when the API fails', async () => {
      const { VoyageAIError } = jest.requireMock('voyageai');
      mockEmbed.mockRejectedValue(new VoyageAIError('boom', 500));

      await expect(build().generateEmbeddingsBatch(['a', 'b'])).rejects.toThrow(
        'Failed to generate batch embeddings for 2 items'
      );
    });

    it('fails the same way on an unexpected error', async () => {
      mockEmbed.mockRejectedValue(new Error('network'));

      await expect(build().generateEmbeddingsBatch(['a'])).rejects.toThrow(
        'Failed to generate batch embeddings for 1 items'
      );
    });
  });
});
