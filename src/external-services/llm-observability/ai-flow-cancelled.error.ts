/**
 * An AI flow was stopped on purpose, typically because the user cancelled it.
 * It is not a failure: the tracing helpers tag it as `cancelled` and close the
 * spans without an error status, then rethrow it so the flow still stops.
 */
export class AiFlowCancelledError extends Error {
  /** The error of the interrupted call, if any. */
  readonly cause?: unknown;

  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = 'AiFlowCancelledError';
    this.cause = options?.cause;
  }
}
