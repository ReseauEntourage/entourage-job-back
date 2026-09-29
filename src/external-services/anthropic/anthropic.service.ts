import Anthropic from '@anthropic-ai/sdk';
import {
  MessageParam,
  TextBlockParam,
} from '@anthropic-ai/sdk/resources/messages';
import { Injectable } from '@nestjs/common';
import { LlmMetricsService } from 'src/external-services/llm-metrics/llm-metrics.service';

export interface GenerateTextOptions {
  feature?: string;
  maxTokens?: number;
  operation?: string;
  timeoutMs?: number;
}

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

  /**
   * Single non-streamed Haiku call. Defaults match the messaging assistant's
   * escalation classifier. When `timeoutMs` is set, the SDK's automatic
   * retries are disabled so the call never exceeds that budget.
   */
  async generateText(
    systemPrompt: string,
    userMessage: string,
    options: GenerateTextOptions = {}
  ): Promise<string> {
    const {
      maxTokens = 5,
      timeoutMs,
      operation = 'classify',
      feature = 'ai_assistant',
    } = options;
    const model = 'claude-haiku-4-5-20251001';
    const response = await this.client.messages.create(
      {
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      },
      timeoutMs !== undefined
        ? { timeout: timeoutMs, maxRetries: 0 }
        : undefined
    );
    this.llmMetrics.recordAnthropicUsage(
      model,
      response.usage,
      operation,
      feature
    );
    const block = response.content[0];
    return block.type === 'text' ? block.text : '';
  }
}
