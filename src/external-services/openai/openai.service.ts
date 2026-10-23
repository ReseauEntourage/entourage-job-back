import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import type {
  ChatCompletionContentPart,
  ChatCompletionMessage,
} from 'openai/resources/chat/completions';
import type { ReasoningEffort } from 'openai/resources/shared';
import {
  AiModelUse,
  getAiModel,
  getReasoningEffort,
} from 'src/external-services/ai-models/ai-models';
import { LlmMetricsService } from 'src/external-services/llm-metrics/llm-metrics.service';
import { AiFeature } from 'src/external-services/llm-observability/ai-feature.enum';
import {
  cvTextForTrace,
  pagesNotAttachedMarker,
  totalPagesBytes,
} from 'src/external-services/llm-observability/cv-trace';
import {
  AiWorkflowOutcome,
  LlmCallAnnotation,
  traceLlmCall,
} from 'src/external-services/llm-observability/llm-observability';
import {
  buildCVBuildingUserMessage,
  CV_BUILDING_SYSTEM_PROMPT,
  CV_EXTRACTION_SYSTEM_PROMPT,
  CV_EXTRACTION_USER_TEXT,
  CV_READING_MIN_CHARS,
  CV_READING_SYSTEM_PROMPT,
  CV_READING_USER_TEXT,
  isTwoPassExtractionEnabled,
} from './cv-extraction.config';
import { CvReadingError } from './cv-reading.error';
import { cvSchema, CvExtractionResult, CvSchemaType } from './openai.schemas';

interface TracedPass {
  /** Prefix of the error thrown when the call fails. */
  failure: string;
  inputMessages: NonNullable<LlmCallAnnotation['inputMessages']>;
  metadata: Record<string, unknown>;
  model: string;
  name: string;
  /** Operation tagged on the token metrics. */
  operation: string;
  signal?: AbortSignal;
  /** Step tagged on the span of a pass of the two-pass extraction. */
  step?: 'reading' | 'building';
}

@Injectable()
export class OpenAiService {
  private readonly openai: OpenAI;
  private readonly logger = new Logger(OpenAiService.name);

  constructor(private readonly llmMetrics: LlmMetricsService) {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Extracts the profile data of a CV from its page images, in one call or, when
   * the two-pass extraction is enabled, in two: a reading pass (pages to text)
   * then a building pass (text to profile data). The same signal covers both
   * calls, and is checked between them.
   *
   * @param base64ImageArray The pages of the CV, as base64 PNG
   * @returns The profile data, and the text read from the CV (two passes only)
   */
  async extractCVFromImages(
    base64ImageArray: string[],
    signal?: AbortSignal
  ): Promise<CvExtractionResult> {
    if (!isTwoPassExtractionEnabled()) {
      return {
        data: await this.extractInOneCall(base64ImageArray, signal),
        transcript: null,
      };
    }

    const transcript = await this.readCVPages(base64ImageArray, signal);
    if (signal?.aborted) {
      throw new Error('Extraction du CV interrompue (annulation du job)');
    }

    return {
      data: await this.buildProfileFromCVText(transcript, signal),
      transcript,
    };
  }

  /**
   * Builds the profile data from a text already read from the CV, without
   * reading the CV again.
   */
  async buildCVFromTranscript(
    transcript: string,
    signal?: AbortSignal
  ): Promise<CvExtractionResult> {
    return {
      data: await this.buildProfileFromCVText(transcript, signal),
      transcript,
    };
  }

  /** Single call: reads the pages and builds the profile at once. */
  private async extractInOneCall(
    base64ImageArray: string[],
    signal?: AbortSignal
  ): Promise<CvSchemaType> {
    // The pages themselves stay out of the trace: they hold personal data and
    // Datadog judges cannot read attached images.
    const model = getAiModel(AiModelUse.CV_EXTRACTION);
    return this.tracedPass(
      {
        operation: 'cv_extraction',
        failure: "Impossible d'extraire les données du CV à partir d'images",
        name: 'cv-extraction-llm',
        model,
        inputMessages: [
          { role: 'system', content: CV_EXTRACTION_SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              CV_EXTRACTION_USER_TEXT,
              pagesNotAttachedMarker(base64ImageArray.length),
            ]
              .filter(Boolean)
              .join('\n'),
          },
        ],
        metadata: {
          pageCount: base64ImageArray.length,
          imagesBytes: totalPagesBytes(base64ImageArray),
          ...this.effortMetadata(AiModelUse.CV_EXTRACTION),
        },
        signal,
      },
      (annotateCall) =>
        this.requestProfile(
          model,
          AiModelUse.CV_EXTRACTION,
          CV_EXTRACTION_SYSTEM_PROMPT,
          [
            { type: 'text', text: CV_EXTRACTION_USER_TEXT },
            ...this.pageParts(base64ImageArray),
          ],
          annotateCall,
          'cv_extraction',
          signal
        )
    );
  }

