import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { fn, col, Transaction, UniqueConstraintError } from 'sequelize';
import { SlackService } from 'src/external-services/slack/slack.service';
import { SentSlackMessage } from 'src/external-services/slack/slack.types';
import { User } from 'src/users/models';
import { ZoneName } from 'src/utils/types/zones.types';
import { Report, ReportSlackMessage } from './models';
import {
  ReportReason,
  ReportResolution,
  ReportStatuses,
  ReportTarget,
  ReportTargetType,
} from './reports.types';
import { REPORT_RESOLUTION_SLACK_LABELS } from './reports.utils';

export const REPORT_ALREADY_PENDING = 'REPORT_ALREADY_PENDING';

/**
 * The reporter already has a report to handle on this target. A 409, so that
 * every report endpoint answers the same way without translating it.
 */
export class ReportAlreadyPendingError extends ConflictException {
  constructor() {
    super(REPORT_ALREADY_PENDING);
  }
}

export interface CreateReportInput extends ReportTarget {
  comment?: string | null;
  reason: ReportReason;
  reporterId: string;
  // Zone of the reported person (`getConversationReportZone` for a
  // conversation); « Hors zone » when null
  zone: ZoneName | null;
}

/**
 * Zone of a conversation report: the other participant of a conversation
 * between two people, otherwise the reporter.
 */
export const getConversationReportZone = (
  participants: { id: string; zone?: ZoneName | null }[],
  reporter: { id: string; zone?: ZoneName | null }
): ZoneName | null => {
  if (participants.length === 2) {
    const other = participants.find(({ id }) => id !== reporter.id);
    if (other) {
      return other.zone ?? null;
    }
  }
  return reporter.zone ?? null;
};

/**
 * Status replacing the action buttons of a handled Slack alert, e.g.
 * « ✅ Traité par Amina L. : message rétabli, le 7 oct. à 14:32 ». The date
 * is formatted by Slack, in the timezone of each reader.
 */
export const formatSlackHandledStatus = (
  resolution: ReportResolution,
  admin: Pick<User, 'firstName' | 'lastName'> | null,
  handledAt: Date
): string => {
  const by = admin
    ? ` par ${admin.firstName} ${admin.lastName?.charAt(0) ?? ''}.`
    : '';
  const unix = Math.floor(handledAt.getTime() / 1000);
  return `✅ *Traité*${by} : ${
    REPORT_RESOLUTION_SLACK_LABELS[resolution]
  }, le <!date^${unix}^{date_short} à {time}|${handledAt.toISOString()}>`;
};

/**
 * Generic storage of the reports. No route here: each domain owns its report
 * endpoint, which knows who may read (and so report) the target.
 */
