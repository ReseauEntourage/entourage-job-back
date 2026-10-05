import { APIConnectionTimeoutError } from '@anthropic-ai/sdk';
import { Injectable, Logger } from '@nestjs/common';
import { AnthropicService } from 'src/external-services/anthropic/anthropic.service';
import {
  buildHelpGroupTitleSystemPrompt,
  buildHelpGroupTitleUserMessage,
  cleanHelpGroupTitle,
  HELP_GROUP_TITLE_CONFIG,
} from './help-groups-title.config';

/**
 * Proposes a discussion title from the member's message. Never throws: any
 * failure or timeout gives `{ title: null }` and the member writes their own
 * title. The message content is never logged.
 */
@Injectable()
export class HelpGroupsTitleService {
  private readonly logger = new Logger(HelpGroupsTitleService.name);

  constructor(private readonly anthropicService: AnthropicService) {}

  async suggestTitle(
    content: string,
    previousTitles: string[] = []
  ): Promise<{ title: string | null }> {
    try {
      const raw = await this.anthropicService.generateText(
        buildHelpGroupTitleSystemPrompt(previousTitles),
        buildHelpGroupTitleUserMessage(content),
        {
          maxTokens: HELP_GROUP_TITLE_CONFIG.maxTokens,
          timeoutMs: HELP_GROUP_TITLE_CONFIG.timeoutMs,
          operation: HELP_GROUP_TITLE_CONFIG.operation,
          feature: HELP_GROUP_TITLE_CONFIG.feature,
        }
      );
      const title = cleanHelpGroupTitle(raw);
      if (!title) {
        this.logger.warn('[HelpGroupsTitle] Empty generation');
      }
      return { title };
    } catch (error) {
      this.logger.warn(
        `[HelpGroupsTitle] ${
          error instanceof APIConnectionTimeoutError ? 'timeout' : 'error'
        }: ${error instanceof Error ? error.message : String(error)}`
      );
      return { title: null };
    }
  }
}
