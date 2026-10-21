import { VoyageAiService } from 'src/external-services/voyageai/voyageai.service';

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

describe('VoyageAiService', () => {
  const llmMetricsService = { recordVoyageAiUsage: jest.fn() };
  const build = () => new VoyageAiService(llmMetricsService as never);

  beforeEach(() => {
    mockEmbed.mockReset();
    llmMetricsService.recordVoyageAiUsage.mockReset();
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
