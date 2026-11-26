import { col, fn, Op, where } from 'sequelize';

export function escapeQuery(query: string) {
  return query
    ? query
        .trim()
        .toLowerCase()
        .replace(/'/g, "''")
        .replace(/-/g, ' ')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
    : '';
}

/**
 * Splits a raw search input into words on whitespace, before any
 * normalization (a hyphenated word such as "Jean-Pierre" stays a single word).
 * Always returns at least one word: an empty input gives [''], which keeps the
 * single-word behavior ("like '%%'").
 */
export function splitSearchTerms(query: string): string[] {
  const terms = (query || '').trim().split(/\s+/).filter(Boolean);
  return terms.length > 0 ? terms : [''];
}

export function escapeColumnRaw(column: string) {
  return `replace(lower(unaccent(${column})), '-', ' ')`;
}

function escapeColumn(column: string) {
  return fn('replace', fn('lower', fn('unaccent', col(column))), '-', ' ');
}

export function searchInColumnWhereOption(
  column: string,
  query: string,
  caseInsensitive = false
) {
  const escapedQuery = escapeQuery(query);
  const operator = caseInsensitive ? Op.iLike : Op.like;
  return where(escapeColumn(column), {
    [operator]: `%${escapedQuery}%`,
  });
}

export function searchInColumnWhereOptionRaw(column: string, query: string) {
  const escapedQuery = escapeQuery(query);
  return `${escapeColumnRaw(column)} like '%${escapedQuery}%'`;
}
