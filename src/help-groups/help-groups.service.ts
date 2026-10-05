import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, QueryTypes } from 'sequelize';
import { Post, PostContext } from 'src/posts/models';
import { PostsService, Page } from 'src/posts/posts.service';
import { decodePostCursor, encodePostCursor } from 'src/posts/posts.utils';
import { UserRole } from 'src/users/users.types';
import { isEntourageAdmin } from 'src/users/users.utils';
import {
  HelpGroupCard,
  HelpGroupContributor,
  HelpGroupDiscussion,
  HelpGroupDiscussionItem,
  HelpGroupPage,
} from './help-groups.types';
import { getInitials } from './help-groups.utils';
import { HelpGroup, HelpGroupMembership } from './models';

const MAX_RECENT_CONTRIBUTORS = 3;

export interface HelpGroupReader {
  id: string;
  role: UserRole;
}

@Injectable()
export class HelpGroupsService {
  constructor(
    @InjectModel(HelpGroup)
    private helpGroupModel: typeof HelpGroup,
    @InjectModel(HelpGroupMembership)
    private helpGroupMembershipModel: typeof HelpGroupMembership,
    @InjectModel(Post)
    private postModel: typeof Post,
    private postsService: PostsService
  ) {}

  /**
   * Single visibility rule for every read of a group page and its
   * discussions: a non admin only sees published groups, an admin also sees
   * unpublished ones (preview). Deleted groups are excluded for everyone by
   * the paranoid model. An inaccessible group is a 404, never a 403, so that
   * the existence of an unpublished group is not revealed.
   */
  async findVisibleGroupBySlug(
    slug: string,
    reader: HelpGroupReader
  ): Promise<HelpGroup> {
    const group = await this.helpGroupModel.findOne({
      where: {
        slug,
        ...(isEntourageAdmin(reader.role)
          ? {}
          : { publishedAt: { [Op.ne]: null } }),
      },
    });
    if (!group) {
      throw new NotFoundException();
    }
    return group;
  }

  /**
   * Active memberships count per group, excluding deleted accounts.
   */
  async countMembersByGroupIds(
    groupIds: string[]
  ): Promise<Record<string, number>> {
    if (groupIds.length === 0) {
      return {};
    }
    const rows = await this.helpGroupModel.sequelize.query<{
      groupId: string;
      count: string;
    }>(
      `SELECT m."groupId", COUNT(*) AS "count"
       FROM "HelpGroupMemberships" m
       JOIN "Users" u ON u."id" = m."userId" AND u."deletedAt" IS NULL
       WHERE m."leftAt" IS NULL AND m."groupId" IN (:groupIds)
       GROUP BY m."groupId"`,
      { replacements: { groupIds }, type: QueryTypes.SELECT }
    );
    return rows.reduce<Record<string, number>>((acc, row) => {
      acc[row.groupId] = parseInt(row.count, 10);
      return acc;
    }, {});
  }

  async findMemberGroupIds(
    userId: string,
    groupIds: string[]
  ): Promise<Set<string>> {
    if (groupIds.length === 0) {
      return new Set();
    }
    const memberships = await this.helpGroupMembershipModel.findAll({
      attributes: ['groupId'],
      where: { userId, groupId: groupIds, leftAt: null },
    });
    return new Set(memberships.map(({ groupId }) => groupId));
  }

  /**
   * Visible discussions count and most recent activity per group.
   */
  async getDiscussionsStatsByGroupIds(
    groupIds: string[]
  ): Promise<Record<string, { count: number; lastActivityAt: Date | null }>> {
    if (groupIds.length === 0) {
      return {};
    }
    const rows = await this.helpGroupModel.sequelize.query<{
      groupId: string;
      count: string;
      lastActivityAt: Date | null;
    }>(
      `SELECT pc."helpGroupId" AS "groupId", COUNT(p."id") AS "count",
              MAX(p."lastActivityAt") AS "lastActivityAt"
       FROM "PostContexts" pc
       JOIN "Posts" p ON p."id" = pc."postId" AND p."deletedAt" IS NULL
       WHERE pc."helpGroupId" IN (:groupIds)
       GROUP BY pc."helpGroupId"`,
      { replacements: { groupIds }, type: QueryTypes.SELECT }
    );
    return rows.reduce<
      Record<string, { count: number; lastActivityAt: Date | null }>
    >((acc, row) => {
      acc[row.groupId] = {
        count: parseInt(row.count, 10),
        lastActivityAt: row.lastActivityAt
          ? new Date(row.lastActivityAt)
          : null,
      };
      return acc;
    }, {});
  }

