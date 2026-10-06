import { ConflictException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { fn, col, Transaction, UniqueConstraintError } from 'sequelize';
import { ZoneName } from 'src/utils/types/zones.types';
import { Report } from './models';
import {
  ReportReason,
  ReportResolution,
  ReportStatuses,
  ReportTarget,
  ReportTargetType,
} from './reports.types';

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
  // Zone of the reported person (see `getReportedZone*` helpers)
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
 * Generic storage of the reports. No route here: each domain owns its report
 * endpoint, which knows who may read (and so report) the target.
 */
@Injectable()
export class ReportsService {
  constructor(
    @InjectModel(Report)
    private reportModel: typeof Report
  ) {}

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
          zone: input.zone ?? null,
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
    return count;
  }
}
