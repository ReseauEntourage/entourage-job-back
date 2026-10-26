/**
 * Closed list of the AI flows of the platform. The same value is the `feature`
 * tag of the LLM metrics and of the root span of the flow's LLM Observability
 * trace, so that traces and metrics are filtered with one vocabulary.
 */
export enum AiFeature {
  AI_ASSISTANT = 'ai_assistant',
  CV_EXTRACTION = 'cv_extraction',
  HELP_GROUPS_TITLE = 'help_groups_title',
  PRESENTATION_GENERATION = 'presentation_generation',
}
