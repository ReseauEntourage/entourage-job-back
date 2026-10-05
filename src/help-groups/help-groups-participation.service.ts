import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { isUUID } from 'class-validator';
import {
  Op,
  Transaction,
  UniqueConstraintError,
  WhereOptions,
} from 'sequelize';
import { PusherService } from 'src/external-services/pusher/pusher.service';
import {
  POST_PRIVATE_CHANNEL_PREFIX,
  PusherEvents,
} from 'src/external-services/pusher/pusher.types';
import {
  Post,
  PostContext,
  PostReaction,
  PostReactionEmoji,
  PostReply,
  PostRevision,
} from 'src/posts/models';
import {
  PostReader,
  PostReplyItem,
  PostsService,
} from 'src/posts/posts.service';
import {
  PostTitleSources,
  ReactionsSummary,
  ReactionTarget,
} from 'src/posts/posts.types';
import { User } from 'src/users/models';
import {
  CreateDiscussionDto,
  CreateReplyDto,
  ModerationDeleteDto,
  ReactionTargetDto,
  UpdateDiscussionDto,
  UpdateReplyDto,
} from './dto';
import { HelpGroupsModerationAlertService } from './help-groups-moderation-alert.service';
import { HelpGroupsRealtimeService } from './help-groups-realtime.service';
import { HelpGroupsWriteGuardService } from './help-groups-write-guard.service';
import { HelpGroupsService } from './help-groups.service';
import { HelpGroupDiscussion, HelpGroupErrorCodes } from './help-groups.types';
import { HelpGroup, HelpGroupMembership } from './models';

export interface ReactionResult {
  reactionsSummary: ReactionsSummary | null;
  targetId: string;
  viewerReaction: PostReactionEmoji | null;
}

export interface PostRevisionItem {
  content: string;
  // Date at which this version was replaced
  createdAt: Date;
  id: string;
  title: string | null;
}

export interface PostRevisionsResult {
  current: {
    content: string;
    // Date of the current version: last edit, or publication
    date: Date;
    title: string | null;
  };
  // Most recent first
  previous: PostRevisionItem[];
}

const toReader = (user: Pick<User, 'id' | 'role'>): PostReader => ({
  id: user.id,
  role: user.role,
});

/**
 * Every write of the help groups: membership, publication, replies,
 * reactions, edition, deletion by the author and moderation by an admin.
 * Pusher signals and Slack alerts are sent once the transaction is
 * committed, and never fail the write.
 */
@Injectable()
export class HelpGroupsParticipationService {
  constructor(
    @InjectModel(HelpGroupMembership)
    private helpGroupMembershipModel: typeof HelpGroupMembership,
    @InjectModel(Post)
    private postModel: typeof Post,
    @InjectModel(PostContext)
    private postContextModel: typeof PostContext,
    @InjectModel(PostReply)
    private postReplyModel: typeof PostReply,
    @InjectModel(PostReaction)
    private postReactionModel: typeof PostReaction,
    @InjectModel(PostRevision)
    private postRevisionModel: typeof PostRevision,
    @InjectModel(User)
    private userModel: typeof User,
    private helpGroupsService: HelpGroupsService,
    private writeGuard: HelpGroupsWriteGuardService,
    private postsService: PostsService,
    private realtime: HelpGroupsRealtimeService,
    private moderationAlert: HelpGroupsModerationAlertService,
    private pusherService: PusherService
  ) {}

  private transaction<T>(callback: (transaction: Transaction) => Promise<T>) {
    return this.postModel.sequelize.transaction(callback);
  }

  // ---------------------------------------------------------------------
  // Membership
  // ---------------------------------------------------------------------

  /**
   * Explicit join, idempotent. Requires the eLearning, except for an admin.
   */
  async join(slug: string, userId: string): Promise<{ isMember: true }> {
    const group = await this.writeGuard.findPublishedGroupBySlug(slug);
    const user = await this.writeGuard.findWriter(userId);
    this.writeGuard.assertElearningCompleted(user);

    const membership = await this.writeGuard.findActiveMembership(
      group.id,
      userId
    );
    if (!membership) {
      try {
        await this.helpGroupMembershipModel.create({
          groupId: group.id,
          userId,
        });
      } catch (error) {
        // Concurrent join: the active membership already exists
        if (!(error instanceof UniqueConstraintError)) {
          throw error;
        }
      }
    }
    return { isMember: true };
  }

