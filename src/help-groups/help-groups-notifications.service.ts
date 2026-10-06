import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import {
  NotificationEventMatch,
  NotificationsService,
} from 'src/notifications/notifications.service';
import {
  NotificationItem,
  NotificationPresenter,
  NotificationRow,
  NotificationSubjectType,
  NotificationSubjectTypes,
  NotificationTypes,
} from 'src/notifications/notifications.types';
import {
  areAllEventsSeen,
  formatActorNames,
  getDistinctActorIds,
  sortEvents,
  toExcerpt,
} from 'src/notifications/notifications.utils';
import { Post, PostReaction, PostReply } from 'src/posts/models';
import { QueuesService } from 'src/queues/producers/queues.service';
import { Jobs } from 'src/queues/queues.types';
import { User } from 'src/users/models';
import { HelpGroup, HelpGroupMembership } from './models';

/**
 * Time left to the bell and to the "seen" marking to establish that a
 * connected person already read the event, before its email is sent.
 */
export const HELP_GROUP_NOTIFICATION_EMAIL_DELAY_MS = 60 * 1000;

// BullMQ refuses a custom job id holding a single ":"
export const getHelpGroupNotificationEmailJobId = (
  notificationId: string,
  eventId: string
) => `help-group-notification-${notificationId}-${eventId}`;

// A visible message, with what the bell and the emails display of it
export interface VisibleDiscussion {
  authorId: string;
  id: string;
  title: string | null;
}

export interface VisibleReply {
  authorId: string;
  content: string;
  id: string;
  postId: string;
}

interface ReactedMessage {
  authorId: string;
  // Absent for the discussion message itself
  replyId?: string;
  subjectType: NotificationSubjectType;
}

/**
 * Producer of the help groups notifications, called once the writes of the
 * lots 2 and 3 are committed. A failure is logged and never fails the write.
 * Also presents the help groups rows of the bell.
 *
 * - a reply notifies the author of the discussion and the authors of its
 *   visible replies (one row per discussion and recipient);
 * - a new reaction notifies the author of the message (one row per message);
 * - a deleted or hidden message removes its events, a restored message
 *   creates none.
 * The author of the action, a former member, a deleted account and the
 * members of a group no longer visible are never notified.
 */
