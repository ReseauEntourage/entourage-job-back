const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Parses a comma separated list of forbidden expressions (same format as the
 * front `NEXT_PUBLIC_MESSAGING_FORBIDDEN_EXPRESSIONS`), ignoring blank items.
 */
export const parseForbiddenExpressions = (rawList?: string | null): string[] =>
  (rawList ?? '')
    .split(',')
    .map((expression) => expression.trim())
    .filter(Boolean);

/**
 * Returns the first forbidden expression found in `text`, case insensitive
 * and on word boundaries, or null. Unlike the front `isSuspiciousMessage`,
 * the expressions are escaped and the boundaries are Unicode aware, so that
 * an accented letter counts as a word character.
 */
export const findForbiddenExpression = (
  text: string,
  expressions: string[]
): string | null => {
  if (!text || expressions.length === 0) {
    return null;
  }
  const pattern = new RegExp(
    `(?<![\\p{L}\\p{N}_])(${expressions
      .map(escapeRegExp)
      .join('|')})(?![\\p{L}\\p{N}_])`,
    'iu'
  );
  const match = text.match(pattern);
  if (!match) {
    return null;
  }
  const found = match[1].toLocaleLowerCase();
  return (
    expressions.find(
      (expression) => expression.toLocaleLowerCase() === found
    ) ?? match[1]
  );
};
