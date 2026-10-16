/**
 * Notification types, brought by each producing domain. A notification is a
 * single row per (recipient, type, subject), grouping every event of that
 * subject.
 */
export const NotificationTypes = {
  // Subject: the discussion (POST); events: its replies
  HELP_GROUP_REPLY: 'HELP_GROUP_REPLY',
  // Subject: the reacted message (POST or POST_REPLY); events: its reactions
  HELP_GROUP_REACTION: 'HELP_GROUP_REACTION',
} as const;

export type NotificationType =
  (typeof NotificationTypes)[keyof typeof NotificationTypes];

// Generic posts and replies of the lot 1 (a help group message is one of them)
export const NotificationSubjectTypes = {
  POST: 'POST',
  POST_REPLY: 'POST_REPLY',
} as const;

export type NotificationSubjectType =
  (typeof NotificationSubjectTypes)[keyof typeof NotificationSubjectTypes];

/**
 * What displaying a content makes "seen":
 * - EVENT: the event itself is a content (a reply), seen once it is displayed;
 * - SUBJECT: the events are about the subject (reactions to a message), all
 *   seen once the subject is displayed.
 */
export const NotificationSeenCoverages = {
  EVENT: 'EVENT',
  SUBJECT: 'SUBJECT',
} as const;

export type NotificationSeenCoverage =
  (typeof NotificationSeenCoverages)[keyof typeof NotificationSeenCoverages];

export const NotificationSeenCoverageByType: {
  [K in NotificationType]: NotificationSeenCoverage;
} = {
  [NotificationTypes.HELP_GROUP_REPLY]: NotificationSeenCoverages.EVENT,
  [NotificationTypes.HELP_GROUP_REACTION]: NotificationSeenCoverages.SUBJECT,
};

/**
 * An event that contributed to a notification. Dates are ISO strings, as
 * stored in the jsonb column.
 */
export interface NotificationEvent {
  actorId: string;
  at: string;
  // Set once the immediate email of this event is sent
  emailedAt?: string | null;
  // The reply or the reaction
  eventId: string;
  // Set once the content of this event is displayed to the recipient
  seenAt?: string | null;
}

// Notifications older than this are purged and never listed
export const NOTIFICATIONS_RETENTION_DAYS = 30;

export const NOTIFICATIONS_PAGE_SIZE = 20;

// Up to 3 first names, then "et d'autres": never a number
export const NOTIFICATION_MAX_ACTOR_NAMES = 3;

export interface NotificationDestination {
  discussionId: string;
  // The first unseen reply, or the reacted reply; null for the discussion
  replyId: string | null;
  slug: string;
}

/**
 * A notification as listed in the bell. The label is composed at read time,
 * never stored: it depends on the state of the accounts.
 */
export interface NotificationItem {
  context: {
    discussionTitle: string | null;
    groupName: string;
  };
  destination: NotificationDestination;
  // Beginning of the latest reply, for a reply notification
  excerpt: string | null;
  id: string;
  label: string;
  lastEventAt: Date;
  seen: boolean;
  type: NotificationType;
}

/**
 * Brought by a producing domain to compose the items of its own types: it
 * returns no item for a notification whose content can no longer be shown
 * (deleted message, group no longer visible, every actor deleted).
 */
export interface NotificationPresenter {
  present(
    notifications: NotificationRow[],
    recipientId: string
  ): Promise<Map<string, NotificationItem>>;
}

export interface NotificationRow {
  events: NotificationEvent[];
  groupId: string | null;
  id: string;
  lastEventAt: Date;
  seenAt: Date | null;
  subjectId: string;
  subjectType: NotificationSubjectType;
  type: NotificationType;
  userId: string;
}
