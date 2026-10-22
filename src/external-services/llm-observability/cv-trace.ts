/** Total weight of the CV pages, in bytes of base64 text. */
export const totalPagesBytes = (pages: string[]): number =>
  pages.reduce((total, page) => total + page.length, 0);

/**
 * Text that replaces the CV pages in a trace. The pages hold personal data and
 * Datadog judges cannot read attached images, so they are never attached.
 */
export const pagesNotAttachedMarker = (pageCount: number): string | null =>
  pageCount > 0
    ? `[${pageCount} page${pageCount > 1 ? 's' : ''} de CV non jointe${
        pageCount > 1 ? 's' : ''
      } à la trace]`
    : null;
