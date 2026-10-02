import { PostReactionEmoji } from './models';

export interface PostAuthor {
  // Only filled for the author card of a discussion, when the profile is linkable
  department?: string | null;
  firstName: string | null;
  id: string | null;
  isDeleted: boolean;
  // e.g. "P." — the full last name is never exposed
  lastNameInitial: string | null;
  profileLinkable: boolean;
  roleLabel: string | null;
}

/**
 * Reactions summary: deliberately carries no count, so the "never show a
 * number of reactions" rule does not depend on the front.
 */
export interface ReactionsSummary {
  emojis: PostReactionEmoji[];
  firstNames: string[];
  hasOthers: boolean;
}

export type ReactionTarget = 'postId' | 'replyId';
