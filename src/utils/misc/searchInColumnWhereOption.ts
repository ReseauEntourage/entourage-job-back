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
