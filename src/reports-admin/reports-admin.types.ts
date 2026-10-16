import { ReportTargetType, ReportTargetTypes } from 'src/reports/reports.types';

/**
 * Type filter of the reports tab: help group discussions and replies are
 * shown together as "group messages".
 */
export const ReportTargetFilters = {
  CONVERSATION: 'CONVERSATION',
  USER_PROFILE: 'USER_PROFILE',
  GROUP_MESSAGE: 'GROUP_MESSAGE',
} as const;

export type ReportTargetFilter =
  (typeof ReportTargetFilters)[keyof typeof ReportTargetFilters];

export const ReportTargetTypesByFilter: {
  [K in ReportTargetFilter]: ReportTargetType[];
} = {
  [ReportTargetFilters.CONVERSATION]: [ReportTargetTypes.CONVERSATION],
  [ReportTargetFilters.USER_PROFILE]: [ReportTargetTypes.USER_PROFILE],
  [ReportTargetFilters.GROUP_MESSAGE]: [
    ReportTargetTypes.POST,
    ReportTargetTypes.POST_REPLY,
  ],
};

/**
 * Help group messages are handled in the group (restore or delete), never
 * closed by hand from the tab.
 */
export const isGroupMessageTarget = (targetType: ReportTargetType) =>
  targetType === ReportTargetTypes.POST ||
  targetType === ReportTargetTypes.POST_REPLY;

// Derived from the reports of a target: PENDING while one is still to handle
export const ReportTargetStatuses = {
  PENDING: 'PENDING',
  RESOLVED: 'RESOLVED',
} as const;

export type ReportTargetStatus =
  (typeof ReportTargetStatuses)[keyof typeof ReportTargetStatuses];

export const GroupMessageStates = {
  VISIBLE: 'VISIBLE',
  HIDDEN: 'HIDDEN',
  DELETED: 'DELETED',
} as const;

export type GroupMessageState =
  (typeof GroupMessageStates)[keyof typeof GroupMessageStates];

export const REPORT_TARGETS_PAGE_SIZE = 20;
export const REPORT_RESOLUTION_NOTE_MAX_LENGTH = 1000;
