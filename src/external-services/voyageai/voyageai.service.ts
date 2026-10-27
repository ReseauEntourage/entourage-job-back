import { Injectable, Logger } from '@nestjs/common';
import { VoyageAIClient, VoyageAIError } from 'voyageai';

import { LlmMetricsService } from '../llm-metrics/llm-metrics.service';
import { EMBEDDING_MODEL } from 'src/embeddings/embedding.config';
import { AiFeature } from 'src/external-services/llm-observability/ai-feature.enum';
import { embeddingTextForTrace } from 'src/external-services/llm-observability/embedding-trace';
import { traceLlmCall } from 'src/external-services/llm-observability/llm-observability';

@Injectable()
export class VoyageAiService {
  private readonly voyageAi: VoyageAIClient;
  private readonly logger = new Logger(VoyageAiService.name);

  constructor(private readonly llmMetricsService: LlmMetricsService) {
    this.voyageAi = new VoyageAIClient({
      apiKey: process.env.VOYAGEAI_API_KEY ?? '',
    });
  }

  async generateEmbedding(data: string): Promise<number[]> {
    try {
      const response = await traceLlmCall(
        {
          kind: 'embedding',
          name: 'voyageai-embed',
          modelName: EMBEDDING_MODEL,
          modelProvider: 'voyageai',
        },
        async (annotateCall) => {
          const result = await this.voyageAi.embed({
            input: data,
            model: EMBEDDING_MODEL,
          });
          annotateCall({
            metadata: { input: embeddingTextForTrace(data) },
            ...(result.usage
              ? { metrics: { totalTokens: result.usage.totalTokens } }
              : {}),
          });
          return result;
        }
      );
      if (response.usage) {
        this.llmMetricsService.recordVoyageAiUsage(
          EMBEDDING_MODEL,
          response.usage,
          'embedding',
          AiFeature.PROFILE_RECOMMENDATION
        );
      }
      return response.data[0].embedding;
    } catch (error) {
      if (error instanceof VoyageAIError) {
        this.logger.error(
          `VoyageAI API error: ${error.message} (status code: ${error.statusCode})`,
          {
            statusCode: error.statusCode,
            message: error.message,
          }
        );
      }
      throw new Error('Failed to generate embedding');
    }
  }

  /**
   * Generates embeddings for multiple texts in a single API call.
   * Optimizes calls to VoyageAI by respecting rate limits.
   * @param dataArray Array of texts to convert into embeddings
   * @returns Array of embeddings in the same order as the inputs
   */
  async generateEmbeddingsBatch(dataArray: string[]): Promise<number[][]> {
    if (dataArray.length === 0) {
      return [];
    }

    try {
      this.logger.log(
        `Generating batch of ${dataArray.length} embeddings with VoyageAI`
      );

      const response = await traceLlmCall(
        {
          kind: 'embedding',
          name: 'voyageai-embed',
          modelName: EMBEDDING_MODEL,
          modelProvider: 'voyageai',
        },
        async (annotateCall) => {
          const result = await this.voyageAi.embed({
            input: dataArray,
            model: EMBEDDING_MODEL,
          });
          annotateCall({
            metadata: { input: dataArray.map(embeddingTextForTrace) },
            ...(result.usage
              ? { metrics: { totalTokens: result.usage.totalTokens } }
              : {}),
          });
          return result;
        }
      );

      if (response.usage) {
        this.llmMetricsService.recordVoyageAiUsage(
          EMBEDDING_MODEL,
          response.usage,
          'embedding',
          AiFeature.PROFILE_RECOMMENDATION
        );
      }

      // The API returns an array of embeddings corresponding to the input array
      return response.data.map((item) => item.embedding);
    } catch (error) {
      if (error instanceof VoyageAIError) {
        this.logger.error(
          `VoyageAI API batch error: ${error.message} (status code: ${error.statusCode})`,
          {
            statusCode: error.statusCode,
            message: error.message,
            batchSize: dataArray.length,
          }
        );
      }
      throw new Error(
        `Failed to generate batch embeddings for ${dataArray.length} items`
      );
    }
  }
}
