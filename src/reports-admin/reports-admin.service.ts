import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, QueryTypes } from 'sequelize';
import { HelpGroup } from 'src/help-groups/models';
import { MessagingService } from 'src/messaging/messaging.service';
import { MessageCursor } from 'src/messaging/messaging.utils';
import { Conversation } from 'src/messaging/models';
import { Post, PostContext, PostReply } from 'src/posts/models';
import { Report } from 'src/reports/models';
import { ReportsService } from 'src/reports/reports.service';
import {
  ReportReason,
  ReportResolutions,
  ReportTarget,
  ReportTargetType,
  ReportTargetTypes,
} from 'src/reports/reports.types';
import { User } from 'src/users/models';
import { UserRole } from 'src/users/users.types';
import { ZoneName } from 'src/utils/types/zones.types';
import { ResolveReportTargetDto, ReportTargetsQueryDto } from './dto';
import {
  GroupMessageState,
  GroupMessageStates,
  isGroupMessageTarget,
  REPORT_TARGETS_PAGE_SIZE,
  ReportTargetStatus,
  ReportTargetStatuses,
  ReportTargetTypesByFilter,
} from './reports-admin.types';

const LABEL_EXCERPT_MAX_LENGTH = 80;
const DELETED_USER_LABEL = 'Utilisateur supprimé';
const MISSING_TARGET_LABEL = 'Contenu introuvable';
const DELETED_GROUP_LABEL = 'Groupe supprimé';

const reportUserAttributes = [
  'id',
  'firstName',
  'lastName',
  'email',
  'role',
  'zone',
  'deletedAt',
];

/**
 * A person shown in the reports tab. Null for a deleted account: it is
 * shown "Utilisateur supprimé", without identity, link nor shortcut.
 */
export type ReportUser = {
  firstName: string;
  id: string;
  lastName: string;
  role: UserRole;
  zone: ZoneName | null;
} | null;

export interface ReportTargetItem {
  label: string;
  lastReportedAt: Date;
  pendingCount: number;
  reasons: ReportReason[];
  reportsCount: number;
  status: ReportTargetStatus;
  targetId: string;
  targetType: ReportTargetType;
  zones: ZoneName[];
}

export type ReportTargetContext =
  | {
      targetType: typeof ReportTargetTypes.CONVERSATION;
      participants: ReportUser[];
    }
  | {
      targetType: typeof ReportTargetTypes.USER_PROFILE;
      user: ReportUser;
    }
  | {
      targetType:
        typeof ReportTargetTypes.POST | typeof ReportTargetTypes.POST_REPLY;
      group: { id: string; name: string; slug: string } | null;
      message: {
        author: ReportUser;
        content: string;
        createdAt: Date;
        discussionId: string;
        discussionTitle: string;
        isEdited: boolean;
        replyId: string | null;
        state: GroupMessageState;
        title: string | null;
      } | null;
    };

interface TargetRow {
  isPending: boolean;
  lastReportedAt: Date;
  pendingCount: number;
  reasons: ReportReason[];
  reportsCount: number;
  targetId: string;
  targetType: ReportTargetType;
  zones: ZoneName[] | null;
}

interface TargetsCursor {
  d: string;
  i: string;
  // 1 while the target still has a report to handle
  p: 0 | 1;
  t: ReportTargetType;
}

const encodeTargetsCursor = (row: TargetRow) =>
  Buffer.from(
    JSON.stringify({
      p: row.isPending ? 1 : 0,
      d: new Date(row.lastReportedAt).toISOString(),
      t: row.targetType,
      i: row.targetId,
    } satisfies TargetsCursor)
  ).toString('base64url');

