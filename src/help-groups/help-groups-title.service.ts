import { APIConnectionTimeoutError } from '@anthropic-ai/sdk';
import { Injectable, Logger } from '@nestjs/common';
import {
  AiModelUse,
  getAiModel,
} from 'src/external-services/ai-models/ai-models';
import { AnthropicService } from 'src/external-services/anthropic/anthropic.service';
import { traceAiWorkflow } from 'src/external-services/llm-observability/llm-observability';
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
    // Dedicated LLM Observability span: keep its `help-groups-title` name
    // stable, queries and evaluations may target it
    return traceAiWorkflow(
      {
        feature: HELP_GROUP_TITLE_CONFIG.feature,
        name: 'help-groups-title',
        tags: { isRetry: String(previousTitles.length > 0) },
      },
      async ({ setOutcome }) => {
        try {
          const result = await this.generate(content, previousTitles);
          setOutcome(result.outcome);
          return { title: result.title };
        } catch (error) {
          const outcome =
            error instanceof APIConnectionTimeoutError ? 'timeout' : 'error';
          setOutcome(outcome);
          this.logger.warn(
            `[HelpGroupsTitle] ${outcome}: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
          return { title: null };
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
        model: getAiModel(AiModelUse.HELP_GROUPS_TITLE),
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
