import { Injectable, Logger } from '@nestjs/common';
import { VoyageAIClient, VoyageAIError } from 'voyageai';

import { EMBEDDING_MODEL } from 'src/embeddings/embedding.config';

@Injectable()
export class VoyageAiService {
  private readonly voyageAi: VoyageAIClient;
  private readonly logger = new Logger(VoyageAiService.name);

  constructor() {
    this.voyageAi = new VoyageAIClient({
      apiKey: process.env.VOYAGEAI_API_KEY ?? '',
    });
  }

  async generateEmbedding(data: string): Promise<number[]> {
    try {
      const response = await this.voyageAi.embed({
        input: data,
        model: EMBEDDING_MODEL,
      });
      return response.data[0].embedding;
    } catch (error) {
      if (error instanceof VoyageAIError) {
        this.logger.error(
          `VoyageAI API error: ${error.message} (status code: ${error.statusCode})`,
          {
            statusCode: error.statusCode,
            message: error.message,
            body: error.body,
            rawResponse: error.rawResponse,
          }
        );
      }
      throw new Error('Failed to generate embedding');
    }
  }
}
