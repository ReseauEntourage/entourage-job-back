import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import {
  EMBEDDING_CONFIG,
  EmbeddingType,
} from 'src/embeddings/embedding.config';
import { VoyageAiService } from 'src/external-services/voyageai/voyageai.service';
import { UserProfile } from 'src/user-profiles/models';
import { UserProfileEmbedding } from 'src/user-profiles/models/user-profile-embedding.model';

@Injectable()
export class UserProfileEmbeddingsService {
  private readonly logger = new Logger(UserProfileEmbeddingsService.name);

  constructor(
    @InjectModel(UserProfile)
    private userProfileModel: typeof UserProfile,
    @InjectModel(UserProfileEmbedding)
    private userProfileEmbeddingModel: typeof UserProfileEmbedding,
    private voyageAiService: VoyageAiService
  ) {}

  async updateEmbedding(
    userProfileId: string,
    embeddingType: EmbeddingType,
    data: string
  ) {
    // Generate embedding from data
    const embeddingArray = await this.voyageAiService.generateEmbedding(data);

    // Convert number array to pgvector format: [num1,num2,num3,...]
    const embedding = `[${embeddingArray.join(',')}]`;

    await this.saveEmbedding(userProfileId, embeddingType, embedding);
  }

  /**
   * Generates embeddings for multiple texts in a single batch API call
   * Optimizes VoyageAI calls by respecting rate limits
   * @param dataArray Array of texts to convert to embeddings
   * @returns Array of embeddings (each embedding is an array of numbers)
   */
  async generateEmbeddingsBatch(dataArray: string[]): Promise<number[][]> {
    return await this.voyageAiService.generateEmbeddingsBatch(dataArray);
  }

  /**
   * Saves an already computed embedding (without calling VoyageAI)
   * Used during batch processing to avoid redundant API calls
   */
  async saveEmbedding(
    userProfileId: string,
    embeddingType: EmbeddingType,
    embedding: string
  ) {
    const existingEmbedding = await this.userProfileEmbeddingModel.findOne({
      where: {
        userProfileId,
        type: embeddingType,
      },
    });

    if (existingEmbedding) {
      await existingEmbedding.update({
        embedding,
        configVersion: EMBEDDING_CONFIG[embeddingType].version,
      });
    } else {
      await this.userProfileEmbeddingModel.create({
        userProfileId,
        type: embeddingType,
        embedding,
        configVersion: EMBEDDING_CONFIG[embeddingType].version,
      });
    }
  }

  async resetLastRecommendationsDate(userId: string): Promise<void> {
    this.logger.log(
      `[Recommendations] Invalidating cached recommendations for user ${userId}`
    );
    await this.userProfileModel.update(
      { lastRecommendationsDate: null },
      { where: { userId } }
    );
    this.logger.log(
      `[Recommendations] lastRecommendationsDate reset to null for user ${userId} — pool will be recomputed on next request`
    );
  }

  async clearEmbeddingPending(userId: string): Promise<void> {
    await this.userProfileModel.update(
      { embeddingPendingAt: null },
      { where: { userId } }
    );
  }
}
