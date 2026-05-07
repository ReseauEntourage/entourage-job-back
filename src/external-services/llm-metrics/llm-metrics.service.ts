import { Usage } from '@anthropic-ai/sdk/resources/messages/messages';
import { Injectable, Logger } from '@nestjs/common';
import { CompletionUsage } from 'openai/resources/completions';
import { tracer } from 'src/tracer';

@Injectable()
export class LlmMetricsService {
  private readonly logger = new Logger(LlmMetricsService.name);
  recordAnthropicUsage(
    model: string,
    usage: Usage,
    operation: string,
    feature: string
  ): void {
    const tags = { model, provider: 'anthropic', operation, feature };

    tracer.dogstatsd.increment('ai.tokens.input', usage.input_tokens, tags);
    tracer.dogstatsd.increment('ai.tokens.output', usage.output_tokens, tags);

    const cacheReadTokens = usage.cache_read_input_tokens ?? 0;
    const cacheWriteTokens = usage.cache_creation_input_tokens ?? 0;

    if (cacheReadTokens > 0) {
      tracer.dogstatsd.increment('ai.tokens.cache_read', cacheReadTokens, tags);
    }
    if (cacheWriteTokens > 0) {
      tracer.dogstatsd.increment(
        'ai.tokens.cache_write',
        cacheWriteTokens,
        tags
      );
    }

    tracer.dogstatsd.flush();
  }

  recordOpenAiUsage(
    model: string,
    usage: CompletionUsage,
    operation: string,
    feature: string
  ): void {
    const tags = { model, provider: 'openai', operation, feature };
    tracer.dogstatsd.increment('ai.tokens.input', usage.prompt_tokens, tags);
    tracer.dogstatsd.increment(
      'ai.tokens.output',
      usage.completion_tokens,
      tags
    );
    this.logger.debug(
      `OpenAI usage recorded: ${JSON.stringify({
        model,
        operation,
        feature,
        prompt_tokens: usage.prompt_tokens,
        completion_tokens: usage.completion_tokens,
      })}`
    );

    tracer.dogstatsd.flush();
  }
}
