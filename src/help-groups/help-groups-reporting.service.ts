import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, Transaction } from 'sequelize';
import { PusherEvents } from 'src/external-services/pusher/pusher.types';
import { SlackService } from 'src/external-services/slack/slack.service';
import { Post, PostContext, PostReply } from 'src/posts/models';
import { PostReader, PostsService } from 'src/posts/posts.service';
import { ReportsService } from 'src/reports/reports.service';
import {
  ReportReason,
  ReportReasonLabels,
  ReportResolutions,
  ReportTarget,
  ReportTargetTypes,
} from 'src/reports/reports.types';
import { getReportTargetAdminUrl } from 'src/reports/reports.utils';
import { UsersService } from 'src/users/users.service';
import { isEntourageAdmin } from 'src/users/users.utils';
import { ReactionTargetDto, ReportMessageDto } from './dto';
import { HelpGroupsNotificationsService } from './help-groups-notifications.service';
import { HelpGroupsRealtimeService } from './help-groups-realtime.service';
import { HelpGroupsWriteGuardService } from './help-groups-write-guard.service';
import {
  HelpGroupErrorCodes,
  parseAutoHideThreshold,
} from './help-groups.types';
import { HelpGroup } from './models';

const EXCERPT_MAX_LENGTH = 200;

/**
 * The reported message, resolved from the discussion and the request target.
 */
interface ReportedMessage {
  authorId: string;
  content: string;
  discussionId: string;
  group: HelpGroup;
  hiddenAt: Date | null;
  id: string;
  // Absent for the discussion message itself
  replyId?: string;
  target: ReportTarget;
  title: string | null;
}

const toExcerpt = (text: string) =>
  text.length > EXCERPT_MAX_LENGTH
    ? `${text.slice(0, EXCERPT_MAX_LENGTH).trimEnd()}…`
    : text;

/**
 * Reports of help group messages and their automatic hiding: any logged-in
 * user may report a message they can read, the moderation channel is
 * alerted (never by email), and the message is hidden from the readers until
 * an admin restores or deletes it.
 */
@Injectable()
export class HelpGroupsReportingService {
  private readonly logger = new Logger(HelpGroupsReportingService.name);

  constructor(
    @InjectModel(Post)
    private postModel: typeof Post,
    @InjectModel(PostReply)
    private postReplyModel: typeof PostReply,
    private writeGuard: HelpGroupsWriteGuardService,
    private postsService: PostsService,
    private reportsService: ReportsService,
    private usersService: UsersService,
    private slackService: SlackService,
    private realtime: HelpGroupsRealtimeService,
    private notifications: HelpGroupsNotificationsService
  ) {}

  getAutoHideThreshold(): number {
    return parseAutoHideThreshold(process.env.HELP_GROUPS_AUTO_HIDE_THRESHOLD);
  }

  // ---------------------------------------------------------------------
  // Report
  // ---------------------------------------------------------------------

