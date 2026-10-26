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
  // The reading looks at the pages: the more capable vision model. Building
  // and filling the schema from text need less.
  [AiModelUse.CV_EXTRACTION]: 'claude-sonnet-5-5',
  [AiModelUse.CV_READING]: 'claude-sonnet-5-5',
  [AiModelUse.CV_BUILDING]: 'claude-haiku-5-5',
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
 * counts as unset. The value must name a model of Anthropic: another name fails
 * with the provider's own error, rather than silently falling back on the
 * default and measuring another model than the announced one.
 */
export const getAiModel = (use: AiModelUse): string =>
  process.env[aiModelEnvName(use)]?.trim() || DEFAULT_AI_MODELS[use];

/** Effort levels of the Anthropic models (`output_config.effort`). */
export type AiEffort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

/**
 * The effort of the usages that set one. Without it the model uses its own
 * default (`high` on Claude Sonnet 5.5), which makes a transcription or a
 * schema filling think far longer than it needs to.
 */
const DEFAULT_AI_EFFORTS: Partial<Record<AiModelUse, AiEffort>> = {
  [AiModelUse.CV_EXTRACTION]: 'medium',
  [AiModelUse.CV_READING]: 'low',
  [AiModelUse.CV_BUILDING]: 'low',
};

/** Name of the variable that sets the effort of a usage, e.g. `AI_EFFORT_CV_READING`. */
export const aiEffortEnvName = (use: AiModelUse): string =>
  `AI_EFFORT_${use.toUpperCase()}`;

/**
 * The effort of a usage: the value of its variable, or the default of the usage
 * when it is absent or blank (undefined for a usage that sets none, whose model
 * then keeps its own default). Read at every call. The value is not validated:
 * one the provider refuses fails the call with the provider's own error, rather
 * than being silently ignored.
 */
export const getAiEffort = (use: AiModelUse): AiEffort | undefined =>
  (process.env[aiEffortEnvName(use)]?.trim() as AiEffort | undefined) ||
  DEFAULT_AI_EFFORTS[use];
