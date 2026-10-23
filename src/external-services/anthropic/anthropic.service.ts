import Anthropic from '@anthropic-ai/sdk';
import {
  MessageParam,
  TextBlockParam,
} from '@anthropic-ai/sdk/resources/messages';
import { Injectable } from '@nestjs/common';
import {
  AiModelUse,
  getAiModel,
} from 'src/external-services/ai-models/ai-models';
import { LlmMetricsService } from 'src/external-services/llm-metrics/llm-metrics.service';
import { AiFeature } from 'src/external-services/llm-observability/ai-feature.enum';

export interface GenerateTextOptions {
  feature?: AiFeature;
  maxTokens?: number;
  /** Defaults to the model of the escalation classifier. */
  model?: string;
  operation?: string;
  timeoutMs?: number;
}

export interface GenerateStructuredOptions {
  feature: AiFeature;
  maxTokens: number;
  /** Defaults to the model of the escalation classifier. */
  model?: string;
  operation: string;
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
      model: getAiModel(AiModelUse.AI_ASSISTANT),
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
      model = getAiModel(AiModelUse.AI_ASSISTANT_CLASSIFIER),
      timeoutMs,
      operation = 'classify',
      feature = AiFeature.AI_ASSISTANT,
    } = options;
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

  /**
   * Single non-streamed Haiku call whose answer is constrained to a JSON
   * schema (structured outputs). Returns the parsed JSON, whose shape the
   * caller must still validate. Throws when the answer is cut by `maxTokens`,
   * is not a text block or is not valid JSON, so that a partial answer is
   * never used. When `timeoutMs` is set, the SDK's automatic retries are
   * disabled so the call never exceeds that budget.
   */
  async generateStructured(
    systemPrompt: string,
    userMessage: string,
    schema: Record<string, unknown>,
    options: GenerateStructuredOptions
  ): Promise<unknown> {
    const {
      maxTokens,
      model = getAiModel(AiModelUse.AI_ASSISTANT_CLASSIFIER),
      timeoutMs,
      operation,
      feature,
    } = options;
    const response = await this.client.messages.create(
      {
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
        output_config: { format: { type: 'json_schema', schema } },
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
    if (response.stop_reason === 'max_tokens') {
      throw new Error('Structured output truncated by max_tokens');
    }
    const block = response.content[0];
    if (!block || block.type !== 'text') {
      throw new Error('Structured output is not a text block');
    }
    return JSON.parse(block.text);
  }
}
