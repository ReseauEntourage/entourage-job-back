import { APIConnectionTimeoutError } from '@anthropic-ai/sdk';
import { Injectable, Logger } from '@nestjs/common';
import { AnthropicService } from 'src/external-services/anthropic/anthropic.service';
import { tracer } from 'src/tracer';
import {
  buildHelpGroupTitleSystemPrompt,
  buildHelpGroupTitleUserMessage,
  cleanHelpGroupTitle,
  HELP_GROUP_TITLE_CONFIG,
  HELP_GROUP_TITLE_OUTPUT_SCHEMA,
  isHelpGroupTitleOutput,
} from './help-groups-title.config';

type HelpGroupTitleOutcome =
  'success' | 'empty' | 'refused' | 'timeout' | 'error';

/**
 * Proposes a discussion title from the member's message. Never throws: any
 * failure, refusal or timeout gives `{ title: null }` and the member writes
 * their own title. The model answer is constrained to a JSON schema, so
 * nothing but a title is ever returned. The message content and the model
 * output are never logged.
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
        let outcome: HelpGroupTitleOutcome = 'error';
        try {
          const result = await this.generate(content, previousTitles);
          outcome = result.outcome;
          return { title: result.title };
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
  ): Promise<{ title: string | null; outcome: HelpGroupTitleOutcome }> {
    const output = await this.anthropicService.generateStructured(
      buildHelpGroupTitleSystemPrompt(),
      buildHelpGroupTitleUserMessage(content, previousTitles),
      HELP_GROUP_TITLE_OUTPUT_SCHEMA,
      {
        maxTokens: HELP_GROUP_TITLE_CONFIG.maxTokens,
        timeoutMs: HELP_GROUP_TITLE_CONFIG.timeoutMs,
        operation: HELP_GROUP_TITLE_CONFIG.operation,
        feature: HELP_GROUP_TITLE_CONFIG.feature,
      }
    );
    if (!isHelpGroupTitleOutput(output)) {
      throw new Error('Unexpected structured output shape');
    }
    if (output.cannotTitle) {
      this.logger.warn('[HelpGroupsTitle] The model renounced to a title');
      return { title: null, outcome: 'refused' };
    }
    const title = cleanHelpGroupTitle(output.title);
    if (!title) {
      this.logger.warn('[HelpGroupsTitle] Empty generation');
      return { title: null, outcome: 'empty' };
    }
    return { title, outcome: 'success' };
  }
}
