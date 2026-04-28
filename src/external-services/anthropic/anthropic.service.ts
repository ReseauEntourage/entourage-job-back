import Anthropic from '@anthropic-ai/sdk';
import { MessageParam } from '@anthropic-ai/sdk/resources/messages';
import { Injectable } from '@nestjs/common';

@Injectable()
export class AnthropicService {
  private readonly client: Anthropic;

  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  /**
   * Returns the raw Anthropic message stream (async iterable).
   * Callers iterate over it to produce SSE events.
   */
  createStream(systemPrompt: string, messages: MessageParam[]) {
    return this.client.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: systemPrompt,
      messages,
    });
  }

  async generateText(
    systemPrompt: string,
    userMessage: string,
    maxTokens = 5
  ): Promise<string> {
    const response = await this.client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });
    const block = response.content[0];
    return block.type === 'text' ? block.text : '';
  }
}
