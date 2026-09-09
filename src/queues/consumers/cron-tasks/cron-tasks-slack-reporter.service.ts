import { Injectable } from '@nestjs/common';
import { SlackService } from 'src/external-services/slack/slack.service';
import {
  DetailsCounts,
  SettledFailure,
} from 'src/queues/consumers/cron-tasks/cron-tasks.utils';

export type SlackReportSection = {
  items: string[];
  label: string;
  previewLimit?: number;
};

export type SlackReportExtraCount = {
  label: string;
  value: number;
};

@Injectable()
export class CronTasksSlackReporterService {
  constructor(private readonly slackService: SlackService) {}

  /**
   * `sections` can carry one or more named lists shown below the stats (e.g. "Skipped" ids,
   * or a per-item breakdown of what changed). Each section is previewed independently
   * (`previewLimit`, default 30) so a long list doesn't produce an unbounded Slack message -
   * the rest is summarized as "N more".
   *
   * `extraCounts` adds further named metrics next to Total/Success/Failure (e.g. a breakdown
   * of how many items within "Success" needed no change at all).
   *
   * `skippedIds`/`skippedLabel` are a shorthand for a single-section report - this service has
   * no notion of what "skipped" means for a given job, so pass a label describing the actual
   * reason (e.g. "Not enough recommendations"); it isn't defaulted to any job-specific wording.
   */
  async sendCronTaskResultToSlack(
    succeeded: boolean,
    title: string,
    counts: DetailsCounts,
    failures: SettledFailure[],
    skippedIds?: string[],
    skippedLabel?: string,
    sections: SlackReportSection[] = [],
    extraCounts: SlackReportExtraCount[] = []
  ): Promise<void> {
    const allSections = skippedIds?.length
      ? [{ label: skippedLabel ?? 'Skipped', items: skippedIds }, ...sections]
      : sections;

    const details = this.buildDetailsFromCounts({
      isSuccess: succeeded,
      counts,
      failures,
      sections: allSections,
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
        ...extraCounts.map(({ label, value }) => ({
          title: label,
          content: `${value}`,
        })),
      ],
      details
    );
  }

  private buildDetails(params: {
    failedItemIdsPreview?: string;
    failedReasonsPreview?: string;
    isSuccess: boolean;
    statsLines: string[];
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
      failedItemIdsPreview ? `Failed IDs:\n${failedItemIdsPreview}` : undefined,
      failedReasonsPreview ? `Errors:\n${failedReasonsPreview}` : undefined,
    ]
      .filter(Boolean)
      .join('\n');
  }

  private buildDetailsFromCounts(params: {
    counts: DetailsCounts;
    failures: SettledFailure[];
    failuresPreviewLimit?: number;
    isSuccess: boolean;
    sections: SlackReportSection[];
  }): string {
    const { isSuccess, counts, failures, failuresPreviewLimit, sections } =
      params;

    const { failedItemIdsPreview, failedReasonsPreview } =
      this.buildFailuresPreview(failures, failuresPreviewLimit);

    const baseDetails = this.buildDetails({
      isSuccess,
      statsLines: [
        `Total: ${counts.total}`,
        `Success: ${counts.success}`,
        `Failure: ${counts.failure}`,
      ],
      failedItemIdsPreview,
      failedReasonsPreview,
    });

    const sectionTexts = sections
      .filter((section) => section.items.length > 0)
      .map((section) => this.buildSection(section));

    return [baseDetails, ...sectionTexts].join('\n');
  }

  private buildSection(section: SlackReportSection): string {
    const limit = section.previewLimit ?? 30;
    const preview = section.items.slice(0, limit);
    const remainder = section.items.length - preview.length;

    return [
      `⚠️ ${section.label}: ${section.items.length}`,
      preview.map((item) => `- ${item}`).join('\n'),
      remainder > 0
        ? `… et ${remainder} de plus (voir les logs pour le détail complet)`
        : undefined,
    ]
      .filter(Boolean)
      .join('\n');
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
