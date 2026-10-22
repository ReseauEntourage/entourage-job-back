export const DEFAULT_CV_TRACE_IMAGES_MAX_BYTES = 3_000_000;

export interface CvTraceImagesConfig {
  enabled: boolean;
  maxBytes: number;
}

export interface CvTraceImages {
  /** Pages (base64) to attach to the trace, in order. */
  attached: string[];
  /** Text appended to the prompt of the trace when pages are left out. */
  marker: string | null;
  /** Number of pages left out of the trace. */
  omitted: number;
}

/**
 * Reads the settings from the environment on every call, so that a change is
 * taken into account without a restart of the tests. Sending the pages is off
 * unless explicitly enabled: they hold personal data.
 */
export const getCvTraceImagesConfig = (): CvTraceImagesConfig => {
  const maxBytes = Number(process.env.LLM_OBS_CV_IMAGES_MAX_BYTES);
  return {
    enabled: process.env.LLM_OBS_CV_IMAGES_ENABLED === 'true',
    maxBytes:
      Number.isFinite(maxBytes) && maxBytes > 0
        ? maxBytes
        : DEFAULT_CV_TRACE_IMAGES_MAX_BYTES,
  };
};

const pagesLabel = (count: number): string =>
  `${count} page${count > 1 ? 's' : ''} non jointe${count > 1 ? 's' : ''}`;

/**
 * Picks the leading pages of the CV that fit in the size budget of the trace
 * (Datadog drops the whole input and output of a span event above 5 MB). It
 * stops at the first page that does not fit, so the attached pages are always
 * the first ones. The model always receives every page: only the trace is cut.
 */
export const selectCvTraceImages = (
  pages: string[],
  { enabled, maxBytes }: CvTraceImagesConfig
): CvTraceImages => {
  if (!enabled) {
    return {
      attached: [],
      omitted: pages.length,
      marker:
        pages.length > 0
          ? `[${pagesLabel(pages.length)} : envoi des images désactivé]`
          : null,
    };
  }

  const attached: string[] = [];
  let totalBytes = 0;
  for (const page of pages) {
    if (totalBytes + page.length > maxBytes) {
      break;
    }
    attached.push(page);
    totalBytes += page.length;
  }

  const omitted = pages.length - attached.length;
  return {
    attached,
    omitted,
    marker: omitted > 0 ? `[${pagesLabel(omitted)} : plafond de taille]` : null,
  };
};

/** Total weight of the pages, in bytes of base64 text. */
export const totalImagesBytes = (pages: string[]): number =>
  pages.reduce((total, page) => total + page.length, 0);
