import { Logger } from '@nestjs/common';
import { tracer } from 'src/tracer';
import { AiFeature } from './ai-feature.enum';

const logger = new Logger('LlmObservability');

export type AiWorkflowOutcome =
  | 'success'
  | 'empty'
  | 'truncated'
  | 'refused'
  | 'timeout'
  | 'error'
  | 'cancelled'
  | 'rate_limited';

export interface AiWorkflowContext {
  /** Adds tags (searchable) and metadata (not searchable) to the root span. */
  annotate: (options: {
    tags?: Record<string, string>;
    metadata?: Record<string, unknown>;
  }) => void;
  /** Outcome tagged on the root span. Defaults to `success`, or `error` if the flow throws. */
  setOutcome: (outcome: AiWorkflowOutcome) => void;
}

interface AiWorkflowOptions {
  feature: AiFeature;
  /** Span name. Kept stable: dashboards and evaluations may target it. */
  name: string;
  tags?: Record<string, string>;
}

export interface LlmImagePart {
  /** Base64 content, without the `data:` prefix. */
  content: string;
  mimeType: string;
}

export interface LlmMessage {
  content: string;
  role: string;
}

export interface LlmCallAnnotation {
  inputMessages?: LlmMessage[];
  metadata?: Record<string, unknown>;
  metrics?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  /** Outcome tagged on the span. Defaults to `success`, or `error` if the call throws. */
  outcome?: AiWorkflowOutcome;
  outputMessages?: LlmMessage[];
}

interface LlmCallOptions {
  modelName: string;
  modelProvider: string;
  name: string;
  /** Searchable tags of the span, such as the step of a flow. */
  tags?: Record<string, string>;
}

/**
 * Annotations are best effort: observability must never make a flow fail.
 */
const safeAnnotate = (
  span: unknown,
  options: Record<string, unknown>
): void => {
  try {
    tracer.llmobs.annotate(span as never, options);
  } catch (error) {
    logger.debug(
      `LLM Observability annotation skipped: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
};

/**
 * Runs an AI flow in a root `workflow` span tagged with its `feature` and its
 * `outcome`. The outcome is tagged even when the flow throws; the error is
 * rethrown unchanged.
 */
export const traceAiWorkflow = <T>(
  { feature, name, tags = {} }: AiWorkflowOptions,
  fn: (context: AiWorkflowContext) => Promise<T>
): Promise<T> =>
  tracer.llmobs.trace({ kind: 'workflow', name }, async (span) => {
    let outcome: AiWorkflowOutcome | undefined;
    const extraTags: Record<string, string> = {};
    const extraMetadata: Record<string, unknown> = {};
    const context: AiWorkflowContext = {
      setOutcome: (value) => {
        outcome = value;
      },
      annotate: ({ tags: moreTags, metadata }) => {
        Object.assign(extraTags, moreTags);
        Object.assign(extraMetadata, metadata);
      },
    };
    try {
      const result = await fn(context);
      outcome ??= 'success';
      return result;
    } catch (error) {
      outcome ??= 'error';
      throw error;
    } finally {
      safeAnnotate(span, {
        tags: { ...tags, ...extraTags, feature, outcome: outcome ?? 'error' },
        ...(Object.keys(extraMetadata).length > 0
          ? { metadata: extraMetadata }
          : {}),
      });
    }
  });

/**
 * Runs an LLM call in a manual `llm` span. Used where the automatic
 * instrumentation loses information (images become a `[image]` marker). The
 * provider is a parameter so that changing the model provider does not change
 * the traces. The span is tagged with its `outcome`, even when the call throws;
 * the error is rethrown unchanged.
 */
export const traceLlmCall = <T>(
  { name, modelName, modelProvider, tags = {} }: LlmCallOptions,
  fn: (annotate: (annotation: LlmCallAnnotation) => void) => Promise<T>
): Promise<T> =>
  tracer.llmobs.trace(
    { kind: 'llm', name, modelName, modelProvider },
    async (span) => {
      let outcome: AiWorkflowOutcome | undefined;
      try {
        const result = await fn(
          ({
            outcome: annotatedOutcome,
            inputMessages,
            outputMessages,
            metrics,
            metadata,
          }: LlmCallAnnotation) => {
            if (annotatedOutcome) {
              outcome = annotatedOutcome;
            }
            const options = {
              ...(inputMessages ? { inputData: inputMessages } : {}),
              ...(outputMessages ? { outputData: outputMessages } : {}),
              ...(metrics ? { metrics } : {}),
              ...(metadata ? { metadata } : {}),
            };
            if (Object.keys(options).length > 0) {
              safeAnnotate(span, options);
            }
          }
        );
        outcome ??= 'success';
        return result;
      } catch (error) {
        outcome ??= 'error';
        throw error;
      } finally {
        safeAnnotate(span, { tags: { ...tags, outcome: outcome ?? 'error' } });
      }
    }
  );
