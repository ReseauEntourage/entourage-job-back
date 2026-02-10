import { Injectable } from '@nestjs/common';
import { SlackService } from 'src/external-services/slack/slack.service';
import {
  DetailsCounts,
  SettledFailure,
} from 'src/queues/consumers/cron-tasks/cron-tasks.utils';

@Injectable()
export class CronTasksSlackReporterService {
  constructor(private readonly slackService: SlackService) {}

  async sendCronTaskResultToSlack(
    succeeded: boolean,
    title: string,
    counts: DetailsCounts,
    failures: SettledFailure[]
  ): Promise<void> {
    const details = this.buildDetailsFromCounts({
      isSuccess: succeeded,
      counts,
      failures,
    });

    await this.slackService.sendTechnicalMonitoringMessage(
      succeeded,
      title,
      [
        {
          title: 'Total',
          content: `${counts.total}`,
        },
        {
          title: 'Success',
          content: `${counts.success}`,
        },
        {
          title: 'Failure',
          content: `${counts.failure}`,
        },
      ],
      details
    );
  }

  private buildDetails(params: {
    isSuccess: boolean;
    statsLines: string[];
    failedItemIdsPreview?: string;
    failedReasonsPreview?: string;
  }): string {
    const {
      isSuccess,
      statsLines,
      failedItemIdsPreview,
      failedReasonsPreview,
    } = params;

    if (isSuccess) {
      return `All operations succeeded.`;
    }

    return [
      `An error occurred during this cron task. Details below:`,
      ...statsLines,
      failedItemIdsPreview
        ? `Failed IDs:\n${failedItemIdsPreview}`
        : undefined,
      failedReasonsPreview ? `Errors:\n${failedReasonsPreview}` : undefined,
    ]
      .filter(Boolean)
      .join('\n');
  }

  private buildDetailsFromCounts(params: {
    isSuccess: boolean;
    counts: DetailsCounts;
    failures: SettledFailure[];
    failuresPreviewLimit?: number;
  }): string {
    const { isSuccess, counts, failures, failuresPreviewLimit } = params;

    const { failedItemIdsPreview, failedReasonsPreview } =
      this.buildFailuresPreview(failures, failuresPreviewLimit);

    return this.buildDetails({
      isSuccess,
      statsLines: [
        `Total: ${counts.total}`,
        `Success: ${counts.success}`,
        `Failure: ${counts.failure}`,
      ],
      failedItemIdsPreview,
      failedReasonsPreview,
    });
  }

  private buildFailuresPreview(
    failures: SettledFailure[],
    limit = 10
  ): { failedItemIdsPreview?: string; failedReasonsPreview?: string } {
    const sliced = failures.slice(0, limit);
    const failedItemIdsPreview = sliced
      .map(({ itemId }) => `- ${itemId}`)
      .join('\n');
    const failedReasonsPreview = sliced
      .map(({ itemId, reason }) => `- ${itemId}: ${String(reason)}`)
      .join('\n');

    return {
      failedItemIdsPreview: failedItemIdsPreview || undefined,
      failedReasonsPreview: failedReasonsPreview || undefined,
    };
  }
}
