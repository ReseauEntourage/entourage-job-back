import { AiFlowCancelledError } from 'src/external-services/llm-observability/ai-flow-cancelled.error';

/**
 * A call of the CV extraction did not produce a usable answer. The outcome is
 * the one tagged on the span of the call.
 */
export class CvExtractionError extends Error {
  constructor(
    readonly outcome: 'empty' | 'truncated' | 'refused',
    message: string
  ) {
    super(message);
    this.name = 'CvExtractionError';
  }
}

/**
 * The CV extraction was interrupted because its job was cancelled. The original
 * error of the interrupted call, if any, is kept as the cause.
 */
export class CvExtractionCancelledError extends AiFlowCancelledError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'CvExtractionCancelledError';
  }
}