  /**
   * Leaving is possible at any time, eLearning or not, and keeps every
   * message of the member. Joining again creates a new membership.
   */
  async leave(slug: string, userId: string): Promise<{ isMember: false }> {
    const group = await this.writeGuard.findPublishedGroupBySlug(slug);
    await this.helpGroupMembershipModel.update(
      { leftAt: new Date() },
      { where: { groupId: group.id, userId, leftAt: null } }
    );
    return { isMember: false };
  }

  // ---------------------------------------------------------------------
  // Charter
  // ---------------------------------------------------------------------

  /**
   * The charter is accepted once per person, for every group, in the same
   * transaction as their first discussion or reply.
   */
  private async ensureCharterAccepted(
    user: User,
    acceptCharter: boolean | undefined,
    transaction: Transaction
  ) {
    if (user.helpGroupsCharterAcceptedAt) {
      return;
    }
    if (!acceptCharter) {
      throw new ConflictException(HelpGroupErrorCodes.CHARTER_NOT_ACCEPTED);
    }
    await this.userModel.update(
      { helpGroupsCharterAcceptedAt: new Date() },
      { where: { id: user.id, helpGroupsCharterAcceptedAt: null }, transaction }
    );
  }

  // ---------------------------------------------------------------------
  // Publication and replies
  // ---------------------------------------------------------------------

  async createDiscussion(
    slug: string,
    userId: string,
    dto: CreateDiscussionDto
  ): Promise<HelpGroupDiscussion> {
    const { group, user } = await this.writeGuard.assertCanWrite(userId, slug);

    const post = await this.transaction(async (transaction) => {
      await this.ensureCharterAccepted(user, dto.acceptCharter, transaction);
      const now = new Date();
      const created = await this.postModel.create(
        {
          authorId: userId,
          title: dto.title,
          content: dto.content,
          titleSource: dto.titleSource ?? PostTitleSources.MANUAL,
          createdAt: now,
          lastActivityAt: now,
        },
        { transaction }
      );
      await this.postContextModel.create(
        { postId: created.id, helpGroupId: group.id },
        { transaction }
      );
      return created;
    });

    this.moderationAlert.checkMessage({
      author: user,
      group,
      discussionId: post.id,
      title: post.title,
      content: post.content,
    });
    return this.helpGroupsService.findDiscussion(slug, post.id, toReader(user));
  }

  /**
   * A non deleted discussion of the group, otherwise 404 with a dedicated
   * code so that the front can tell a discussion deleted in the meantime.
   */
  private async findDiscussionOrFail(
    discussionId: string,
    group: HelpGroup
  ): Promise<Post> {
    const post = await this.postsService.findOneInHelpGroup(
      discussionId,
      group.id
    );
    if (!post) {
      throw new NotFoundException(HelpGroupErrorCodes.DISCUSSION_NOT_FOUND);
    }
    return post;
  }

  async createReply(
    slug: string,
    discussionId: string,
    userId: string,
    dto: CreateReplyDto
  ): Promise<PostReplyItem> {
    const { group, user } = await this.writeGuard.assertCanWrite(userId, slug);
    const post = await this.findDiscussionOrFail(discussionId, group);

    const reply = await this.transaction(async (transaction) => {
      await this.ensureCharterAccepted(user, dto.acceptCharter, transaction);
      const created = await this.postReplyModel.create(
        { postId: post.id, authorId: userId, content: dto.content },
        { transaction }
      );
      await this.postsService.refreshLastActivityAt(post.id, transaction);
      return created;
    });

    this.realtime.notify(PusherEvents.REPLY_CREATED, {
      discussionId: post.id,
      replyId: reply.id,
    });
    this.moderationAlert.checkMessage({
      author: user,
      group,
      discussionId: post.id,
      replyId: reply.id,
      content: reply.content,
    });
    return this.postsService.findReplyItem(reply.id, toReader(user));
  }

  // ---------------------------------------------------------------------
  // Reactions
  // ---------------------------------------------------------------------

