import { PostAuthor, ReactionsSummary } from 'src/posts/posts.types';

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
  lastActivityAt: Date;
  reactionsSummary: ReactionsSummary | null;
  repliesCount: number;
  title: string | null;
}

export interface HelpGroupDiscussion extends HelpGroupDiscussionItem {
  content: string;
  editedAt: Date | null;
  group: { id: string; slug: string; name: string; isPublished: boolean };
}

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
