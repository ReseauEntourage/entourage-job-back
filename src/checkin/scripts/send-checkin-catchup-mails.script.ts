import '../../tracer';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from 'src/app.module';
import { CheckinService } from 'src/checkin/checkin.service';
import { SlackService } from 'src/external-services/slack/slack.service';
import { CronTasksSlackReporterService } from 'src/queues/consumers/cron-tasks/cron-tasks-slack-reporter.service';
import { collectSettledResults } from 'src/queues/consumers/cron-tasks/cron-tasks.utils';

/**
 * One-shot, manually-run tool — NOT a registered cron job, not wired into
 * `src/cron/cron.service.ts` or `src/queues/queues.types.ts`. Run it exactly once, after
 * deploying the messaging-conversation-checkin feature together with its
 * messaging-conversation-pipeline backfill, to send the checkin invitation mail to
 * participants of `direct` conversations that are already eligible for a checkin at
 * deployment time but that the daily `PREPARE_CHECKIN_INVITATION_MAILS` cron will never
 * reach (their `engagementThresholdReachedAt` is already more than 30 days old). See
 * openspec/changes/add-checkin-catchup-mail for the eligibility rules and rationale.
 *
 * Usage (after `pnpm build`): node dist/checkin/scripts/send-checkin-catchup-mails.script
 */
const logger = new Logger('CheckinCatchupScript');

export async function runCheckinCatchupScript(
  checkinService: CheckinService,
  slackReporter: CronTasksSlackReporterService
): Promise<void> {
  const recipients =
    await checkinService.getCatchupEligibleCheckinParticipants();
  const items = recipients.map((recipient) => ({
    id: `${recipient.conversationId}:${recipient.userId}`,
  }));
  logger.log(
    `Found ${items.length} participants eligible for the checkin catchup`
  );

  const results = await checkinService.sendInvitationMails(recipients);

  const { succeeded, successIds, failures } = collectSettledResults(
    items,
    results,
    (recipientId, reason) => {
      logger.error(
        `Failed sending checkin catchup mail to ${recipientId}`,
        reason
      );
    }
  );

  await slackReporter.sendCronTaskResultToSlack(
    succeeded,
    '📝 Checkin catchup mails (one-shot deployment run)',
    {
      total: items.length,
      success: successIds.length,
      failure: failures.length,
    },
    failures
  );

  logger.log(
    `Checkin catchup done: ${successIds.length}/${items.length} sent, ${failures.length} failed`
  );
}

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  try {
    const checkinService = app.get(CheckinService);
    const slackReporter = new CronTasksSlackReporterService(
      app.get(SlackService)
    );
    await runCheckinCatchupScript(checkinService, slackReporter);
  } finally {
    await app.close();
  }
}

if (require.main === module) {
  bootstrap();
}
