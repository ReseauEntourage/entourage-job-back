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

export interface HelpGroupPage {
  charter: string;
  description: string;
  id: string;
  isMember: boolean;
  // Only false in an admin preview of an unpublished group
  isPublished: boolean;
  membersCount: number;
  name: string;
  slug: string;
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
  charter: string;
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
