/**
 * Closed list of the AI usages whose model is chosen by configuration: a model
 * can be compared with another one (on staging, for instance) without a
 * deployment. The embeddings model is not part of it: changing it without
 * computing every vector again would mix two embedding spaces in the database.
 */
export enum AiModelUse {
  AI_ASSISTANT = 'ai_assistant',
  AI_ASSISTANT_CLASSIFIER = 'ai_assistant_classifier',
  CV_BUILDING = 'cv_building',
  CV_EXTRACTION = 'cv_extraction',
  CV_READING = 'cv_reading',
  HELP_GROUPS_TITLE = 'help_groups_title',
  PRESENTATION_GENERATION = 'presentation_generation',
}

/** The model of each usage when its variable is not set. */
const DEFAULT_AI_MODELS: Record<AiModelUse, string> = {
  [AiModelUse.CV_EXTRACTION]: 'o4-mini-2025-04-16',
  [AiModelUse.CV_READING]: 'o4-mini-2025-04-16',
  [AiModelUse.CV_BUILDING]: 'o4-mini-2025-04-16',
  [AiModelUse.AI_ASSISTANT]: 'claude-sonnet-4-6',
  [AiModelUse.AI_ASSISTANT_CLASSIFIER]: 'claude-haiku-4-5-20251001',
  [AiModelUse.PRESENTATION_GENERATION]: 'claude-haiku-4-5-20251001',
  [AiModelUse.HELP_GROUPS_TITLE]: 'claude-haiku-4-5-20251001',
};

/** Name of the variable that sets the model of a usage, e.g. `AI_MODEL_CV_READING`. */
export const aiModelEnvName = (use: AiModelUse): string =>
  `AI_MODEL_${use.toUpperCase()}`;

/**
 * The model of a usage. Read at every call (never cached), and a blank value
 * counts as unset. The value must name a model of the provider that serves the
 * usage: a model of another provider fails with the provider's own error,
 * rather than silently falling back on the default and measuring another model
 * than the announced one.
 */
export const getAiModel = (use: AiModelUse): string =>
  process.env[aiModelEnvName(use)]?.trim() || DEFAULT_AI_MODELS[use];

/** Name of the variable that sets the reasoning effort of a usage, e.g. `AI_REASONING_EFFORT_CV_READING`. */
export const aiReasoningEffortEnvName = (use: AiModelUse): string =>
  `AI_REASONING_EFFORT_${use.toUpperCase()}`;

/**
 * The reasoning effort of a usage (OpenAI reasoning models: `none`, `minimal`,
 * `low`, `medium`, `high`...), or undefined when the variable is empty or
 * absent: the parameter is then not sent and the model keeps its own default.
 * Read at every call. The value is not validated: a model that does not support
 * it fails with the provider's own error, rather than being silently ignored.
 */
export const getReasoningEffort = (use: AiModelUse): string | undefined =>
  process.env[aiReasoningEffortEnvName(use)]?.trim() || undefined;