const decodeTargetsCursor = (raw: string): TargetsCursor => {
  try {
    const cursor = JSON.parse(
      Buffer.from(raw, 'base64url').toString('utf-8')
    ) as TargetsCursor;
    if (
      (cursor.p !== 0 && cursor.p !== 1) ||
      Number.isNaN(new Date(cursor.d).getTime()) ||
      !Object.values(ReportTargetTypes).includes(cursor.t) ||
      typeof cursor.i !== 'string'
    ) {
      throw new Error('Invalid cursor');
    }
    return cursor;
  } catch {
    throw new BadRequestException('Cursor de pagination invalide.');
  }
};

const toExcerpt = (text: string) =>
  text.length > LABEL_EXCERPT_MAX_LENGTH
    ? `${text.slice(0, LABEL_EXCERPT_MAX_LENGTH).trimEnd()}…`
    : text;

const toReportUser = (user?: User | null): ReportUser =>
  user && !user.deletedAt
    ? {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        zone: user.zone ?? null,
      }
    : null;

const reportUserLabel = (user: ReportUser) =>
  user ? `${user.firstName} ${user.lastName}` : DELETED_USER_LABEL;

const joinNames = (names: string[]) =>
  names.length > 1
    ? `${names.slice(0, -1).join(', ')} et ${names[names.length - 1]}`
    : names.join('');

const conversationLabel = (participants: ReportUser[]) =>
  participants.length
    ? `Conversation entre ${joinNames(participants.map(reportUserLabel))}`
    : MISSING_TARGET_LABEL;

const groupMessageLabel = (
  groupName: string | undefined,
  title: string | null,
  content: string
) =>
  `${groupName ?? DELETED_GROUP_LABEL} — ${toExcerpt(
    [title, content].filter(Boolean).join(' — ')
  )}`;

/**
 * Label of a target from its context, so that the page of a target loads
 * its rows once.
 */
const labelFromContext = (context: ReportTargetContext): string => {
  switch (context.targetType) {
    case ReportTargetTypes.CONVERSATION:
      return conversationLabel(context.participants);
    case ReportTargetTypes.USER_PROFILE:
      return reportUserLabel(context.user);
    default:
      return context.message
        ? groupMessageLabel(
            context.group?.name,
            context.message.title,
            context.message.content
          )
        : MISSING_TARGET_LABEL;
  }
};

/**
 * Administration of the reports, grouped by target: a profile reported five
 * times is a single case to handle. Reserved to Entourage admins (checked by
 * the controller), who all see every report whatever their zone.
 */
@Injectable()
export class ReportsAdminService {
  constructor(
    @InjectModel(Report)
    private reportModel: typeof Report,
    @InjectModel(Conversation)
    private conversationModel: typeof Conversation,
    @InjectModel(User)
    private userModel: typeof User,
    @InjectModel(Post)
    private postModel: typeof Post,
    @InjectModel(PostReply)
    private postReplyModel: typeof PostReply,
    @InjectModel(PostContext)
    private postContextModel: typeof PostContext,
    @InjectModel(HelpGroup)
    private helpGroupModel: typeof HelpGroup,
    private reportsService: ReportsService,
    private messagingService: MessagingService
  ) {}

  // ---------------------------------------------------------------------
  // List and badge
  // ---------------------------------------------------------------------

