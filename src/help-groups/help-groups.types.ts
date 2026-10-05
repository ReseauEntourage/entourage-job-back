import { PostReactionEmoji } from 'src/posts/models';
import { PostReplyItem } from 'src/posts/posts.service';
import {
  HiddenMessage,
  PostAuthor,
  ReactionsSummary,
} from 'src/posts/posts.types';
import { ReportReason } from 'src/reports/reports.types';

export interface HelpGroupContributor {
  // The front builds the picture URL from the user id, as in the directory
  hasPicture: boolean;
  id: string;
  initials: string;
}

export interface HelpGroupCard {
  description: string;
  id: string;
  isMember: boolean;
  membersCount: number;
  name: string;
  pinnedAt: Date | null;
  recentContributors: HelpGroupContributor[];
  slug: string;
}

export const HelpGroupErrorCodes = {
  NOT_MEMBER: 'HELP_GROUP_NOT_MEMBER',
  ELEARNING_NOT_COMPLETED: 'ELEARNING_NOT_COMPLETED',
  CHARTER_NOT_ACCEPTED: 'HELP_GROUP_CHARTER_NOT_ACCEPTED',
  DISCUSSION_NOT_FOUND: 'HELP_GROUP_DISCUSSION_NOT_FOUND',
} as const;

/**
 * Number of distinct reporters, with a report still to handle, from which a
 * help group message is hidden automatically. Read from the
 * `HELP_GROUPS_AUTO_HIDE_THRESHOLD` env var so that it can change without a
 * new development; 1 by default (PM decision of 01/10/2026, every report
 * hides the message). 0 disables the automatic hiding.
 */
export const HELP_GROUPS_AUTO_HIDE_THRESHOLD = 1;

/**
 * A non negative integer, otherwise the default: a malformed value never
 * disables the hiding by mistake.
 */
export const parseAutoHideThreshold = (rawValue: string | undefined): number =>
  rawValue !== undefined && /^\d+$/.test(rawValue.trim())
    ? parseInt(rawValue.trim(), 10)
    : HELP_GROUPS_AUTO_HIDE_THRESHOLD;

/**
 * What the viewer can do in a group, from which the front picks the
 * invitation shown instead of the write actions. Write actions are never
 * shown on an unpublished group (admin preview), whatever the state.
 */
export const HelpGroupViewerStates = {
  CAN_WRITE: 'canWrite',
  MUST_JOIN: 'mustJoin',
  MUST_COMPLETE_ELEARNING: 'mustCompleteElearning',
} as const;

export type HelpGroupViewerState =
  (typeof HelpGroupViewerStates)[keyof typeof HelpGroupViewerStates];

export interface HelpGroupViewerPermissions {
  // The charter is common to every group and accepted once per person
  charterAccepted: boolean;
  // Member for less than 7 days who has not published in the group yet
  showWelcomeInvite: boolean;
  state: HelpGroupViewerState;
}

export interface HelpGroupPage {
  description: string;
  // "Emails de ce groupe" of the viewer; null when not a member
  emailsEnabled: boolean | null;
  id: string;
  isMember: boolean;
  // Only false in an admin preview of an unpublished group
  isPublished: boolean;
  membersCount: number;
  name: string;
  slug: string;
  viewerPermissions: HelpGroupViewerPermissions;
}

export interface HelpGroupDiscussionItem {
  author: PostAuthor;
  createdAt: Date;
  id: string;
  // Hidden after reports: only listed for its author and the admins
  isUnderReview: boolean;
  lastActivityAt: Date;
  reactionsSummary: ReactionsSummary | null;
  repliesCount: number;
  title: string | null;
}

export interface HelpGroupDiscussionGroup {
  id: string;
  isPublished: boolean;
  name: string;
  slug: string;
}

export interface HelpGroupDiscussion extends HelpGroupDiscussionItem {
  content: string;
  editedAt: Date | null;
  group: HelpGroupDiscussionGroup;
  // Admins only, on a message under review: motives of the pending reports
  reportReasons?: ReportReason[];
  // Active reaction of the reader on the discussion message
  viewerReaction: PostReactionEmoji | null;
}

/**
 * A discussion hidden after reports, for a reader who is neither its author
 * nor an admin: its title and message are replaced by a neutral mention,
 * its replies stay readable.
 */
export interface HelpGroupHiddenDiscussion extends HiddenMessage {
  group: HelpGroupDiscussionGroup;
  repliesCount: number;
}

export type HelpGroupDiscussionView =
  HelpGroupDiscussion | HelpGroupHiddenDiscussion;

export type HelpGroupReplyView =
  (PostReplyItem & { reportReasons?: ReportReason[] }) | HiddenMessage;

export interface HelpGroupAdminItem {
  createdAt: Date;
  deletedAt: Date | null;
  description: string;
  discussionsCount: number;
  id: string;
  // null when the group has no visible discussion ("jamais")
  lastActivityAt: Date | null;
  membersCount: number;
  name: string;
  pinnedAt: Date | null;
  publishedAt: Date | null;
  slug: string;
}

/**
 * The three immediate emails of the help groups, which differ by their
 * subject and their reason of reception.
 */
export const HelpGroupNotificationEmailKinds = {
  REPLY_TO_AUTHOR: 'REPLY_TO_AUTHOR',
  REPLY_TO_PARTICIPANT: 'REPLY_TO_PARTICIPANT',
  REACTION: 'REACTION',
} as const;

export type HelpGroupNotificationEmailKind =
  (typeof HelpGroupNotificationEmailKinds)[keyof typeof HelpGroupNotificationEmailKinds];

export interface HelpGroupNotificationEmail {
  actorFirstName: string;
  discussionTitle: string | null;
  // Links opening the content and the emails setting without logging in
  discussionUrl: string;
  // Beginning of the reply, for a reply
  excerpt: string | null;
  groupName: string;
  kind: HelpGroupNotificationEmailKind;
  settingsUrl: string;
}

// Discussions shown at most in a weekly digest
export const HELP_GROUPS_DIGEST_MAX_DISCUSSIONS = 10;

export interface HelpGroupsWeeklyDigestEmail {
  groups: {
    discussions: {
      // First name of the author, or "Utilisateur supprimé"
      authorFirstName: string;
      title: string | null;
      url: string;
    }[];
    name: string;
    settingsUrl: string;
  }[];
  // Link to the groups list, only when more discussions were active
  groupsUrl: string | null;
}
