const CV_DATE_REGEX = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/;

/**
 * Converts a date extracted from a CV into a UTC Date, never inventing a value.
 * Accepted formats: YYYY (→ January 1st), YYYY-MM (→ 1st of the month), YYYY-MM-DD.
 * Any other value (missing, empty, unparsable, impossible date) → null.
 */
export function parseCvDate(value: unknown): Date | null {
  if (typeof value !== 'string') {
    return null;
  }

  const match = CV_DATE_REGEX.exec(value.trim());
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = match[2] ? Number(match[2]) : 1;
  const day = match[3] ? Number(match[3]) : 1;

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

/**
 * Converts the start and end dates of an experience or formation extracted
 * from a CV. When the start date is after the end date, only the end date is kept.
 */
export function normalizeCvDateRange({
  startDate,
  endDate,
}: {
  startDate?: unknown;
  endDate?: unknown;
}): { startDate: Date | null; endDate: Date | null } {
  const start = parseCvDate(startDate);
  const end = parseCvDate(endDate);

  if (start && end && start.getTime() > end.getTime()) {
    return { startDate: null, endDate: end };
  }

  return { startDate: start, endDate: end };
}
