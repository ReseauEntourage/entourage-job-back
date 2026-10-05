import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import {
  fn,
  col,
  Includeable,
  Op,
  QueryTypes,
  Transaction,
  WhereOptions,
} from 'sequelize';
import { UserProfile } from 'src/user-profiles/models';
import { User } from 'src/users/models';
import { UserRole } from 'src/users/users.types';
import {
  Post,
  PostContext,
  PostReaction,
  PostReactionEmoji,
  PostReactionEmojis,
  PostReply,
} from './models';
import { PostAuthor, ReactionsSummary, ReactionTarget } from './posts.types';
import {
  decodePostCursor,
  encodePostCursor,
  PostAuthorSource,
  toPostAuthor,
} from './posts.utils';

const MAX_REACTION_FIRST_NAMES = 3;

export const postAuthorAttributes = [
  'id',
  'firstName',
  'lastName',
  'role',
  'deletedAt',
  'onboardingStatus',
  'elearningCompletedAt',
];

export interface PostReplyItem {
  author: PostAuthor;
  content: string;
  createdAt: Date;
  editedAt: Date | null;
  id: string;
  reactionsSummary: ReactionsSummary | null;
  // Active reaction of the reader on this reply
  viewerReaction: PostReactionEmoji | null;
}

export interface PostReader {
  id: string;
  role: UserRole;
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

@Injectable()
export class PostsService {
  constructor(
    @InjectModel(Post)
    private postModel: typeof Post,
    @InjectModel(PostContext)
    private postContextModel: typeof PostContext,
    @InjectModel(PostReply)
    private postReplyModel: typeof PostReply,
    @InjectModel(PostReaction)
    private postReactionModel: typeof PostReaction
  ) {}

  /**
   * Author include: read with `paranoid: false` so that messages of a deleted
   * account are still displayed (as "Utilisateur supprimé").
   */
  authorInclude(withLocation = false): Includeable {
    return {
      model: User,
      as: 'author',
      attributes: postAuthorAttributes,
      paranoid: false,
      required: false,
      include: withLocation
        ? [
            {
              model: UserProfile,
              as: 'userProfile',
              attributes: ['department'],
              required: false,
            },
          ]
        : [],
    };
  }

  toAuthor(
    author: User | undefined,
    readerRole: UserRole,
    withLocation = false
  ): PostAuthor {
    const source = author?.toJSON
      ? (author.toJSON() as PostAuthorSource)
      : (author as PostAuthorSource);
    return toPostAuthor(source, readerRole, withLocation);
  }

  /**
   * Finds a visible (non deleted) post shown in the given help group.
   */
  async findOneInHelpGroup(
    postId: string,
    helpGroupId: string,
    withLocation = false
  ): Promise<Post | null> {
    return this.postModel.findOne({
      where: { id: postId },
      include: [
        this.authorInclude(withLocation),
        {
          model: PostContext,
          as: 'contexts',
          attributes: [],
          where: { helpGroupId },
          required: true,
        },
      ],
    });
  }

  /**
   * Visible replies count per post, in a single grouped query.
   */
  async countRepliesByPostIds(
    postIds: string[]
  ): Promise<Record<string, number>> {
    if (postIds.length === 0) {
      return {};
    }
    const rows = (await this.postReplyModel.findAll({
      attributes: ['postId', [fn('COUNT', col('id')), 'count']],
      where: { postId: postIds },
      group: ['postId'],
      raw: true,
    })) as unknown as { postId: string; count: string }[];

    return rows.reduce<Record<string, number>>((acc, row) => {
      acc[row.postId] = parseInt(row.count, 10);
      return acc;
    }, {});
  }