@Injectable()
export class HelpGroupsNotificationsService
  implements OnModuleInit, NotificationPresenter
{
  private readonly logger = new Logger(HelpGroupsNotificationsService.name);

  constructor(
    @InjectModel(HelpGroup)
    private helpGroupModel: typeof HelpGroup,
    @InjectModel(HelpGroupMembership)
    private helpGroupMembershipModel: typeof HelpGroupMembership,
    @InjectModel(Post)
    private postModel: typeof Post,
    @InjectModel(PostReply)
    private postReplyModel: typeof PostReply,
    @InjectModel(PostReaction)
    private postReactionModel: typeof PostReaction,
    @InjectModel(User)
    private userModel: typeof User,
    private notificationsService: NotificationsService,
    private queuesService: QueuesService
  ) {}

  onModuleInit() {
    this.notificationsService.registerPresenter(
      [
        NotificationTypes.HELP_GROUP_REPLY,
        NotificationTypes.HELP_GROUP_REACTION,
      ],
      this
    );
  }

  private async safely(label: string, callback: () => Promise<void>) {
    try {
      await callback();
    } catch (error) {
      this.logger.error(
        `[HelpGroupsNotifications] ${label} failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  // ---------------------------------------------------------------------
  // Recipients
  // ---------------------------------------------------------------------

  /**
   * Published and non deleted group, as for any non admin reader.
   */
  async findReadableGroup(groupId: string): Promise<HelpGroup | null> {
    return this.helpGroupModel.findOne({
      where: { id: groupId, publishedAt: { [Op.ne]: null } },
    });
  }

  /**
   * Active memberships of the given users in the group, deleted accounts
   * excluded.
   */
  async findActiveMemberships(
    groupId: string,
    userIds: string[]
  ): Promise<HelpGroupMembership[]> {
    if (userIds.length === 0) {
      return [];
    }
    return this.helpGroupMembershipModel.findAll({
      where: { groupId, userId: userIds, leftAt: null },
      include: [
        // paranoid by default: deleted accounts are excluded
        { model: User, as: 'user', attributes: ['id'], required: true },
      ],
    });
  }

  private async filterRecipients(
    groupId: string,
    candidateIds: string[],
    actorId: string
  ): Promise<string[]> {
    const userIds = Array.from(new Set(candidateIds)).filter(
      (id) => id !== actorId
    );
    if (userIds.length === 0 || !(await this.findReadableGroup(groupId))) {
      return [];
    }
    const memberships = await this.findActiveMemberships(groupId, userIds);
    return memberships.map(({ userId }) => userId);
  }

  private async enqueueEmail(notificationId: string, eventId: string) {
    await this.queuesService.addToWorkQueue(
      Jobs.SEND_HELP_GROUP_NOTIFICATION_EMAIL,
      { notificationId, eventId },
      {
        delay: HELP_GROUP_NOTIFICATION_EMAIL_DELAY_MS,
        jobId: getHelpGroupNotificationEmailJobId(notificationId, eventId),
      }
    );
  }

  // ---------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------

  async onReplyCreated(input: {
    discussion: { authorId: string; id: string };
    groupId: string;
    reply: { authorId: string; createdAt: Date; id: string };
  }): Promise<void> {
    const { discussion, groupId, reply } = input;
    await this.safely(`reply ${reply.id}`, async () => {
      // Authors of the visible replies (paranoid: deleted ones excluded)
      const participants = await this.postReplyModel.findAll({
        attributes: ['authorId'],
        where: { postId: discussion.id, hiddenAt: null },
        group: ['authorId'],
        raw: true,
      });
      const recipients = await this.filterRecipients(
        groupId,
        [discussion.authorId, ...participants.map(({ authorId }) => authorId)],
        reply.authorId
      );
      for (const userId of recipients) {
        // Each recipient on their own: a failure never deprives the others
        await this.safely(`reply ${reply.id} for ${userId}`, async () => {
          const notificationId = await this.notificationsService.upsertEvent({
            userId,
            type: NotificationTypes.HELP_GROUP_REPLY,
            subjectType: NotificationSubjectTypes.POST,
            subjectId: discussion.id,
            groupId,
            event: {
              actorId: reply.authorId,
              eventId: reply.id,
              at: reply.createdAt,
            },
          });
          if (notificationId) {
            await this.enqueueEmail(notificationId, reply.id);
          }
        });
      }
      this.notificationsService.notifyChanged(recipients);
    });
  }

  /**
   * Only a new reaction is an event: replacing one's emoji is not.
   */
  async onReactionAdded(input: {
    groupId: string;
    message: ReactedMessage & { id: string };
    reaction: { createdAt: Date; id: string; userId: string };
  }): Promise<void> {
    const { groupId, message, reaction } = input;
    await this.safely(`reaction ${reaction.id}`, async () => {
      const recipients = await this.filterRecipients(
        groupId,
        [message.authorId],
        reaction.userId
      );
      for (const userId of recipients) {
        // Each recipient on their own: a failure never deprives the others
        await this.safely(`reaction ${reaction.id} for ${userId}`, async () => {
          const notificationId = await this.notificationsService.upsertEvent({
            userId,
            type: NotificationTypes.HELP_GROUP_REACTION,
            subjectType: message.subjectType,
            subjectId: message.id,
            groupId,
            event: {
              actorId: reaction.userId,
              eventId: reaction.id,
              at: reaction.createdAt,
            },
          });
          if (notificationId) {
            await this.enqueueEmail(notificationId, reaction.id);
          }
        });
      }
      this.notificationsService.notifyChanged(recipients);
    });
  }

  async onReactionRemoved(input: {
    actorId: string;
    messageId: string;
  }): Promise<void> {
    await this.removeEvents(
      `reaction removal on ${input.messageId}`,
      NotificationTypes.HELP_GROUP_REACTION,
      [input.messageId],
      { actorId: input.actorId }
    );
  }

  /**
   * A reply deleted or hidden: its event leaves the notifications of its
   * discussion, and the notifications of the reactions to it are removed.
   */
  async onReplyRemoved(input: {
    discussionId: string;
    replyId: string;
  }): Promise<void> {
    await this.safely(`reply ${input.replyId} removal`, async () => {
      const [replyRecipients, reactionRecipients] = await Promise.all([
        this.notificationsService.removeEvents(
          NotificationTypes.HELP_GROUP_REPLY,
          [input.discussionId],
          { eventId: input.replyId }
        ),
        this.notificationsService.removeBySubjects(
          NotificationSubjectTypes.POST_REPLY,
          [input.replyId]
        ),
      ]);
      this.notificationsService.notifyChanged([
        ...replyRecipients,
        ...reactionRecipients,
      ]);
    });
  }

  /**
   * A discussion deleted or hidden: every notification about it or about
   * one of its replies is removed.
   */
  async onDiscussionRemoved(input: { discussionId: string }): Promise<void> {
    await this.safely(`discussion ${input.discussionId} removal`, async () => {
      const replies = await this.postReplyModel.findAll({
        attributes: ['id'],
        where: { postId: input.discussionId },
        paranoid: false,
      });
      const [discussionRecipients, repliesRecipients] = await Promise.all([
        this.notificationsService.removeBySubjects(
          NotificationSubjectTypes.POST,
          [input.discussionId]
        ),
        this.notificationsService.removeBySubjects(
          NotificationSubjectTypes.POST_REPLY,
          replies.map(({ id }) => id)
        ),
      ]);
      this.notificationsService.notifyChanged([
        ...discussionRecipients,
        ...repliesRecipients,
      ]);
    });
  }

  private async removeEvents(
    label: string,
    type: (typeof NotificationTypes)[keyof typeof NotificationTypes],
    subjectIds: string[],
    match: NotificationEventMatch
  ) {
    await this.safely(label, async () => {
      const recipients = await this.notificationsService.removeEvents(
        type,
        subjectIds,
        match
      );
      this.notificationsService.notifyChanged(recipients);
    });
  }

  // ---------------------------------------------------------------------
  // Visible contents, shared by the bell and the emails
  // ---------------------------------------------------------------------

  /**
   * Non deleted and non hidden discussions among the given ones.
   */
  async findVisibleDiscussions(
    ids: string[]
  ): Promise<Map<string, VisibleDiscussion>> {
    if (ids.length === 0) {
      return new Map();
    }
    const posts = await this.postModel.findAll({
      attributes: ['id', 'title', 'authorId'],
      where: { id: ids, hiddenAt: null },
    });
    return new Map(
      posts.map((post) => [
        post.id,
        { id: post.id, title: post.title, authorId: post.authorId },
      ])
    );
  }

  /**
   * Non deleted and non hidden replies among the given ones.
   */
  async findVisibleReplies(ids: string[]): Promise<Map<string, VisibleReply>> {
    if (ids.length === 0) {
      return new Map();
    }
    const replies = await this.postReplyModel.findAll({
      attributes: ['id', 'postId', 'authorId', 'content'],
      where: { id: ids, hiddenAt: null },
    });
    return new Map(
      replies.map((reply) => [
        reply.id,
        {
          id: reply.id,
          postId: reply.postId,
          authorId: reply.authorId,
          content: reply.content,
        },
      ])
    );
  }

  /**
   * Active reactions among the given ones.
   */
  async findActiveReactionIds(ids: string[]): Promise<Set<string>> {
    if (ids.length === 0) {
      return new Set();
    }
    const reactions = await this.postReactionModel.findAll({
      attributes: ['id'],
      where: { id: ids },
    });
    return new Set(reactions.map(({ id }) => id));
  }

  /**
   * First names of the non deleted accounts among the given ones.
   */
  async findFirstNames(ids: string[]): Promise<Map<string, string>> {
    if (ids.length === 0) {
      return new Map();
    }
    const users = await this.userModel.findAll({
      attributes: ['id', 'firstName'],
      where: { id: ids },
    });
    return new Map(users.map((user) => [user.id, user.firstName]));
  }

  // ---------------------------------------------------------------------
  // Bell
  // ---------------------------------------------------------------------

  async present(
    rows: NotificationRow[],
    recipientId: string
  ): Promise<Map<string, NotificationItem>> {
    const groupIds = Array.from(
      new Set(rows.map(({ groupId }) => groupId).filter(Boolean))
    );
    const groups = groupIds.length
      ? await this.helpGroupModel.findAll({
          attributes: ['id', 'slug', 'name'],
          where: { id: groupIds, publishedAt: { [Op.ne]: null } },
        })
      : [];
    const groupsById = new Map(groups.map((group) => [group.id, group]));

    const replyRows = rows.filter(
      ({ type }) => type === NotificationTypes.HELP_GROUP_REPLY
    );
    const reactionRows = rows.filter(
      ({ type }) => type === NotificationTypes.HELP_GROUP_REACTION
    );
    // Replies: the events of reply rows, and the reacted replies
    const replies = await this.findVisibleReplies([
      ...replyRows.flatMap(({ events }) => events.map((e) => e.eventId)),
      ...reactionRows
        .filter(
          ({ subjectType }) =>
            subjectType === NotificationSubjectTypes.POST_REPLY
        )
        .map(({ subjectId }) => subjectId),
    ]);
    const discussions = await this.findVisibleDiscussions(
      Array.from(
        new Set([
          ...replyRows.map(({ subjectId }) => subjectId),
          ...reactionRows.map(({ subjectType, subjectId }) =>
            subjectType === NotificationSubjectTypes.POST
              ? subjectId
              : replies.get(subjectId)?.postId
          ),
        ])
      ).filter(Boolean)
    );
    const firstNames = await this.findFirstNames(
      Array.from(
        new Set(rows.flatMap(({ events }) => events.map((e) => e.actorId)))
      )
    );
    // A reaction removed while its event stayed (failed or racing cleanup)
    const reactionIds = await this.findActiveReactionIds(
      reactionRows.flatMap(({ events }) => events.map((e) => e.eventId))
    );

    const items = new Map<string, NotificationItem>();
    rows.forEach((row) => {
      const group = groupsById.get(row.groupId);
      if (!group) {
        return;
      }
      const isReply = row.type === NotificationTypes.HELP_GROUP_REPLY;
      const discussionId = isReply
        ? row.subjectId
        : row.subjectType === NotificationSubjectTypes.POST
          ? row.subjectId
          : replies.get(row.subjectId)?.postId;
      const discussion = discussions.get(discussionId);
      if (!discussion) {
        return;
      }
      // Only the events still visible, by a non deleted account
      const events = sortEvents(row.events).filter(
        (event) =>
          firstNames.has(event.actorId) &&
          (isReply
            ? replies.has(event.eventId)
            : reactionIds.has(event.eventId))
      );
      if (events.length === 0) {
        return;
      }
      const names = getDistinctActorIds(events).map((id) => firstNames.get(id));
      const isPlural = names.length > 1;

      let label: string;
      let replyId: string | null;
      let excerpt: string | null = null;
      if (isReply) {
        label = `${formatActorNames(names)} ${
          discussion.authorId === recipientId
            ? isPlural
              ? 'vous ont répondu'
              : 'vous a répondu'
            : isPlural
              ? 'ont répondu dans une discussion où vous avez participé'
              : 'a répondu dans une discussion où vous avez participé'
        }`;
        // The first unseen reply, otherwise the latest one
        replyId = (
          events.find(({ seenAt }) => !seenAt) ?? events[events.length - 1]
        ).eventId;
        excerpt = toExcerpt(
          replies.get(events[events.length - 1].eventId).content
        );
      } else {
        if (
          row.subjectType === NotificationSubjectTypes.POST_REPLY &&
          !replies.has(row.subjectId)
        ) {
          return;
        }
        label = `${formatActorNames(names)} ${
          isPlural ? 'soutiennent votre message' : 'soutient votre message'
        }`;
        replyId =
          row.subjectType === NotificationSubjectTypes.POST_REPLY
            ? row.subjectId
            : null;
      }

      items.set(row.id, {
        id: row.id,
        type: row.type,
        label,
        excerpt,
        context: { groupName: group.name, discussionTitle: discussion.title },
        lastEventAt: row.lastEventAt,
        // On the events shown only: an unseen event left out (message
        // deleted, account deleted) never keeps the item unseen
        seen: areAllEventsSeen(events),
        destination: { slug: group.slug, discussionId, replyId },
      });
    });
    return items;
  }
}
