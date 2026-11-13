import { Injectable, Logger } from '@nestjs/common';
import { SlackService } from 'src/external-services/slack/slack.service';
import { ReportsService } from 'src/reports/reports.service';
import {
  ReportOrigins,
  ReportReasonLabels,
  ReportReasons,
  ReportTarget,
  ReportTargetTypes,
} from 'src/reports/reports.types';
import { User } from 'src/users/models';
import {
  findForbiddenExpression,
  parseForbiddenExpressions,
} from 'src/utils/misc/forbidden-expressions';
import { HelpGroup } from './models';

const EXCERPT_MAX_LENGTH = 200;

export interface ModerationAlertMessage {
  author: User;
  content: string;
  discussionId: string;
  group: Pick<HelpGroup, 'name' | 'slug'>;
  replyId?: string;
  title?: string | null;
}

const toExcerpt = (text: string) =>
  text.length > EXCERPT_MAX_LENGTH
    ? `${text.slice(0, EXCERPT_MAX_LENGTH).trimEnd()}…`
    : text;

/**
 * Creates an AUTOMATIC report on a help group message that contains a
 * forbidden expression, when published or edited. Never blocks nor delays
 * the publication, and never tells the author nor the readers. The message
 * is never hidden by this (see `help-groups-reporting.service.ts`'s
 * threshold, which only ever counts MEMBER reports).
 */
@Injectable()
export class HelpGroupsModerationAlertService {
  private readonly logger = new Logger(HelpGroupsModerationAlertService.name);

  constructor(
    private readonly slackService: SlackService,
    private readonly reportsService: ReportsService
  ) {}

  /**
   * Fire and forget: meant to be called once the write is committed.
   */
  checkMessage(message: ModerationAlertMessage): void {
    this.reportIfForbidden(message).catch((error) => {
      this.logger.warn(
        `[HelpGroupsModerationAlert] report not created (discussionId=${
          message.discussionId
        }): ${error instanceof Error ? error.message : String(error)}`
      );
    });
  }

  private async reportIfForbidden({
    author,
    content,
    discussionId,
    group,
    replyId,
    title,
  }: ModerationAlertMessage) {
    const expressions = parseForbiddenExpressions(
      process.env.FORBIDDEN_EXPRESSIONS
    );
    const expression = findForbiddenExpression(
      [title, content].filter(Boolean).join('\n'),
      expressions
    );
    if (!expression) {
      return;
    }

    const target: ReportTarget = replyId
      ? { targetType: ReportTargetTypes.POST_REPLY, targetId: replyId }
      : { targetType: ReportTargetTypes.POST, targetId: discussionId };

    // An edited message still containing a forbidden expression must not
    // create a second report, nor a second Slack alert, while the first is
    // still to handle
    if (await this.reportsService.hasPendingAutomaticReport(target)) {
      return;
    }

    await this.reportsService.create({
      ...target,
      reporterId: null,
      origin: ReportOrigins.AUTOMATIC,
      reason: ReportReasons.OTHER,
      comment: expression,
      zone: author.zone ?? null,
    });

    const messageUrl = `${process.env.FRONT_URL}/backoffice/groupes/${
      group.slug
    }/discussions/${discussionId}${replyId ? `?replyId=${replyId}` : ''}`;

    const sent = await this.slackService.sendHelpGroupMessageReported({
      author,
      reporter: null,
      origin: ReportOrigins.AUTOMATIC,
      groupName: group.name,
      isReply: !!replyId,
      messageUrl,
      excerpt: toExcerpt([title, content].filter(Boolean).join(' — ')),
      reasonLabel: ReportReasonLabels[ReportReasons.OTHER],
      comment: expression,
      target,
    });
    await this.reportsService.recordSlackAlert(target, sent);
  }
}
