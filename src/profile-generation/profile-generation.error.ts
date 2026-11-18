import { AiFlowCancelledError } from 'src/external-services/llm-observability/ai-flow-cancelled.error';

/**
 * The user cancelled a profile generation after the extraction had answered,
 * before the profile was written.
 */
export class ProfileGenerationCancelledError extends AiFlowCancelledError {
  constructor(message = "Génération du profil annulée par l'utilisateur") {
    super(message);
    this.name = 'ProfileGenerationCancelledError';
  }
}