  /**
   * The reacted message must be the discussion itself or one of its visible
   * replies.
   */
  private async resolveReactionTarget(
    post: Post,
    target: ReactionTargetDto
  ): Promise<{ field: ReactionTarget; id: string }> {
    const hasDiscussion = !!target?.discussionId;
    const hasReply = !!target?.replyId;
    if (hasDiscussion === hasReply) {
      throw new BadRequestException(
        'target must hold exactly one of discussionId or replyId'
      );
    }
    if (hasDiscussion) {
      if (target.discussionId !== post.id) {
        throw new NotFoundException();
      }
      return { field: 'postId', id: post.id };
    }
    const reply = await this.postReplyModel.findOne({
      attributes: ['id'],
      where: { id: target.replyId, postId: post.id },
    });
    if (!reply) {
      throw new NotFoundException();
    }
    return { field: 'replyId', id: reply.id };
  }

  private async toReactionResult(
    field: ReactionTarget,
    targetId: string,
    userId: string
  ): Promise<ReactionResult> {
    const [summaries, viewerReactions] = await Promise.all([
      this.postsService.getReactionsSummaries(field, [targetId]),
      this.postsService.getViewerReactions(field, [targetId], userId),
    ]);
    return {
      targetId,
      reactionsSummary: summaries[targetId] ?? null,
      viewerReaction: viewerReactions[targetId] ?? null,
    };
  }

  private async upsertReaction(
    where: WhereOptions<PostReaction>,
    values: Partial<PostReaction>,
    emoji: PostReactionEmoji
  ) {
    const existing = await this.postReactionModel.findOne({ where });
    if (existing) {
      if (existing.emoji !== emoji) {
        await existing.update({ emoji });
      }
      return;
    }
    await this.postReactionModel.create({ ...values, emoji });
  }

  /**
   * One active reaction per person and message: choosing another emoji
   * replaces the previous one. Reacting to one's own message is allowed, and
   * reacting does not require the charter.
   */
  async setReaction(
    slug: string,
    discussionId: string,
    userId: string,
    target: ReactionTargetDto,
    emoji: PostReactionEmoji
  ): Promise<ReactionResult> {
    const { group } = await this.writeGuard.assertCanWrite(userId, slug);
    const post = await this.findDiscussionOrFail(discussionId, group);
    const { field, id } = await this.resolveReactionTarget(post, target);

    const values = { userId, [field]: id } as Partial<PostReaction>;
    const where = values as WhereOptions<PostReaction>;
    try {
      await this.upsertReaction(where, values, emoji);
    } catch (error) {
      // Concurrent reaction of the same person: retry once, as an update
      if (!(error instanceof UniqueConstraintError)) {
        throw error;
      }
      await this.upsertReaction(where, values, emoji);
    }

    this.realtime.notify(PusherEvents.REACTIONS_UPDATED, {
      discussionId: post.id,
      targetId: id,
    });
    return this.toReactionResult(field, id, userId);
  }

  async removeReaction(
    slug: string,
    discussionId: string,
    userId: string,
    target: ReactionTargetDto
  ): Promise<ReactionResult> {
    const { group } = await this.writeGuard.assertCanWrite(userId, slug);
    const post = await this.findDiscussionOrFail(discussionId, group);
    const { field, id } = await this.resolveReactionTarget(post, target);

    await this.postReactionModel.destroy({
      where: { userId, [field]: id } as WhereOptions<PostReaction>,
    });

    this.realtime.notify(PusherEvents.REACTIONS_UPDATED, {
      discussionId: post.id,
      targetId: id,
    });
    return this.toReactionResult(field, id, userId);
  }

  // ---------------------------------------------------------------------
  // Edition and deletion by the author
  // ---------------------------------------------------------------------

  /**
   * Only the authorship is checked: an author who left the group, or whose
   * eLearning is not completed, keeps the control of what they published.
   * The group must still be readable by them.
   */
  private async findOwnDiscussion(
    slug: string,
    discussionId: string,
    user: User
  ): Promise<{ group: HelpGroup; post: Post }> {
    const group = await this.helpGroupsService.findVisibleGroupBySlug(
      slug,
      toReader(user)
    );
    const post = await this.findDiscussionOrFail(discussionId, group);
    return { group, post };
  }

  private async findReplyOrFail(post: Post, replyId: string) {
    const reply = await this.postReplyModel.findOne({
      where: { id: replyId, postId: post.id },
    });
    if (!reply) {
      throw new NotFoundException();
    }
    return reply;
  }