  /**
   * One row per target, filtered on type, status and zone (membership rule
   * in `targetsCte`). Targets with a report to handle first, then the most
   * recently reported first.
   */
  async findTargets(
    query: ReportTargetsQueryDto
  ): Promise<{ items: ReportTargetItem[]; nextCursor: string | null }> {
    const cursor = query.cursor ? decodeTargetsCursor(query.cursor) : null;
    const replacements: Record<string, unknown> = {
      limit: REPORT_TARGETS_PAGE_SIZE + 1,
    };
    const where: string[] = [];
    if (query.status) {
      where.push(
        query.status === ReportTargetStatuses.PENDING
          ? '"isPending"'
          : 'NOT "isPending"'
      );
    }
    if (cursor) {
      // Same order as the ORDER BY, every key descending
      where.push(
        '("isPending"::int, "lastReportedAt", "targetType", "targetId") < (:cursorPending, :cursorDate, :cursorType, :cursorId)'
      );
      Object.assign(replacements, {
        cursorPending: cursor.p,
        cursorDate: cursor.d,
        cursorType: cursor.t,
        cursorId: cursor.i,
      });
    }
    const rows = await this.reportModel.sequelize.query<TargetRow>(
      `${this.targetsCte(
        {
          type: query.type,
          zone: query.zone,
          pendingOnly: query.status === ReportTargetStatuses.PENDING,
        },
        replacements
      )}
       SELECT * FROM targets
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY "isPending" DESC, "lastReportedAt" DESC, "targetType" DESC, "targetId" DESC
       LIMIT :limit`,
      { replacements, type: QueryTypes.SELECT }
    );
    const page = rows.slice(0, REPORT_TARGETS_PAGE_SIZE);
    const labels = await this.resolveLabels(page);
    return {
      items: page.map((row) => ({
        targetType: row.targetType,
        targetId: row.targetId,
        label: labels.get(this.key(row)) ?? MISSING_TARGET_LABEL,
        zones: row.zones ?? [],
        pendingCount: Number(row.pendingCount),
        reportsCount: Number(row.reportsCount),
        reasons: row.reasons,
        lastReportedAt: row.lastReportedAt,
        status: row.isPending
          ? ReportTargetStatuses.PENDING
          : ReportTargetStatuses.RESOLVED,
      })),
      nextCursor:
        rows.length > REPORT_TARGETS_PAGE_SIZE
          ? encodeTargetsCursor(page[page.length - 1])
          : null,
    };
  }

  /**
   * Number of distinct targets with a report to handle in the zone (the
   * zone of one of those reports), as the list. Every zone without one.
   */
  async countPendingTargets(zone?: ZoneName): Promise<{ count: number }> {
    const replacements: Record<string, unknown> = {};
    const [result] = await this.reportModel.sequelize.query<{
      count: string;
    }>(
      `${this.targetsCte({ zone, pendingOnly: true }, replacements)}
       SELECT COUNT(*) AS count FROM targets`,
      { replacements, type: QueryTypes.SELECT }
    );
    return { count: parseInt(result?.count ?? '0', 10) };
  }

  /**
   * Targets grouped from their reports, filtered on type and zone.
   *
   * Zone membership: a target with reports to handle belongs to the zones of
   * those reports only, so that a closed report never keeps it in the list
   * nor the badge of another zone; a handled target belongs to the zones of
   * all its reports. `pendingOnly` keeps the targets to handle from the
   * start, through the (status, zone, createdAt) index, before grouping.
   * The dates are truncated to the millisecond so that the cursor, built
   * from a JS date, compares exactly.
   */
  private targetsCte(
    {
      type,
      zone,
      pendingOnly = false,
    }: Pick<ReportTargetsQueryDto, 'type' | 'zone'> & { pendingOnly?: boolean },
    replacements: Record<string, unknown>
  ) {
    const where: string[] = [];
    if (type) {
      where.push('"targetType" IN (:targetTypes)');
      replacements.targetTypes = ReportTargetTypesByFilter[type];
    }
    if (zone) {
      replacements.zone = zone;
    }
    if (pendingOnly) {
      where.push(
        `("targetType", "targetId") IN (
          SELECT "targetType", "targetId" FROM "Reports"
          WHERE "status" = 'PENDING'${zone ? ' AND "zone" = :zone' : ''}
        )`
      );
    }
    const having =
      zone && !pendingOnly
        ? `HAVING CASE WHEN bool_or("status" = 'PENDING')
             THEN bool_or("status" = 'PENDING' AND "zone" = :zone)
             ELSE bool_or("zone" = :zone) END`
        : '';
    return `WITH targets AS (
      SELECT "targetType", "targetId",
        COUNT(*) FILTER (WHERE "status" = 'PENDING') AS "pendingCount",
        COUNT(*) AS "reportsCount",
        COUNT(*) FILTER (WHERE "status" = 'PENDING') > 0 AS "isPending",
        array_agg(DISTINCT "reason") AS "reasons",
        date_trunc('milliseconds', MAX("createdAt")) AS "lastReportedAt",
        CASE WHEN bool_or("status" = 'PENDING')
          THEN array_remove(array_agg(DISTINCT "zone") FILTER (WHERE "status" = 'PENDING'), NULL)
          ELSE array_remove(array_agg(DISTINCT "zone"), NULL)
        END AS "zones"
      FROM "Reports"
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      GROUP BY "targetType", "targetId"
      ${having}
    )`;
  }

