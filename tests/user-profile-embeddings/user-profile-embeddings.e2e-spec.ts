import { EMBEDDING_CONFIG } from 'src/embeddings/embedding.config';
import { UserProfileEmbeddingsService } from 'src/user-profile-embeddings/user-profile-embeddings.service';

describe('UserProfileEmbeddingsService', () => {
  const build = () => {
    const userProfileModel = { update: jest.fn().mockResolvedValue([1]) };
    const embeddingModel = {
      findOne: jest.fn(),
      create: jest.fn().mockResolvedValue(undefined),
    };
    const voyageAiService = {
      generateEmbedding: jest.fn().mockResolvedValue([0.1, 0.2, 0.3]),
      generateEmbeddingsBatch: jest.fn().mockResolvedValue([[1], [2]]),
    };
    const service = new UserProfileEmbeddingsService(
      userProfileModel as never,
      embeddingModel as never,
      voyageAiService as never
    );
    return { service, userProfileModel, embeddingModel, voyageAiService };
  };

  describe('saveEmbedding', () => {
    it('creates the embedding with the current config version when none exists', async () => {
      const { service, embeddingModel } = build();
      embeddingModel.findOne.mockResolvedValue(null);

      await service.saveEmbedding('profile-1', 'needs', '[1,2]');

      expect(embeddingModel.findOne).toHaveBeenCalledWith({
        where: { userProfileId: 'profile-1', type: 'needs' },
      });
      expect(embeddingModel.create).toHaveBeenCalledWith({
        userProfileId: 'profile-1',
        type: 'needs',
        embedding: '[1,2]',
        configVersion: EMBEDDING_CONFIG.needs.version,
      });
    });

    it('updates the existing embedding in place and bumps its version', async () => {
      const { service, embeddingModel } = build();
      const existing = { update: jest.fn().mockResolvedValue(undefined) };
      embeddingModel.findOne.mockResolvedValue(existing);

      await service.saveEmbedding('profile-1', 'profile', '[3]');

      expect(existing.update).toHaveBeenCalledWith({
        embedding: '[3]',
        configVersion: EMBEDDING_CONFIG.profile.version,
      });
      expect(embeddingModel.create).not.toHaveBeenCalled();
    });
  });

  describe('updateEmbedding', () => {
    it('asks VoyageAI for the embedding then stores it in the pgvector format', async () => {
      const { service, embeddingModel, voyageAiService } = build();
      embeddingModel.findOne.mockResolvedValue(null);

      await service.updateEmbedding('profile-1', 'profile', 'some text');

      expect(voyageAiService.generateEmbedding).toHaveBeenCalledWith(
        'some text'
      );
      expect(embeddingModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ embedding: '[0.1,0.2,0.3]' })
      );
    });

    it('stores nothing when VoyageAI fails', async () => {
      const { service, embeddingModel, voyageAiService } = build();
      voyageAiService.generateEmbedding.mockRejectedValue(
        new Error('Failed to generate embedding')
      );

      await expect(
        service.updateEmbedding('profile-1', 'profile', 'text')
      ).rejects.toThrow('Failed to generate embedding');
      expect(embeddingModel.create).not.toHaveBeenCalled();
    });
  });

  it('generates a batch of embeddings with a single VoyageAI call', async () => {
    const { service, voyageAiService } = build();

    const result = await service.generateEmbeddingsBatch(['a', 'b']);

    expect(result).toEqual([[1], [2]]);
    expect(voyageAiService.generateEmbeddingsBatch).toHaveBeenCalledWith([
      'a',
      'b',
    ]);
  });

  it('invalidates the cached recommendations of a user', async () => {
    const { service, userProfileModel } = build();

    await service.resetLastRecommendationsDate('user-1');

    expect(userProfileModel.update).toHaveBeenCalledWith(
      { lastRecommendationsDate: null },
      { where: { userId: 'user-1' } }
    );
  });

  it('clears the pending embedding flag of a user', async () => {
    const { service, userProfileModel } = build();

    await service.clearEmbeddingPending('user-1');

    expect(userProfileModel.update).toHaveBeenCalledWith(
      { embeddingPendingAt: null },
      { where: { userId: 'user-1' } }
    );
  });
});