  /**
   * Open to any logged-in user who can read the message (lot 1 visibility
   * rule), member or not, eLearning completed or not. 403 on one's own
   * message, 404 on a deleted message or one hidden for the reader, 409 when
   * a report of the same person on this message is still to handle.
   */
  async report(
    slug: string,
    discussionId: string,
    reader: PostReader,
    dto: ReportMessageDto
  ): Promise<{ id: string }> {
    const message = await this.resolveReportedMessage(
      slug,
      discussionId,
      dto.target
    );
    if (message.authorId === reader.id) {
      throw new ForbiddenException();
    }
    if (message.hiddenAt && !isEntourageAdmin(reader.role)) {
      throw new NotFoundException();
    }

    // The zone of the author is the zone of the report, deleted account
    // included. Only this column is read before the report is saved
    const author = await this.usersService.findOneWithAttributes(
      message.authorId,
      ['id', 'zone'],
      { paranoid: false }
    );

    const model = (
      message.replyId ? this.postReplyModel : this.postModel
    ) as typeof Post;
    // The report is created under the lock of the message row, which a
    // restoration also takes first: a report is either resolved by a
    // restoration committed before it, or created after it and still pending,
    // so that it can hide the message again
    const { report, isHidden } = await this.postModel.sequelize.transaction(
      async (transaction) => {
        const current = await model.findByPk(message.id, {
          attributes: ['id', 'hiddenAt'],
          lock: transaction.LOCK.UPDATE,
          transaction,
        });
        // Checked again under the lock: another report may have hidden the
        // message since it was read
        if (!current || (current.hiddenAt && !isEntourageAdmin(reader.role))) {
          throw new NotFoundException();
        }
        // For a reply, its discussion is locked too, after the reply (the lock
        // order of every reply write): a discussion deletion in progress makes
        // the report wait, then find the discussion deleted; a deletion coming
        // after waits for the report, then closes it with the others
        if (message.replyId) {
          const discussion = await this.postModel.findByPk(
            message.discussionId,
            { attributes: ['id'], lock: transaction.LOCK.SHARE, transaction }
          );
          if (!discussion) {
            throw new NotFoundException(
              HelpGroupErrorCodes.DISCUSSION_NOT_FOUND
            );
          }
        }
        const created = await this.reportsService.create(
          {
            ...message.target,
            reporterId: reader.id,
            reason: dto.reason,
            comment: dto.comment,
            zone: author?.zone ?? null,
          },
          transaction
        );
        // Never fails the report: the hiding runs in a savepoint, rolled back
        // alone on failure
        let hidden = false;
        try {
          hidden = await this.postModel.sequelize.transaction(
            { transaction },
            (savepoint) =>
              this.hideIfThresholdReached(message, current, model, savepoint)
          );
        } catch (error) {
          this.logger.error(
            `[HelpGroupsReporting] automatic hiding failed (${message.target.targetType} ${message.id}): ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
        return { report: created, isHidden: hidden };
      }
    );
    if (isHidden) {
      this.notifyChange(message.discussionId, message.replyId);
      // A hidden message is no longer notified, once the hiding is
      // committed; a restoration recreates nothing
      if (message.replyId) {
        await this.notifications.onReplyRemoved({
          discussionId: message.discussionId,
          replyId: message.replyId,
        });
      } else {
        await this.notifications.onDiscussionRemoved({
          discussionId: message.discussionId,
        });
      }
    }

    this.sendAlerts(message, reader.id, dto, isHidden).catch((error) => {
      this.logger.error(
        `[HelpGroupsReporting] Slack alert not sent (${message.target.targetType} ${message.id}): ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    });

    return { id: report.id };
  }

  private async resolveReportedMessage(
    slug: string,
    discussionId: string,
    target: ReactionTargetDto
  ): Promise<ReportedMessage> {
    const hasDiscussion = !!target?.discussionId;
    const hasReply = !!target?.replyId;
    if (hasDiscussion === hasReply) {
      throw new BadRequestException(
        'target must hold exactly one of discussionId or replyId'
      );
    }
    // Published groups only, for everyone: an unpublished group (admin
    // preview) offers no action
    const group = await this.writeGuard.findPublishedGroupBySlug(slug);
    const post = await this.postsService.findOneInHelpGroup(
      discussionId,
      group.id
    );
    if (!post) {
      throw new NotFoundException(HelpGroupErrorCodes.DISCUSSION_NOT_FOUND);
    }

    if (hasDiscussion) {
      if (target.discussionId !== post.id) {
        throw new NotFoundException();
      }
      return {
        id: post.id,
        discussionId: post.id,
        group,
        authorId: post.authorId,
        hiddenAt: post.hiddenAt,
        title: post.title,
        content: post.content,
        target: { targetType: ReportTargetTypes.POST, targetId: post.id },
      };
    }

    const reply = await this.postReplyModel.findOne({
      attributes: ['id', 'authorId', 'hiddenAt', 'content'],
      where: { id: target.replyId, postId: post.id },
    });
    if (!reply) {
      throw new NotFoundException();
    }
    return {
      id: reply.id,
      replyId: reply.id,
      discussionId: post.id,
      group,
      authorId: reply.authorId,
      hiddenAt: reply.hiddenAt,
      title: null,
      content: reply.content,
      target: { targetType: ReportTargetTypes.POST_REPLY, targetId: reply.id },
    };
  }

  // ---------------------------------------------------------------------
  // Automatic hiding
  // ---------------------------------------------------------------------

  /**
   * Hides the message once the number of distinct reporters with a pending
   * report reaches the threshold. Resolved reports never count: a restored
   * message starts again from zero. Runs in the transaction holding the lock
   * of the message row. Returns true when this call hid it.
   */
  private async hideIfThresholdReached(
    message: ReportedMessage,
    current: Pick<Post, 'hiddenAt'>,
    model: typeof Post,
    transaction: Transaction
  ): Promise<boolean> {
    const threshold = this.getAutoHideThreshold();
    if (threshold <= 0 || current.hiddenAt) {
      return false;
    }
    const reporters = await this.reportsService.countPendingDistinctReporters(
      message.target,
      transaction
    );
    if (reporters < threshold) {
      return false;
    }
    await model.update(
      { hiddenAt: new Date() },
      { where: { id: message.id }, transaction }
    );
    // The last activity of a discussion only counts its visible replies
    if (message.replyId) {
      await this.postsService.refreshLastActivityAt(
        message.discussionId,
        transaction
      );
    }
    return true;
  }

  private notifyChange(discussionId: string, replyId?: string) {
    if (replyId) {
      this.realtime.notify(PusherEvents.REPLY_UPDATED, {
        discussionId,
        replyId,
      });
    } else {
      this.realtime.notify(PusherEvents.DISCUSSION_UPDATED, { discussionId });
    }
  }

  private messageUrl({ group, discussionId, replyId }: ReportedMessage) {
    return `${process.env.FRONT_URL}/backoffice/groupes/${
      group.slug
    }/discussions/${discussionId}${replyId ? `?replyId=${replyId}` : ''}`;
  }

  /**
   * Moderation alerts, after the report is saved: the report itself and,
   * independently, the priority alert when it hid the message. A Slack
   * failure is logged by the caller and never fails the report.
   */
  private async sendAlerts(
    message: ReportedMessage,
    reporterId: string,
    dto: ReportMessageDto,
    isHidden: boolean
  ) {
    // Deleted accounts included: their zone still resolves a referent
    const users = await this.usersService.findByIdsWithRelations(
      [message.authorId, reporterId],
      { paranoid: false }
    );
    const author = users.find(({ id }) => id === message.authorId);
    const reporter = users.find(({ id }) => id === reporterId);
    const messageUrl = this.messageUrl(message);

    const isReply = !!message.replyId;
    const reportedAlert = this.slackService.sendHelpGroupMessageReported({
      author,
      reporter,
      groupName: message.group.name,
      isReply,
      messageUrl,
      excerpt: toExcerpt(
        [message.title, message.content].filter(Boolean).join(' — ')
      ),
      reasonLabel: ReportReasonLabels[dto.reason],
      comment: dto.comment || null,
      reportUrl: getReportTargetAdminUrl(
        message.target.targetType,
        message.target.targetId
      ),
    });
    // Attempted whatever happens to the report alert: a hidden message must
    // always reach the moderation as a priority
    const autoHiddenAlert = isHidden
      ? this.reportsService
          .findPendingReasons(message.target.targetType, [message.id])
          .then((reasons) =>
            this.slackService.sendHelpGroupMessageAutoHidden({
              author,
              groupName: message.group.name,
              isReply,
              messageUrl,
              reasonLabels: (reasons[message.id] ?? [dto.reason]).map(
                (reason: ReportReason) => ReportReasonLabels[reason]
              ),
            })
          )
      : Promise.resolve();

    const failure = (
      await Promise.allSettled([reportedAlert, autoHiddenAlert])
    ).find(
      (result): result is PromiseRejectedResult => result.status === 'rejected'
    );
    if (failure) {
      throw failure.reason;
    }
  }

  // ---------------------------------------------------------------------
  // Restoration by an Entourage admin
  // ---------------------------------------------------------------------

  /**
   * Makes a non deleted help group discussion visible again and closes its
   * pending reports as RESTORED.
   */
  async restoreDiscussion(discussionId: string, adminId: string) {
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
    await this.restore(
      this.postModel,
      { targetType: ReportTargetTypes.POST, targetId: post.id },
      adminId
    );
    this.notifyChange(post.id);
  }

  async restoreReply(replyId: string, adminId: string) {
    const reply = await this.postReplyModel.findOne({
      attributes: ['id', 'postId'],
      where: { id: replyId },
      include: [
        {
          model: Post,
          as: 'post',
          attributes: [],
          required: true,
          include: [
            {
              model: PostContext,
              as: 'contexts',
              attributes: [],
              where: { helpGroupId: { [Op.ne]: null } },
              required: true,
            },
          ],
        },
      ],
    });
    if (!reply) {
      throw new NotFoundException();
    }
    await this.restore(
      this.postReplyModel as unknown as typeof Post,
      { targetType: ReportTargetTypes.POST_REPLY, targetId: reply.id },
      adminId,
      reply.postId
    );
    this.notifyChange(reply.postId, reply.id);
  }

  private async restore(
    model: typeof Post,
    target: ReportTarget,
    adminId: string,
    // For a reply: its discussion, whose last activity counts it again
    discussionId?: string
  ) {
    await this.postModel.sequelize.transaction(async (transaction) => {
      await model.update(
        { hiddenAt: null },
        { where: { id: target.targetId }, transaction }
      );
      if (discussionId) {
        await this.postsService.refreshLastActivityAt(
          discussionId,
          transaction
        );
      }
      await this.reportsService.resolvePending(
        target,
        ReportResolutions.RESTORED,
        adminId,
        transaction
      );
    });
  }
}