  private key({ targetType, targetId }: ReportTarget) {
    return `${targetType}:${targetId}`;
  }

  private idsOf(rows: ReportTarget[], ...types: ReportTargetType[]) {
    return rows
      .filter(({ targetType }) => types.includes(targetType))
      .map(({ targetId }) => targetId);
  }

  /**
   * Labels of a page of targets, resolved per type in a few queries:
   * "Conversation entre A et B", the name of a person, or the group of a
   * message with an excerpt.
   */
  private async resolveLabels(rows: ReportTarget[]) {
    const labels = new Map<string, string>();
    const set = (target: ReportTarget, label: string) =>
      labels.set(this.key(target), label);

    // The three kinds of target are independent
    await Promise.all([
      this.labelConversations(
        this.idsOf(rows, ReportTargetTypes.CONVERSATION),
        set
      ),
      this.labelUsers(this.idsOf(rows, ReportTargetTypes.USER_PROFILE), set),
      this.labelGroupMessages(
        this.idsOf(rows, ReportTargetTypes.POST),
        this.idsOf(rows, ReportTargetTypes.POST_REPLY),
        set
      ),
    ]);
    return labels;
  }

  private async labelConversations(
    ids: string[],
    set: (target: ReportTarget, label: string) => void
  ) {
    if (!ids.length) {
      return;
    }
    const conversations = await this.conversationModel.findAll({
      attributes: ['id'],
      where: { id: ids },
      include: [
        {
          model: User,
          as: 'participants',
          attributes: reportUserAttributes,
          paranoid: false,
          through: { attributes: [] },
        },
      ],
    });
    conversations.forEach((conversation) =>
      set(
        {
          targetType: ReportTargetTypes.CONVERSATION,
          targetId: conversation.id,
        },
        conversationLabel(conversation.participants.map(toReportUser))
      )
    );
  }

  private async labelUsers(
    ids: string[],
    set: (target: ReportTarget, label: string) => void
  ) {
    if (!ids.length) {
      return;
    }
    const users = await this.userModel.findAll({
      attributes: reportUserAttributes,
      where: { id: ids },
      paranoid: false,
    });
    users.forEach((user) =>
      set(
        { targetType: ReportTargetTypes.USER_PROFILE, targetId: user.id },
        reportUserLabel(toReportUser(user))
      )
    );
  }

  private async labelGroupMessages(
    postIds: string[],
    replyIds: string[],
    set: (target: ReportTarget, label: string) => void
  ) {
    if (!postIds.length && !replyIds.length) {
      return;
    }
    const replies = await this.findReplies(replyIds);
    const posts = await this.findPosts([
      ...postIds,
      ...replies.map(({ postId }) => postId),
    ]);
    const groups = await this.findGroupsByPostId(posts.map(({ id }) => id));
    postIds.forEach((postId) => {
      const post = posts.find(({ id }) => id === postId);
      if (post) {
        set(
          { targetType: ReportTargetTypes.POST, targetId: postId },
          groupMessageLabel(groups.get(post.id)?.name, post.title, post.content)
        );
      }
    });
    replies.forEach((reply) =>
      set(
        { targetType: ReportTargetTypes.POST_REPLY, targetId: reply.id },
        groupMessageLabel(groups.get(reply.postId)?.name, null, reply.content)
      )
    );
  }

