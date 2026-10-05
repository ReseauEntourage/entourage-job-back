import { PostReactionEmoji } from './models';

export interface PostAuthor {
  // Only filled for the author card of a discussion, when the profile is linkable
  department?: string | null;
  firstName: string | null;
  id: string | null;
  // Entourage admin: their links open without the external link warning
  isAdmin: boolean;
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

/**
 * A message hidden after reports, as serialized for a reader who is neither
 * its author nor an admin: no content, title, author nor reactions.
 */
export interface HiddenMessage {
  id: string;
  isUnderReview: true;
}

// Motives of a deletion by an Entourage admin, visible to the team only
export const PostDeletionReasons = {
  PERSONAL_DATA: 'PERSONAL_DATA',
  DISRESPECT: 'DISRESPECT',
  SPAM: 'SPAM',
  OFF_TOPIC: 'OFF_TOPIC',
  OTHER: 'OTHER',
} as const;

export type PostDeletionReason =
  (typeof PostDeletionReasons)[keyof typeof PostDeletionReasons];

/**
 * Origin of a post title, computed by the front at publication time and only
 * used to measure the usefulness of the AI title suggestion.
 */
export const PostTitleSources = {
  AI_ACCEPTED: 'AI_ACCEPTED',
  AI_EDITED: 'AI_EDITED',
  MANUAL: 'MANUAL',
} as const;

export type PostTitleSource =
  (typeof PostTitleSources)[keyof typeof PostTitleSources];