  /**
   * Reactions summaries of the given posts or replies, in a single query.
   * Reactions of deleted accounts are ignored. Targets without any reaction
   * are absent from the result.
   */
  async getReactionsSummaries(
    target: ReactionTarget,
    ids: string[]
  ): Promise<Record<string, ReactionsSummary>> {
    if (ids.length === 0) {
      return {};
    }
    const reactions = await this.postReactionModel.findAll({
      attributes: ['id', 'postId', 'replyId', 'userId', 'emoji', 'createdAt'],
      where: { [target]: ids } as WhereOptions<PostReaction>,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'firstName'],
          // paranoid by default: reactions of deleted accounts are excluded
          required: true,
        },
      ],
      order: [
        ['createdAt', 'ASC'],
        ['id', 'ASC'],
      ],
    });

    const grouped = reactions.reduce<
      Record<string, { emojis: Set<string>; users: Map<string, string> }>
    >((acc, reaction) => {
      const targetId = reaction[target];
      if (!acc[targetId]) {
        acc[targetId] = { emojis: new Set(), users: new Map() };
      }
      acc[targetId].emojis.add(reaction.emoji);
      if (!acc[targetId].users.has(reaction.userId)) {
        acc[targetId].users.set(reaction.userId, reaction.user.firstName);
      }
      return acc;
    }, {});

    return Object.entries(grouped).reduce<Record<string, ReactionsSummary>>(
      (acc, [targetId, { emojis, users }]) => {
        const firstNames = Array.from(users.values());
        acc[targetId] = {
          emojis: PostReactionEmojis.filter((emoji) => emojis.has(emoji)),
          firstNames: firstNames.slice(0, MAX_REACTION_FIRST_NAMES),
          hasOthers: firstNames.length > MAX_REACTION_FIRST_NAMES,
        };
        return acc;
      },
      {}
    );
  }

  /**
   * Active reaction of a user on each of the given posts or replies.
   */
  async getViewerReactions(
    target: ReactionTarget,
    ids: string[],
    userId: string
  ): Promise<Record<string, PostReactionEmoji>> {
    if (ids.length === 0) {
      return {};
    }
    const reactions = await this.postReactionModel.findAll({
      attributes: ['postId', 'replyId', 'emoji'],
      where: { [target]: ids, userId } as WhereOptions<PostReaction>,
    });
    return reactions.reduce<Record<string, PostReactionEmoji>>(
      (acc, reaction) => {
        acc[reaction[target]] = reaction.emoji;
        return acc;
      },
      {}
    );
  }

  /**
   * Recomputes the last activity of a post after a reply was created or
   * deleted: the date of its most recent visible reply, or its creation date.
   * Meant to run in the transaction of the reply write.
   */
  async refreshLastActivityAt(postId: string, transaction: Transaction) {
    await this.postModel.sequelize.query(
      `UPDATE "Posts" p
       SET "lastActivityAt" = GREATEST(
         p."createdAt",
         COALESCE(
           (SELECT MAX(r."createdAt") FROM "PostReplies" r
            WHERE r."postId" = p."id" AND r."deletedAt" IS NULL),
           p."createdAt"
         )
       )
       WHERE p."id" = :postId`,
      { replacements: { postId }, type: QueryTypes.UPDATE, transaction }
    );
  }

  /**
   * A single visible reply, shaped like the items of `findReplies`.
   */
  async findReplyItem(
    replyId: string,
    reader: PostReader
  ): Promise<PostReplyItem | null> {
    const reply = await this.postReplyModel.findByPk(replyId, {
      attributes: ['id', 'content', 'createdAt', 'editedAt', 'authorId'],
      include: [this.authorInclude()],
    });
    if (!reply) {
      return null;
    }
    const [reactionsSummaries, viewerReactions] = await Promise.all([
      this.getReactionsSummaries('replyId', [reply.id]),
      this.getViewerReactions('replyId', [reply.id], reader.id),
    ]);
    return {
      id: reply.id,
      content: reply.content,
      createdAt: reply.createdAt,
      editedAt: reply.editedAt,
      author: this.toAuthor(reply.author, reader.role),
      reactionsSummary: reactionsSummaries[reply.id] ?? null,
      viewerReaction: viewerReactions[reply.id] ?? null,
    };
  }

  /**
   * Visible replies of a post, oldest first, paginated on `(createdAt, id)`.
   */
  async findReplies(
    postId: string,
    reader: PostReader,
    limit: number,
    after?: string
  ): Promise<Page<PostReplyItem>> {
    const cursor = after ? decodePostCursor(after) : null;

    const replies = await this.postReplyModel.findAll({
      attributes: ['id', 'content', 'createdAt', 'editedAt', 'authorId'],
      where: {
        postId,
        ...(cursor
          ? {
              [Op.or]: [
                { createdAt: { [Op.gt]: cursor.date } },
                { createdAt: cursor.date, id: { [Op.gt]: cursor.id } },
              ],
            }
          : {}),
      },
      include: [this.authorInclude()],
      order: [
        ['createdAt', 'ASC'],
        ['id', 'ASC'],
      ],
      limit: limit + 1,
    });

    const pageReplies = replies.slice(0, limit);
    const replyIds = pageReplies.map(({ id }) => id);
    const [reactionsSummaries, viewerReactions] = await Promise.all([
      this.getReactionsSummaries('replyId', replyIds),
      this.getViewerReactions('replyId', replyIds, reader.id),
    ]);

    const lastReply = pageReplies[pageReplies.length - 1];

    return {
      items: pageReplies.map((reply) => ({
        id: reply.id,
        content: reply.content,
        createdAt: reply.createdAt,
        editedAt: reply.editedAt,
        author: this.toAuthor(reply.author, reader.role),
        reactionsSummary: reactionsSummaries[reply.id] ?? null,
        viewerReaction: viewerReactions[reply.id] ?? null,
      })),
      nextCursor:
        replies.length > limit
          ? encodePostCursor({ date: lastReply.createdAt, id: lastReply.id })
          : null,
    };
  }
}