  private assertAuthor(authorId: string, userId: string) {
    if (authorId !== userId) {
      throw new ForbiddenException();
    }
  }

  /**
   * Saves the previous version, then updates the message. Changes neither the
   * replies order nor the last activity of the discussion. An identical
   * content saves no revision.
   */
  async updateDiscussion(
    slug: string,
    discussionId: string,
    userId: string,
    dto: UpdateDiscussionDto
  ): Promise<HelpGroupDiscussion> {
    if (dto.title === undefined && dto.content === undefined) {
      throw new BadRequestException('title or content is required');
    }
    const user = await this.writeGuard.findWriter(userId);
    const { group, post } = await this.findOwnDiscussion(
      slug,
      discussionId,
      user
    );
    this.assertAuthor(post.authorId, userId);

    const title = dto.title ?? post.title;
    const content = dto.content ?? post.content;
    if (title !== post.title || content !== post.content) {
      await this.transaction(async (transaction) => {
        await this.postRevisionModel.create(
          {
            postId: post.id,
            title: post.title,
            content: post.content,
            editedById: userId,
          },
          { transaction }
        );
        await this.postModel.update(
          { title, content, editedAt: new Date() },
          { where: { id: post.id }, transaction }
        );
      });
      this.realtime.notify(PusherEvents.DISCUSSION_UPDATED, {
        discussionId: post.id,
      });
      this.moderationAlert.checkMessage({
        author: user,
        group,
        discussionId: post.id,
        title,
        content,
      });
    }
    return this.helpGroupsService.findDiscussion(slug, post.id, toReader(user));
  }

  async updateReply(
    slug: string,
    discussionId: string,
    replyId: string,
    userId: string,
    dto: UpdateReplyDto
  ): Promise<PostReplyItem> {
    const user = await this.writeGuard.findWriter(userId);
    const { group, post } = await this.findOwnDiscussion(
      slug,
      discussionId,
      user
    );
    const reply = await this.findReplyOrFail(post, replyId);
    this.assertAuthor(reply.authorId, userId);

    if (dto.content !== reply.content) {
      await this.transaction(async (transaction) => {
        await this.postRevisionModel.create(
          { replyId: reply.id, content: reply.content, editedById: userId },
          { transaction }
        );
        await this.postReplyModel.update(
          { content: dto.content, editedAt: new Date() },
          { where: { id: reply.id }, transaction }
        );
      });
      this.realtime.notify(PusherEvents.REPLY_UPDATED, {
        discussionId: post.id,
        replyId: reply.id,
      });
      this.moderationAlert.checkMessage({
        author: user,
        group,
        discussionId: post.id,
        replyId: reply.id,
        content: dto.content,
      });
    }
    return this.postsService.findReplyItem(reply.id, toReader(user));
  }

  /**
   * Soft deletion. Deleting a discussion does not cascade on its replies:
   * their invisibility derives from the discussion.
   */
  private async softDeletePost(
    postId: string,
    deletion: Partial<Post>
  ): Promise<void> {
    await this.transaction(async (transaction) => {
      await this.postModel.update(deletion, {
        where: { id: postId },
        transaction,
      });
      await this.postModel.destroy({ where: { id: postId }, transaction });
    });
    this.realtime.notify(PusherEvents.DISCUSSION_DELETED, {
      discussionId: postId,
    });
  }

  /**
   * Soft deletion, with the last activity of the discussion recomputed in
   * the same transaction.
   */
  private async softDeleteReply(
    reply: PostReply,
    deletion: Partial<PostReply>
  ): Promise<void> {
    await this.transaction(async (transaction) => {
      await this.postReplyModel.update(deletion, {
        where: { id: reply.id },
        transaction,
      });
      await this.postReplyModel.destroy({
        where: { id: reply.id },
        transaction,
      });
      await this.postsService.refreshLastActivityAt(reply.postId, transaction);
    });
    this.realtime.notify(PusherEvents.REPLY_DELETED, {
      discussionId: reply.postId,
      replyId: reply.id,
    });
  }

  async deleteDiscussion(
    slug: string,
    discussionId: string,
    userId: string
  ): Promise<void> {
    const user = await this.writeGuard.findWriter(userId);
    const { post } = await this.findOwnDiscussion(slug, discussionId, user);
    this.assertAuthor(post.authorId, userId);
    await this.softDeletePost(post.id, { deletedById: userId });
  }

