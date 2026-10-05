export const PusherChannels = {
  CV_PDF: 'cv-pdf-channel',
  PROFILE_GENERATION: 'profile-generation-channel',
  EMBEDDING: 'embedding-channel',
} as const;

export type PusherChannel =
  (typeof PusherChannels)[keyof typeof PusherChannels];

/**
 * Private channel of a post (a help group discussion). Subscribing requires
 * an authorization from `POST /pusher/auth`, so the activity of a discussion
 * is only visible to the logged-in users who can read it.
 */
export const POST_PRIVATE_CHANNEL_PREFIX = 'private-post-';

export const getPostPrivateChannel = (postId: string) =>
  `${POST_PRIVATE_CHANNEL_PREFIX}${postId}`;

export const PusherEvents = {
  CV_PDF_DONE: 'cv-pdf-done',
  PROFILE_GENERATION_COMPLETE: 'profile-generation-complete',
  EMBEDDING_READY: 'embedding-ready',
  // Help groups: the payload only carries ids, never any content
  REPLY_CREATED: 'reply-created',
  REPLY_UPDATED: 'reply-updated',
  REPLY_DELETED: 'reply-deleted',
  REACTIONS_UPDATED: 'reactions-updated',
  DISCUSSION_UPDATED: 'discussion-updated',
  DISCUSSION_DELETED: 'discussion-deleted',
} as const;

export type PusherEvent = (typeof PusherEvents)[keyof typeof PusherEvents];

export interface PostRealtimePayload {
  discussionId: string;
  replyId?: string;
  // Reacted message: the discussion id or a reply id
  targetId?: string;
}
