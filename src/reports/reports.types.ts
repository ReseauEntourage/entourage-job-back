/**
 * Reported targets: help group messages (generic posts and replies),
 * messaging conversations and user profiles.
 */
export const ReportTargetTypes = {
  POST: 'POST',
  POST_REPLY: 'POST_REPLY',
  CONVERSATION: 'CONVERSATION',
  USER_PROFILE: 'USER_PROFILE',
} as const;

export type ReportTargetType =
  (typeof ReportTargetTypes)[keyof typeof ReportTargetTypes];

// Same motives as the messaging and profile reports of the front
export const ReportReasons = {
  SPAM: 'SPAM',
  FRAUD: 'FRAUD',
  INSULTS: 'INSULTS',
  IN_DANGER: 'IN_DANGER',
  OTHER: 'OTHER',
} as const;

export type ReportReason = (typeof ReportReasons)[keyof typeof ReportReasons];

export const ReportReasonLabels: { [K in ReportReason]: string } = {
  [ReportReasons.SPAM]: 'Spam',
  [ReportReasons.FRAUD]: 'Arnaque',
  [ReportReasons.INSULTS]: 'Propos déplacés',
  [ReportReasons.IN_DANGER]: 'Mise en danger',
  [ReportReasons.OTHER]: 'Autre',
};

export const ReportStatuses = {
  PENDING: 'PENDING',
  RESOLVED: 'RESOLVED',
} as const;

export type ReportStatus = (typeof ReportStatuses)[keyof typeof ReportStatuses];

export const ReportResolutions = {
  RESTORED: 'RESTORED',
  DELETED: 'DELETED',
  // Closed by an admin from the reports tab (conversation, profile)
  MANUAL: 'MANUAL',
  // Closed without touching the message, which stays visible (a group
  // message that never got hidden)
  DISMISSED: 'DISMISSED',
} as const;

export type ReportResolution =
  (typeof ReportResolutions)[keyof typeof ReportResolutions];

// A signalement with a human reporter, or one created automatically (e.g. a
// forbidden expression detected in a help group message)
export const ReportOrigins = {
  MEMBER: 'MEMBER',
  AUTOMATIC: 'AUTOMATIC',
} as const;

export type ReportOrigin = (typeof ReportOrigins)[keyof typeof ReportOrigins];

export interface ReportTarget {
  targetId: string;
  targetType: ReportTargetType;
}

export const REPORT_COMMENT_MAX_LENGTH = 1000;