  /** Reading pass: the pages in, the text of the CV out. */
  private async readCVPages(
    base64ImageArray: string[],
    signal?: AbortSignal
  ): Promise<string> {
    const model = getAiModel(AiModelUse.CV_READING);
    return this.tracedPass(
      {
        operation: 'cv_reading',
        failure: 'Impossible de lire le CV à partir des images',
        name: 'cv-reading',
        model,
        step: 'reading',
        inputMessages: [
          { role: 'system', content: CV_READING_SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              CV_READING_USER_TEXT,
              pagesNotAttachedMarker(base64ImageArray.length),
            ]
              .filter(Boolean)
              .join('\n'),
          },
        ],
        metadata: {
          pageCount: base64ImageArray.length,
          imagesBytes: totalPagesBytes(base64ImageArray),
          ...this.effortMetadata(AiModelUse.CV_READING),
        },
        signal,
      },
      async (annotateCall) => {
        const response = await this.openai.chat.completions.create(
          {
            model,
            max_completion_tokens: this.maxCompletionTokens(),
            ...this.effortParam(AiModelUse.CV_READING),
            messages: [
              { role: 'system', content: CV_READING_SYSTEM_PROMPT },
              {
                role: 'user',
                content: [
                  { type: 'text', text: CV_READING_USER_TEXT },
                  ...this.pageParts(base64ImageArray),
                ],
              },
            ],
          },
          { signal }
        );

        this.recordUsage(response.usage, 'cv_reading', model, annotateCall);

        const choice = response.choices?.[0];
        const text = (choice?.message?.content ?? '').trim();

        if (choice?.finish_reason === 'length') {
          throw new CvReadingError(
            'truncated',
            `OpenAI a coupé la lecture du CV par limite de tokens (finish_reason=length). ` +
              `usage=${JSON.stringify(response.usage)}`
          );
        }
        if (text.length < CV_READING_MIN_CHARS) {
          throw new CvReadingError(
            'empty',
            `La lecture du CV n'a produit aucun texte exploitable (${text.length} caractères).`
          );
        }

        annotateCall({
          outputMessages: [
            { role: 'assistant', content: cvTextForTrace(text) },
          ],
        });
        return text;
      }
    );
  }

  /** Building pass: the text of the CV in, the profile data out. */
  private async buildProfileFromCVText(
    text: string,
    signal?: AbortSignal
  ): Promise<CvSchemaType> {
    const userMessage = buildCVBuildingUserMessage(text);
    const model = getAiModel(AiModelUse.CV_BUILDING);

    return this.tracedPass(
      {
        operation: 'cv_building',
        failure: 'Impossible de construire le profil à partir du texte du CV',
        name: 'cv-building',
        model,
        step: 'building',
        inputMessages: [
          { role: 'system', content: CV_BUILDING_SYSTEM_PROMPT },
          { role: 'user', content: cvTextForTrace(text, userMessage) },
        ],
        metadata: {
          textChars: text.length,
          ...this.effortMetadata(AiModelUse.CV_BUILDING),
        },
        signal,
      },
      (annotateCall) =>
        this.requestProfile(
          model,
          AiModelUse.CV_BUILDING,
          CV_BUILDING_SYSTEM_PROMPT,
          userMessage,
          annotateCall,
          'cv_building',
          signal
        )
    );
  }

  /**
   * Runs one call of the extraction in its own LLM span: the automatic OpenAI
   * span would turn the pages into an `[image]` marker (and is switched off, see
   * src/tracer.ts). The span carries its step and its outcome, and the error of
   * the call is rethrown with the context of the pass.
   */
  private async tracedPass<T>(
    pass: TracedPass,
    run: (annotateCall: (annotation: LlmCallAnnotation) => void) => Promise<T>
  ): Promise<T> {
    return traceLlmCall(
      {
        name: pass.name,
        modelName: pass.model,
        modelProvider: 'openai',
        tags: pass.step ? { step: pass.step } : {},
      },
      async (annotateCall) => {
        annotateCall({
          inputMessages: pass.inputMessages,
          metadata: pass.metadata,
        });

        try {
          return await run(annotateCall);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          if (pass.signal?.aborted) {
            annotateCall({ outcome: 'cancelled' });
            this.logger.debug(
              `Extraction du CV interrompue (annulation du job): ${message}`
            );
          } else {
            annotateCall({ outcome: this.outcomeOf(error) });
            this.logger.error(`${pass.failure}: ${message}`);
          }
          throw new Error(`${pass.failure}: ${message}`);
        }
      }
    );
  }

  private outcomeOf(error: unknown): AiWorkflowOutcome {
    if (error instanceof CvReadingError) {
      return error.outcome;
    }
    // Matched by name: the SDK class is not exported by the test doubles
    return error instanceof Error && error.name === 'APIConnectionTimeoutError'
      ? 'timeout'
      : 'error';
  }

  /** Forced tool call that returns the profile data of a CV. */
  private async requestProfile(
    model: string,
    use: AiModelUse,
    systemPrompt: string,
    userContent: string | ChatCompletionContentPart[],
    annotateCall: (annotation: LlmCallAnnotation) => void,
    operation: string,
    signal?: AbortSignal
  ): Promise<CvSchemaType> {
    const response = await this.openai.chat.completions.create(
      {
        model,
        max_completion_tokens: this.maxCompletionTokens(),
        ...this.effortParam(use),
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'extract_cv_data',
              description: "Extraire les données structurées d'un CV",
              parameters: cvSchema,
            },
          },
        ],
        tool_choice: {
          type: 'function',
          function: { name: 'extract_cv_data' },
        },
      },
      { signal }
    );

    if (response.usage) {
      annotateCall({ metrics: this.usageMetrics(response.usage) });
    }

    const choice = response.choices?.[0];
    const toolCalls = (choice?.message as ChatCompletionMessage)?.tool_calls;
    const toolCall = toolCalls?.[0];
    const functionArgs =
      toolCall && 'function' in toolCall
        ? toolCall.function?.arguments
        : undefined;

    if (!functionArgs) {
      const finishReason = choice?.finish_reason;
      const usage = response.usage;
      this.logger.error(
        `OpenAI: aucun tool_call retourné (finish_reason=${String(
          finishReason
        )}). usage=${JSON.stringify(usage)}`
      );

      if (finishReason === 'length') {
        throw new Error(
          `OpenAI a coupé la réponse par limite de tokens (finish_reason=length). ` +
            `Essaie de réduire le nombre/poids des images, ou augmente OPENAI_MAX_COMPLETION_TOKENS. ` +
            `usage=${JSON.stringify(usage)}`
        );
      }

      throw new Error(
        `Aucun tool_call n'a été retourné par l'API OpenAI (finish_reason=${String(
          finishReason
        )}).`
      );
    }

    if (response.usage) {
      this.logger.debug(
        `OpenAI usage for CV extraction: ${JSON.stringify(response.usage)}`
      );
      this.llmMetrics.recordOpenAiUsage(
        model,
        response.usage,
        operation,
        AiFeature.CV_EXTRACTION
      );
    }

    annotateCall({
      outputMessages: [{ role: 'assistant', content: functionArgs }],
    });

    // Analyser les arguments JSON
    return JSON.parse(functionArgs) as CvSchemaType;
  }

  private pageParts(base64ImageArray: string[]): ChatCompletionContentPart[] {
    return base64ImageArray.map((base64Image) => ({
      type: 'image_url',
      image_url: { url: `data:image/png;base64,${base64Image}` },
    }));
  }

  /** `reasoning_effort` request parameter of a usage, absent when not configured. */
  private effortParam(use: AiModelUse): { reasoning_effort?: ReasoningEffort } {
    const effort = getReasoningEffort(use);
    return effort ? { reasoning_effort: effort as ReasoningEffort } : {};
  }

  /** Span metadata telling which reasoning effort was requested, if any. */
  private effortMetadata(use: AiModelUse): { reasoningEffort?: string } {
    const effort = getReasoningEffort(use);
    return effort ? { reasoningEffort: effort } : {};
  }

  private maxCompletionTokens(): number {
    return Number(process.env.OPENAI_MAX_COMPLETION_TOKENS ?? 4096);
  }

  /**
   * Token counts of a span. The reasoning tokens (reasoning models only) are
   * already counted in the output tokens: they are sent as a breakdown, so that
   * the part of the output the model spent thinking can be told from the text it
   * produced.
   */
  private usageMetrics(
    usage: OpenAI.Completions.CompletionUsage
  ): NonNullable<LlmCallAnnotation['metrics']> {
    const reasoningTokens = usage.completion_tokens_details?.reasoning_tokens;
    return {
      inputTokens: usage.prompt_tokens,
      outputTokens: usage.completion_tokens,
      totalTokens: usage.total_tokens,
      ...(reasoningTokens !== undefined
        ? { reasoningOutputTokens: reasoningTokens }
        : {}),
    };
  }

  private recordUsage(
    usage: OpenAI.Completions.CompletionUsage | undefined,
    operation: string,
    model: string,
    annotateCall: (annotation: LlmCallAnnotation) => void
  ): void {
    if (!usage) {
      return;
    }
    annotateCall({ metrics: this.usageMetrics(usage) });
    this.logger.debug(
      `OpenAI usage for CV extraction: ${JSON.stringify(usage)}`
    );
    this.llmMetrics.recordOpenAiUsage(
      model,
      usage,
      operation,
      AiFeature.CV_EXTRACTION
    );
  }
}
