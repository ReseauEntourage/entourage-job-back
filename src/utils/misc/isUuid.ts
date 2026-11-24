const UUID_REGEX =
  /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/i;

/**
 * Checks whether a value is a well-formed RFC 9562 UUID (versions 1 to 8,
 * plus the nil and max UUIDs). Replaces `validate` from the `uuid` package,
 * which is ESM-only since v12 and cannot be required from this CommonJS project.
 */
export const isUuid = (value: unknown): boolean =>
  typeof value === 'string' && UUID_REGEX.test(value);
