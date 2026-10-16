import { APIConnectionTimeoutError } from '@anthropic-ai/sdk';
import { Injectable, Logger } from '@nestjs/common';
import { AnthropicService } from 'src/external-services/anthropic/anthropic.service';
import { tracer } from 'src/tracer';
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
    // Dedicated LLM Observability span: the Datadog bias evaluations target
    // the `help-groups-title` workflow
    return tracer.llmobs.trace(
      { kind: 'workflow', name: 'help-groups-title' },
      async () => {
        let outcome = 'error';
        try {
          const result = await this.generate(content, previousTitles);
          outcome = result.title ? 'success' : 'empty';
          return result;
        } catch (error) {
          outcome =
            error instanceof APIConnectionTimeoutError ? 'timeout' : 'error';
          this.logger.warn(
            `[HelpGroupsTitle] ${outcome}: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
          return { title: null };
        } finally {
          tracer.llmobs.annotate({
            tags: {
              feature: HELP_GROUP_TITLE_CONFIG.feature,
              isRetry: String(previousTitles.length > 0),
              outcome,
            },
          });
        }
      }
    );
  }

  private async generate(
    content: string,
    previousTitles: string[]
  ): Promise<{ title: string | null }> {
    const raw = await this.anthropicService.generateText(
      buildHelpGroupTitleSystemPrompt(),
      buildHelpGroupTitleUserMessage(content, previousTitles),
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
  }
}
