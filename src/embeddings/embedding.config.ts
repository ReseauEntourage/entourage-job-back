import { UserProfile } from 'src/user-profiles/models';

export type EmbeddingType = 'profile' | 'need';

export const EMBEDDING_DIMENSIONS = 1024;
export type EmbeddingConfig = {
  version: string;
  fields: (keyof UserProfile)[];
};

/**
 * Defines the configuration for different embedding types, including the version and
 * the specific fields from the user profile that should be included in the embedding.
 * This allows for flexibility in how embeddings are generated and updated based on
 * changes to the user profile structure or the addition of new fields.
 */
export const EMBEDDING_CONFIG: Record<EmbeddingType, EmbeddingConfig> = {
  profile: {
    version: 'v1.0',
    fields: [
      'currentJob',
      'description',
      'introduction',
      'experiences',
      'formations',
      'languages',
    ],
  },
  need: {
    version: 'v1.0',
    fields: ['nudges', 'customNudges'],
  },
};

export const EMBEDDING_MODEL = 'voyage-4-lite';