  /**
   * Up to 3 distinct authors of the most recent visible discussions and
   * replies of each group, deleted accounts excluded, for all the groups in
   * a single query (the groups list is small and not paginated):
   * 1. `activity`: every visible discussion and reply with its group,
   * 2. `latest`: the most recent activity of each (group, author), only for
   *    non deleted authors,
   * 3. `ranked`: authors ranked per group by their most recent activity.
   */
  async findRecentContributorsByGroupIds(
    groupIds: string[]
  ): Promise<Record<string, HelpGroupContributor[]>> {
    if (groupIds.length === 0) {
      return {};
    }
    const rows = await this.helpGroupModel.sequelize.query<{
      groupId: string;
      userId: string;
      firstName: string;
      lastName: string;
      hasPicture: boolean;
    }>(
      `WITH "activity" AS (
         SELECT pc."helpGroupId" AS "groupId", p."authorId" AS "userId", p."createdAt" AS "at"
         FROM "PostContexts" pc
         JOIN "Posts" p ON p."id" = pc."postId" AND p."deletedAt" IS NULL
         WHERE pc."helpGroupId" IN (:groupIds)
         UNION ALL
         SELECT pc."helpGroupId" AS "groupId", r."authorId" AS "userId", r."createdAt" AS "at"
         FROM "PostContexts" pc
         JOIN "Posts" p ON p."id" = pc."postId" AND p."deletedAt" IS NULL
         JOIN "PostReplies" r ON r."postId" = p."id" AND r."deletedAt" IS NULL
         WHERE pc."helpGroupId" IN (:groupIds)
       ),
       "latest" AS (
         SELECT a."groupId", a."userId", MAX(a."at") AS "lastAt"
         FROM "activity" a
         JOIN "Users" u ON u."id" = a."userId" AND u."deletedAt" IS NULL
         GROUP BY a."groupId", a."userId"
       ),
       "ranked" AS (
         SELECT l.*, ROW_NUMBER() OVER (
           PARTITION BY l."groupId" ORDER BY l."lastAt" DESC, l."userId"
         ) AS "rank"
         FROM "latest" l
       )
       SELECT r."groupId", r."userId", u."firstName", u."lastName",
              COALESCE(up."hasPicture", false) AS "hasPicture"
       FROM "ranked" r
       JOIN "Users" u ON u."id" = r."userId"
       LEFT JOIN "UserProfiles" up ON up."userId" = u."id"
       WHERE r."rank" <= :maxContributors
       ORDER BY r."groupId", r."rank"`,
      {
        replacements: { groupIds, maxContributors: MAX_RECENT_CONTRIBUTORS },
        type: QueryTypes.SELECT,
      }
    );
    return rows.reduce<Record<string, HelpGroupContributor[]>>((acc, row) => {
      acc[row.groupId] = [
        ...(acc[row.groupId] ?? []),
        {
          id: row.userId,
          initials: getInitials(row.firstName, row.lastName),
          hasPicture: row.hasPicture,
        },
      ];
      return acc;
    }, {});
  }

  /**
   * Published groups only, for every reader (admins find the other ones in
   * the administration): pinned first (most recently pinned on top), then by
   * creation date, most recent first.
   */
  async findPublishedCards(reader: HelpGroupReader): Promise<HelpGroupCard[]> {
    const groups = await this.helpGroupModel.findAll({
      attributes: ['id', 'slug', 'name', 'description', 'pinnedAt'],
      where: { publishedAt: { [Op.ne]: null } },
      order: [
        ['pinnedAt', 'DESC NULLS LAST'],
        ['createdAt', 'DESC'],
        ['id', 'DESC'],
      ],
    });
    const groupIds = groups.map(({ id }) => id);

    const [membersCounts, memberGroupIds, contributors] = await Promise.all([
      this.countMembersByGroupIds(groupIds),
      this.findMemberGroupIds(reader.id, groupIds),
      this.findRecentContributorsByGroupIds(groupIds),
    ]);

    return groups.map((group) => ({
      id: group.id,
      slug: group.slug,
      name: group.name,
      description: group.description,
      membersCount: membersCounts[group.id] ?? 0,
      isMember: memberGroupIds.has(group.id),
      recentContributors: contributors[group.id] ?? [],
      pinnedAt: group.pinnedAt,
    }));
  }

