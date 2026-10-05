/**
 * Reported targets. Help group messages are generic posts and replies;
 * conversations and profiles are reserved for the transverse "Signalements"
 * change, which will plug the messaging and profile reports in this table.
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
} as const;

export type ReportResolution =
  (typeof ReportResolutions)[keyof typeof ReportResolutions];

export interface ReportTarget {
  targetId: string;
  targetType: ReportTargetType;
}

export const REPORT_COMMENT_MAX_LENGTH = 1000;