  // Deleted messages included: their reports stay readable
  private findPosts(ids: string[]) {
    if (!ids.length) {
      return Promise.resolve([] as Post[]);
    }
    return this.postModel.findAll({
      attributes: [
        'id',
        'authorId',
        'title',
        'content',
        'hiddenAt',
        'editedAt',
        'createdAt',
        'deletedAt',
      ],
      where: { id: ids },
      paranoid: false,
    });
  }

  private findReplies(ids: string[]) {
    if (!ids.length) {
      return Promise.resolve([] as PostReply[]);
    }
    return this.postReplyModel.findAll({
      attributes: [
        'id',
        'postId',
        'authorId',
        'content',
        'hiddenAt',
        'editedAt',
        'createdAt',
        'deletedAt',
      ],
      where: { id: ids },
      paranoid: false,
    });
  }

  // The group of a post is found through its contexts
  private async findGroupsByPostId(postIds: string[]) {
    const groups = new Map<string, HelpGroup>();
    if (!postIds.length) {
      return groups;
    }
    const contexts = await this.postContextModel.findAll({
      attributes: ['postId', 'helpGroupId'],
      where: { postId: postIds, helpGroupId: { [Op.ne]: null } },
    });
    const helpGroups = contexts.length
      ? await this.helpGroupModel.findAll({
          attributes: ['id', 'name', 'slug'],
          where: { id: contexts.map(({ helpGroupId }) => helpGroupId) },
          paranoid: false,
        })
      : [];
    contexts.forEach(({ postId, helpGroupId }) => {
      const group = helpGroups.find(({ id }) => id === helpGroupId);
      if (group) {
        groups.set(postId, group);
      }
    });
    return groups;
  }

  // ---------------------------------------------------------------------
  // Page of a target
  // ---------------------------------------------------------------------

  /**
   * Every report of a target, the most recent first, and its context. 404
   * when the target was never reported, whatever its type: this route never
   * gives access to the context of a target nobody reported.
   */
  async findTarget(target: ReportTarget) {
    const reports = await this.reportModel.findAll({
      where: { targetType: target.targetType, targetId: target.targetId },
      include: [
        {
          model: User,
          as: 'reporter',
          attributes: reportUserAttributes,
          paranoid: false,
        },
        {
          model: User,
          as: 'resolvedBy',
          attributes: reportUserAttributes,
          paranoid: false,
        },
      ],
      order: [
        ['createdAt', 'DESC'],
        ['id', 'DESC'],
      ],
    });
    if (!reports.length) {
      throw new NotFoundException();
    }
    // The label is derived from the context, loaded once
    const context = await this.resolveContext(target);
    const isPending = reports.some(({ status }) => status === 'PENDING');
    return {
      targetType: target.targetType,
      targetId: target.targetId,
      label: labelFromContext(context),
      status: isPending
        ? ReportTargetStatuses.PENDING
        : ReportTargetStatuses.RESOLVED,
      canResolve: !isGroupMessageTarget(target.targetType),
      reports: reports.map((report) => ({
        id: report.id,
        reporter: toReportUser(report.reporter),
        reason: report.reason,
        comment: report.comment,
        zone: report.zone,
        status: report.status,
        createdAt: report.createdAt,
        resolution: report.resolution,
        resolvedAt: report.resolvedAt,
        resolvedBy: report.resolvedById
          ? toReportUser(report.resolvedBy)
          : null,
        resolutionNote: report.resolutionNote,
      })),
      context,
    };
  }

