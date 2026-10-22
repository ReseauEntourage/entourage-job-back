/**
 * The reading pass of the CV extraction did not produce a usable text. The
 * outcome is the one tagged on the span of the reading step.
 */
export class CvReadingError extends Error {
  constructor(
    readonly outcome: 'empty' | 'truncated',
    message: string
  ) {
    super(message);
    this.name = 'CvReadingError';
  }
}
