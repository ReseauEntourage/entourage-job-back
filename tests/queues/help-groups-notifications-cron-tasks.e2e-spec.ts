import { buildCronTasksProcessor } from 'tests/queues/build-cron-tasks-processor.helper';

describe('CronTasksProcessor - help groups notifications', () => {
  it('Should send the weekly digests and report the result to Slack', async () => {
    const helpGroupsDigestService = {
      sendWeeklyDigests: jest
        .fn()
        .mockResolvedValue({ sent: 2, skipped: 3, failed: 0 }),
    };
    const cronTasksSlackReporterService = {
      sendCronTaskResultToSlack: jest.fn().mockResolvedValue(undefined),
    };
    const processor = buildCronTasksProcessor({
      helpGroupsDigestService: helpGroupsDigestService as never,
      cronTasksSlackReporterService: cronTasksSlackReporterService as never,
    });

    const result = await processor.sendHelpGroupsWeeklyDigest();

    expect(result).toContain('2 sent');
    expect(
      cronTasksSlackReporterService.sendCronTaskResultToSlack
    ).toHaveBeenCalledWith(
      true,
      expect.stringContaining('weekly digest'),
      { total: 5, success: 5, failure: 0 },
      []
    );
  });

  it('Should purge the expired notifications', async () => {
    const notificationsService = {
      purgeExpired: jest.fn().mockResolvedValue(4),
    };
    const processor = buildCronTasksProcessor({
      notificationsService: notificationsService as never,
    });
    expect(await processor.purgeExpiredNotifications()).toContain('4');
  });
});