  private async resolveContext(
    target: ReportTarget
  ): Promise<ReportTargetContext> {
    switch (target.targetType) {
      case ReportTargetTypes.CONVERSATION: {
        const conversation = await this.conversationModel.findByPk(
          target.targetId,
          {
            attributes: ['id'],
            include: [
              {
                model: User,
                as: 'participants',
                attributes: reportUserAttributes,
                paranoid: false,
                through: { attributes: [] },
              },
            ],
          }
        );
        return {
          targetType: ReportTargetTypes.CONVERSATION,
          participants: (conversation?.participants ?? []).map(toReportUser),
        };
      }
      case ReportTargetTypes.USER_PROFILE: {
        const user = await this.userModel.findByPk(target.targetId, {
          attributes: reportUserAttributes,
          paranoid: false,
        });
        return {
          targetType: ReportTargetTypes.USER_PROFILE,
          user: toReportUser(user),
        };
      }
      default:
        return this.resolveGroupMessageContext(target);
    }
  }

  private async resolveGroupMessageContext(
    target: ReportTarget
  ): Promise<ReportTargetContext> {
    const targetType = target.targetType as
      typeof ReportTargetTypes.POST | typeof ReportTargetTypes.POST_REPLY;
    const isReply = targetType === ReportTargetTypes.POST_REPLY;
    const [reply] = isReply ? await this.findReplies([target.targetId]) : [];
    const [post] = await this.findPosts(
      [isReply ? reply?.postId : target.targetId].filter(Boolean)
    );
    const message = isReply ? reply : post;
    if (!message || !post) {
      return { targetType, group: null, message: null };
    }
    const [groups, author] = await Promise.all([
      this.findGroupsByPostId([post.id]),
      this.userModel.findByPk(message.authorId, {
        attributes: reportUserAttributes,
        paranoid: false,
      }),
    ]);
    const group = groups.get(post.id);
    // A reply of a deleted discussion is deleted with it
    const state: GroupMessageState =
      message.deletedAt || post.deletedAt
        ? GroupMessageStates.DELETED
        : message.hiddenAt
          ? GroupMessageStates.HIDDEN
          : GroupMessageStates.VISIBLE;
    return {
      targetType,
      group: group
        ? { id: group.id, name: group.name, slug: group.slug }
        : null,
      message: {
        discussionId: post.id,
        discussionTitle: post.title,
        isEdited: !!message.editedAt,
        replyId: isReply ? message.id : null,
        title: isReply ? null : post.title,
        content: message.content,
        author: toReportUser(author),
        state,
        createdAt: message.createdAt,
      },
    };
  }

  /**
   * Read only messages of a reported conversation. 404 when it was never
   * reported, so that the tab never becomes a general access to the
   * conversations.
   */
  async findConversationMessages(
    conversationId: string,
    before?: MessageCursor
  ) {
    const reported = await this.reportModel.findOne({
      attributes: ['id'],
      where: {
        targetType: ReportTargetTypes.CONVERSATION,
        targetId: conversationId,
      },
    });
    if (!reported) {
      throw new NotFoundException();
    }
    const page =
      await this.messagingService.getConversationMessagesForModeration(
        conversationId,
        before
      );
    if (!page) {
      throw new NotFoundException();
    }
    return page;
  }

  // ---------------------------------------------------------------------
  // Closing
  // ---------------------------------------------------------------------

  /**
   * Closes every report still to handle on a conversation or a profile, with
   * an optional internal note. No message to the reporter nor to the
   * reported person. 400 for a help group message, handled in the group.
   */
  async resolveTarget(
    target: ReportTarget,
    adminId: string,
    dto: ResolveReportTargetDto
  ): Promise<{ resolvedCount: number }> {
    if (isGroupMessageTarget(target.targetType)) {
      throw new BadRequestException(
        'Un message de groupe se traite depuis le groupe.'
      );
    }
    const reported = await this.reportModel.findOne({
      attributes: ['id'],
      where: { targetType: target.targetType, targetId: target.targetId },
    });
    if (!reported) {
      throw new NotFoundException();
    }
    const resolvedCount = await this.reportsService.resolvePending(
      target,
      ReportResolutions.MANUAL,
      adminId,
      undefined,
      dto.note
    );
    return { resolvedCount };
  }
}
