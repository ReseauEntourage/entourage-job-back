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