@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    @InjectModel(Report)
    private reportModel: typeof Report,
    @InjectModel(ReportSlackMessage)
    private reportSlackMessageModel: typeof ReportSlackMessage,
    @InjectModel(User)
    private userModel: typeof User,
    private slackService: SlackService
  ) {}

  /**
   * Keeps a Slack moderation alert about a target, so that its action
   * buttons are replaced by a « Traité » status once its reports are
   * handled. Nothing is kept when Slack did not say where it landed.
   */
  async recordSlackAlert(
    target: ReportTarget,
    message: SentSlackMessage | null
  ): Promise<void> {
    if (!message) {
      return;
    }
    await this.reportSlackMessageModel.create({
      targetType: target.targetType,
      targetId: target.targetId,
      channel: message.channel,
      ts: message.ts,
      blocks: message.blocks,
    });
  }

  /**
   * Throws `ReportAlreadyPendingError` (409) when the reporter already has a
   * report to handle on this target. Once it is resolved, they may report
   * again. The motive is validated by the DTO of each endpoint.
   */
  async create(
    input: CreateReportInput,
    transaction?: Transaction
  ): Promise<Report> {
    try {
      return await this.reportModel.create(
        {
          targetType: input.targetType,
          targetId: input.targetId,
          reporterId: input.reporterId,
          reason: input.reason,
          comment: input.comment || null,
          // A person without zone is followed by the « Hors zone » team
          zone: input.zone || ZoneName.HZ,
        },
        { transaction }
      );
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        throw new ReportAlreadyPendingError();
      }
      throw error;
    }
  }

  /**
   * Distinct reporters of the reports still to handle on a target: resolved
   * reports never count, so a restored message starts again from zero.
   */
  async countPendingDistinctReporters(
    target: ReportTarget,
    transaction?: Transaction
  ): Promise<number> {
    const result = (await this.reportModel.findOne({
      attributes: [[fn('COUNT', fn('DISTINCT', col('reporterId'))), 'count']],
      where: { ...target, status: ReportStatuses.PENDING },
      raw: true,
      transaction,
    })) as unknown as { count: string } | null;
    return parseInt(result?.count ?? '0', 10);
  }

  /**
   * Distinct motives of the reports still to handle, per target id, in the
   * order of the first report of each motive.
   */
  async findPendingReasons(
    targetType: ReportTargetType,
    targetIds: string[]
  ): Promise<Record<string, ReportReason[]>> {
    if (targetIds.length === 0) {
      return {};
    }
    const reports = await this.reportModel.findAll({
      attributes: ['targetId', 'reason'],
      where: {
        targetType,
        targetId: targetIds,
        status: ReportStatuses.PENDING,
      },
      order: [
        ['createdAt', 'ASC'],
        ['id', 'ASC'],
      ],
    });
    return reports.reduce<Record<string, ReportReason[]>>((acc, report) => {
      const reasons = acc[report.targetId] ?? [];
      if (!reasons.includes(report.reason)) {
        reasons.push(report.reason);
      }
      acc[report.targetId] = reasons;
      return acc;
    }, {});
  }

  /**
   * Closes every report still to handle on a target, after a decision of an
   * admin (message restored or deleted, conversation or profile handled from
   * the reports tab). Returns the number of reports closed.
   */
  async resolvePending(
    // Several targets of the same type at once, e.g. the replies of a
    // deleted discussion
    target: Omit<ReportTarget, 'targetId'> & { targetId: string | string[] },
    resolution: ReportResolution,
    resolvedById: string,
    transaction?: Transaction,
    resolutionNote?: string | null
  ): Promise<number> {
    const [count] = await this.reportModel.update(
      {
        status: ReportStatuses.RESOLVED,
        resolution,
        resolvedById,
        resolvedAt: new Date(),
        resolutionNote: resolutionNote || null,
      },
      { where: { ...target, status: ReportStatuses.PENDING }, transaction }
    );
    // Slack is only told once the decision is committed, and never makes it
    // fail
    const markAlerts = (): void => {
      void this.markSlackAlertsHandled(target, resolution, resolvedById);
    };
    if (transaction) {
      transaction.afterCommit(markAlerts);
    } else {
      markAlerts();
    }
    return count;
  }

  /**
   * Replaces the action buttons of the Slack alerts of the target, not yet
   * handled, by a « Traité » status naming the admin and the decision.
   */
  async markSlackAlertsHandled(
    target: Omit<ReportTarget, 'targetId'> & { targetId: string | string[] },
    resolution: ReportResolution,
    resolvedById: string
  ): Promise<void> {
    try {
      const alerts = await this.reportSlackMessageModel.findAll({
        where: { ...target, handledAt: null },
      });
      if (alerts.length === 0) {
        return;
      }
      const admin = await this.userModel.findByPk(resolvedById, {
        attributes: ['firstName', 'lastName'],
        paranoid: false,
      });
      const status = formatSlackHandledStatus(resolution, admin, new Date());
      for (const alert of alerts) {
        try {
          await this.slackService.markModerationAlertHandled(
            { channel: alert.channel, ts: alert.ts, blocks: alert.blocks },
            status
          );
          await alert.update({ handledAt: new Date() });
        } catch (error) {
          this.logger.error(
            `Slack alert ${alert.ts} of the ${alert.targetType} ${alert.targetId} not marked as handled: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `Slack alerts not marked as handled: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}
