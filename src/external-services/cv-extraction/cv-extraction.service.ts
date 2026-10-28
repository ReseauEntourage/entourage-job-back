import Anthropic from '@anthropic-ai/sdk';
import { transformJSONSchema } from '@anthropic-ai/sdk/lib/transform-json-schema';
import type {
  ContentBlockParam,
  ImageBlockParam,
  Message,
  OutputConfig,
  Usage,
} from '@anthropic-ai/sdk/resources/messages';
import { Injectable, Logger } from '@nestjs/common';
import {
  AiModelUse,
  getAiEffort,
  getAiModel,
} from 'src/external-services/ai-models/ai-models';
import { AnthropicService } from 'src/external-services/anthropic/anthropic.service';
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
import { CvExtractionError } from './cv-extraction.error';
import {
  cvSchema,
  CvExtractionResult,
  CvSchemaType,
} from './cv-extraction.schemas';

/**
 * The schema sent to Anthropic's structured outputs. The constraints it does
 * not support (lengths, counts) are moved into the descriptions by the SDK and
 * the text is still cut on import. The lists are required (they may be empty):
 * a schema is limited to 24 optional properties, and this one has 23 otherwise.
 */
const CV_OUTPUT_SCHEMA = (() => {
  const schema = transformJSONSchema(cvSchema as never) as {
    required?: string[];
  };
  schema.required = [
    ...(schema.required ?? []),
    'skills',
    'experiences',
    'formations',
    'languages',
    'interests',
  ];
  return schema as Record<string, unknown>;
})();

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
export class CvExtractionService {
  private readonly logger = new Logger(CvExtractionService.name);

  constructor(
    private readonly anthropicService: AnthropicService,
    private readonly llmMetrics: LlmMetricsService
  ) {}

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
            ...this.pageParts(base64ImageArray),
            { type: 'text', text: CV_EXTRACTION_USER_TEXT },
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
        const response = await this.anthropicService.createMessageUntraced(
          {
            model,
            max_tokens: this.maxTokens(),
            system: CV_READING_SYSTEM_PROMPT,
            messages: [
              {
                role: 'user',
                content: [
                  ...this.pageParts(base64ImageArray),
                  { type: 'text', text: CV_READING_USER_TEXT },
                ],
              },
            ],
            ...this.outputConfig(AiModelUse.CV_READING),
          },
          { signal }
        );

        this.recordUsage(response.usage, 'cv_reading', model, annotateCall);
        this.assertAnswered(response, 'la lecture du CV');

        const text = this.textOf(response).trim();
        if (text.length < CV_READING_MIN_CHARS) {
          throw new CvExtractionError(
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
   * Runs one call of the extraction in its own LLM span: the call is not seen
   * by the automatic Anthropic span (see `createMessageUntraced`), so the span
   * carries what we choose to send: its step, its outcome and no page. The error
   * of the call is rethrown with the context of the pass.
   */
  private async tracedPass<T>(
    pass: TracedPass,
    run: (annotateCall: (annotation: LlmCallAnnotation) => void) => Promise<T>
  ): Promise<T> {
    return traceLlmCall(
      {
        name: pass.name,
        modelName: pass.model,
        modelProvider: 'anthropic',
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
    if (error instanceof CvExtractionError) {
      return error.outcome;
    }
    return error instanceof Anthropic.APIConnectionTimeoutError
      ? 'timeout'
      : 'error';
  }

  /** Structured output that returns the profile data of a CV. */
  private async requestProfile(
    model: string,
    use: AiModelUse,
    systemPrompt: string,
    userContent: string | ContentBlockParam[],
    annotateCall: (annotation: LlmCallAnnotation) => void,
    operation: string,
    signal?: AbortSignal
  ): Promise<CvSchemaType> {
    const response = await this.anthropicService.createMessageUntraced(
      {
        model,
        max_tokens: this.maxTokens(),
        system: systemPrompt,
        messages: [{ role: 'user', content: userContent }],
        ...this.outputConfig(use, {
          type: 'json_schema',
          schema: CV_OUTPUT_SCHEMA,
        }),
      },
      { signal }
    );

    this.recordUsage(response.usage, operation, model, annotateCall);
    this.assertAnswered(response, 'la réponse');

    const answer = this.textOf(response);
    if (!answer) {
      throw new Error("Aucun contenu structuré n'a été retourné par l'API.");
    }

    annotateCall({ outputMessages: [{ role: 'assistant', content: answer }] });

    return JSON.parse(answer) as CvSchemaType;
  }

  /**
   * Throws when the model refused to answer or was cut by the token limit: a
   * partial text or a partial JSON must never be used.
   */
  private assertAnswered(response: Message, subject: string): void {
    if (response.stop_reason === 'refusal') {
      throw new CvExtractionError(
        'refused',
        `Anthropic a refusé de traiter ${subject} (stop_reason=refusal, ${JSON.stringify(
          response.stop_details ?? null
        )}).`
      );
    }
    if (response.stop_reason === 'max_tokens') {
      throw new CvExtractionError(
        'truncated',
        `Anthropic a coupé ${subject} par limite de tokens (stop_reason=max_tokens). ` +
          `Essaie de réduire le nombre/poids des images, ou augmente CV_EXTRACTION_MAX_TOKENS. ` +
          `usage=${JSON.stringify(response.usage)}`
      );
    }
  }

  /** The text of the answer (the thinking blocks, if any, are left out). */
  private textOf(response: Message): string {
    return response.content
      .flatMap((block) => (block.type === 'text' ? [block.text] : []))
      .join('');
  }

  private pageParts(base64ImageArray: string[]): ImageBlockParam[] {
    return base64ImageArray.map((base64Image) => ({
      type: 'image',
      source: {
        type: 'base64',
        media_type: 'image/png',
        data: base64Image,
      },
    }));
  }

  /** `output_config` of a usage: its effort, and the format when structured. */
  private outputConfig(
    use: AiModelUse,
    format?: OutputConfig['format']
  ): { output_config: OutputConfig } {
    const effort = getAiEffort(use);
    return {
      output_config: {
        ...(effort ? { effort } : {}),
        ...(format ? { format } : {}),
      },
    };
  }

  /** Span metadata telling which effort was requested, if any. */
  private effortMetadata(use: AiModelUse): { effort?: string } {
    const effort = getAiEffort(use);
    return effort ? { effort } : {};
  }

  /**
   * Output cap of a call. Part of it can be spent thinking, which the effort
   * limits: a long CV needs room for its text on top.
   */
  private maxTokens(): number {
    return Number(process.env.CV_EXTRACTION_MAX_TOKENS ?? 8192);
  }

  private usageMetrics(
    usage: Usage
  ): NonNullable<LlmCallAnnotation['metrics']> {
    return {
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
      totalTokens: usage.input_tokens + usage.output_tokens,
    };
  }

  private recordUsage(
    usage: Usage | undefined,
    operation: string,
    model: string,
    annotateCall: (annotation: LlmCallAnnotation) => void
  ): void {
    if (!usage) {
      return;
    }
    annotateCall({ metrics: this.usageMetrics(usage) });
    this.logger.debug(
      `Anthropic usage for CV extraction: ${JSON.stringify(usage)}`
    );
    this.llmMetrics.recordAnthropicUsage(
      model,
      usage,
      operation,
      AiFeature.CV_EXTRACTION
    );
  }
}