  async findPage(
    slug: string,
    reader: HelpGroupReader
  ): Promise<HelpGroupPage> {
    const group = await this.findVisibleGroupBySlug(slug, reader);
    const [membersCounts, memberGroupIds] = await Promise.all([
      this.countMembersByGroupIds([group.id]),
      this.findMemberGroupIds(reader.id, [group.id]),
    ]);
    return {
      id: group.id,
      slug: group.slug,
      name: group.name,
      description: group.description,
      membersCount: membersCounts[group.id] ?? 0,
      isMember: memberGroupIds.has(group.id),
      isPublished: group.publishedAt !== null,
    };
  }

  /**
   * Visible discussions of a visible group, most recently active first,
   * paginated on `(lastActivityAt, id)`.
   */
  async findDiscussions(
    slug: string,
    reader: HelpGroupReader,
    limit: number,
    cursor?: string
  ): Promise<Page<HelpGroupDiscussionItem>> {
    const group = await this.findVisibleGroupBySlug(slug, reader);
    const decodedCursor = cursor ? decodePostCursor(cursor) : null;

    const posts = await this.postModel.findAll({
      attributes: ['id', 'title', 'createdAt', 'lastActivityAt', 'authorId'],
      where: decodedCursor
        ? {
            [Op.or]: [
              { lastActivityAt: { [Op.lt]: decodedCursor.date } },
              {
                lastActivityAt: decodedCursor.date,
                id: { [Op.lt]: decodedCursor.id },
              },
            ],
          }
        : {},
      include: [
        this.postsService.authorInclude(),
        {
          model: PostContext,
          as: 'contexts',
          attributes: [],
          where: { helpGroupId: group.id },
          required: true,
        },
      ],
      order: [
        ['lastActivityAt', 'DESC'],
        ['id', 'DESC'],
      ],
      limit: limit + 1,
      subQuery: false,
    });

    const pagePosts = posts.slice(0, limit);
    const postIds = pagePosts.map(({ id }) => id);
    const [repliesCounts, reactionsSummaries] = await Promise.all([
      this.postsService.countRepliesByPostIds(postIds),
      this.postsService.getReactionsSummaries('postId', postIds),
    ]);

    const lastPost = pagePosts[pagePosts.length - 1];

    return {
      items: pagePosts.map((post) => ({
        id: post.id,
        title: post.title,
        createdAt: post.createdAt,
        lastActivityAt: post.lastActivityAt,
        author: this.postsService.toAuthor(post.author, reader.role),
        repliesCount: repliesCounts[post.id] ?? 0,
        reactionsSummary: reactionsSummaries[post.id] ?? null,
      })),
      nextCursor:
        posts.length > limit
          ? encodePostCursor({ date: lastPost.lastActivityAt, id: lastPost.id })
          : null,
    };
  }

  /**
   * A discussion is only readable under the slug of the group it belongs to.
   */
  private async findVisibleDiscussion(
    slug: string,
    discussionId: string,
    reader: HelpGroupReader,
    withLocation = false
  ): Promise<{ group: HelpGroup; post: Post }> {
    const group = await this.findVisibleGroupBySlug(slug, reader);
    const post = await this.postsService.findOneInHelpGroup(
      discussionId,
      group.id,
      withLocation
    );
    if (!post) {
      throw new NotFoundException();
    }
    return { group, post };
  }

  async findDiscussion(
    slug: string,
    discussionId: string,
    reader: HelpGroupReader
  ): Promise<HelpGroupDiscussion> {
    const { group, post } = await this.findVisibleDiscussion(
      slug,
      discussionId,
      reader,
      true
    );
    const [repliesCounts, reactionsSummaries] = await Promise.all([
      this.postsService.countRepliesByPostIds([post.id]),
      this.postsService.getReactionsSummaries('postId', [post.id]),
    ]);

    return {
      id: post.id,
      title: post.title,
      content: post.content,
      createdAt: post.createdAt,
      editedAt: post.editedAt,
      lastActivityAt: post.lastActivityAt,
      author: this.postsService.toAuthor(post.author, reader.role, true),
      repliesCount: repliesCounts[post.id] ?? 0,
      reactionsSummary: reactionsSummaries[post.id] ?? null,
      group: {
        id: group.id,
        slug: group.slug,
        name: group.name,
        isPublished: group.publishedAt !== null,
      },
    };
  }

  async findDiscussionReplies(
    slug: string,
    discussionId: string,
    reader: HelpGroupReader,
    limit: number,
    after?: string
  ) {
    const { post } = await this.findVisibleDiscussion(
      slug,
      discussionId,
      reader
    );
    return this.postsService.findReplies(post.id, reader.role, limit, after);
  }
}
