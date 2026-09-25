import Anthropic from '@anthropic-ai/sdk';
import {
  MessageParam,
  TextBlockParam,
} from '@anthropic-ai/sdk/resources/messages';
import { Injectable } from '@nestjs/common';
import { LlmMetricsService } from 'src/external-services/llm-metrics/llm-metrics.service';

@Injectable()
export class AnthropicService {
  private readonly client: Anthropic;

  // Output cap for the AI assistant stream. Long structured answers (several
  // markdown sections) used to hit the former 1024 cap mid-sentence (EN-9593).
  private readonly STREAM_MAX_TOKENS = 4096;

  constructor(private readonly llmMetrics: LlmMetricsService) {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  /**
   * Returns the raw Anthropic message stream (async iterable).
   * Callers iterate over it to produce SSE events.
   *
   * systemBlocks is an array of text blocks; blocks marked with
   * cache_control are eligible for Anthropic prompt caching (TTL 5 min).
   */
  createStream(systemBlocks: TextBlockParam[], messages: MessageParam[]) {
    return this.client.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: this.STREAM_MAX_TOKENS,
      system: systemBlocks,
      messages,
    });
  }

  async generateText(
    systemPrompt: string,
    userMessage: string,
    maxTokens = 5
  ): Promise<string> {
    const model = 'claude-haiku-4-5-20251001';
    const response = await this.client.messages.create({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });
    this.llmMetrics.recordAnthropicUsage(
      model,
      response.usage,
      'classify',
      'ai_assistant'
    );
    const block = response.content[0];
    return block.type === 'text' ? block.text : '';
  }
}
