const CV_DATE_REGEX = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/;

/**
 * Convertit une date extraite d'un CV en Date (UTC), sans jamais inventer de valeur.
 * Formats acceptés : YYYY (→ 1er janvier), YYYY-MM (→ 1er du mois), YYYY-MM-DD.
 * Toute autre valeur (absente, vide, non interprétable, date impossible) → null.
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
 * Convertit les dates de début et de fin d'une expérience ou d'une formation
 * extraite d'un CV. Si le début est postérieur à la fin, seule la fin est conservée.
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