  async deleteReply(
    slug: string,
    discussionId: string,
    replyId: string,
    userId: string
  ): Promise<void> {
    const user = await this.writeGuard.findWriter(userId);
    const { post } = await this.findOwnDiscussion(slug, discussionId, user);
    const reply = await this.findReplyOrFail(post, replyId);
    this.assertAuthor(reply.authorId, userId);
    await this.softDeleteReply(reply, { deletedById: userId });
  }

  // ---------------------------------------------------------------------
  // Moderation by an Entourage admin
  // ---------------------------------------------------------------------

  /**
   * A non deleted help group discussion, whatever the state of its group:
   * an admin moderates from the group, member or not. The author is never
   * notified.
   */
  async moderateDiscussion(
    discussionId: string,
    adminId: string,
    dto: ModerationDeleteDto
  ): Promise<void> {
    const post = await this.postModel.findOne({
      attributes: ['id'],
      where: { id: discussionId },
      include: [
        {
          model: PostContext,
          as: 'contexts',
          attributes: [],
          where: { helpGroupId: { [Op.ne]: null } },
          required: true,
        },
      ],
    });
    if (!post) {
      throw new NotFoundException();
    }
    await this.softDeletePost(post.id, {
      deletedById: adminId,
      deletionReason: dto.reason,
      deletionComment: dto.comment || null,
    });
  }

  async moderateReply(
    replyId: string,
    adminId: string,
    dto: ModerationDeleteDto
  ): Promise<void> {
    const reply = await this.postReplyModel.findByPk(replyId);
    if (!reply) {
      throw new NotFoundException();
    }
    await this.softDeleteReply(reply, {
      deletedById: adminId,
      deletionReason: dto.reason,
      deletionComment: dto.comment || null,
    });
  }

  /**
   * Current version first, then the previous ones from the most recent.
   * Still readable once the message is deleted.
   */
  async findRevisions(
    target: ReactionTarget,
    id: string
  ): Promise<PostRevisionsResult> {
    const message =
      target === 'postId'
        ? await this.postModel.findByPk(id, { paranoid: false })
        : await this.postReplyModel.findByPk(id, { paranoid: false });
    if (!message) {
      throw new NotFoundException();
    }
    const revisions = await this.postRevisionModel.findAll({
      where: { [target]: id } as WhereOptions<PostRevision>,
      order: [
        ['createdAt', 'DESC'],
        ['id', 'DESC'],
      ],
    });
    return {
      current: {
        title: message instanceof Post ? message.title : null,
        content: message.content,
        date: message.editedAt ?? message.createdAt,
      },
      previous: revisions.map((revision) => ({
        id: revision.id,
        title: revision.title,
        content: revision.content,
        createdAt: revision.createdAt,
      })),
    };
  }

  // ---------------------------------------------------------------------
  // Realtime subscription
  // ---------------------------------------------------------------------

  /**
   * Signs a subscription to the private channel of a discussion, for a
   * logged-in user who can read it (lot 1 visibility rule: published group,
   * or admin; non deleted discussion). No membership check: reading is open
   * to every logged-in user. Any other channel name is refused.
   */
  async authorizeChannel(
    socketId: string,
    channelName: string,
    reader: PostReader
  ) {
    const postId = channelName?.startsWith(POST_PRIVATE_CHANNEL_PREFIX)
      ? channelName.slice(POST_PRIVATE_CHANNEL_PREFIX.length)
      : null;
    if (!socketId || !postId || !isUUID(postId, 4)) {
      throw new ForbiddenException();
    }
    const context = await this.postContextModel.findOne({
      attributes: ['helpGroupId'],
      where: { postId, helpGroupId: { [Op.ne]: null } },
      // paranoid by default: a deleted discussion is not found
      include: [{ model: Post, as: 'post', attributes: [], required: true }],
    });
    if (!context) {
      throw new ForbiddenException();
    }
    try {
      await this.helpGroupsService.findVisibleGroupById(
        context.helpGroupId,
        reader
      );
    } catch {
      throw new ForbiddenException();
    }
    return this.pusherService.authorizeChannel(socketId, channelName);
  }
}
