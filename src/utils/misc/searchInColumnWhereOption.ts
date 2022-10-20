import { col, fn, Op, where } from 'sequelize';

export function escapeQuery(query: string) {
  return query
    ? query
        .trim()
        .toLowerCase()
        .replace("'", "''")
        .replace('-', ' ')
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

export function searchInColumnWhereOption(column: string, query: string) {
  const escapedQuery = escapeQuery(query);
  return where(escapeColumn(column), {
    [Op.like]: `%${escapedQuery}%`,
  });
}
