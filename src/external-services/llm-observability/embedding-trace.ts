/**
 * The embedding input text (built from personal profile fields such as
 * description, skills or experiences) only goes to Datadog when the setting
 * is enabled, which is off by default. Otherwise a marker with its size takes
 * its place.
 */
export const embeddingTextForTrace = (text: string): string =>
  process.env.LLM_OBS_EMBEDDING_TEXT_ENABLED === 'true'
    ? text
    : `[${text.length} caractères de profil non joints à la trace]`;
