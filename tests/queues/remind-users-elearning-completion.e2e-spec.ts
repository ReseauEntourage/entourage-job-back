import { CronTasksProcessor } from 'src/queues/consumers/cron-tasks/cron-tasks.processor';

// CronTasksProcessor only lives in the worker app (ConsumersModule, wired to
// a real Redis-backed BullMQ queue), which the API test harness
// (CustomTestingModule) deliberately doesn't boot — see tests/custom-testing.module.ts.
// This exercises the processor directly with mocked collaborators instead of
// going through Nest's DI/module system.
describe('CronTasksProcessor.remindUsersElearningCompletion', () => {
  const buildProcessor = (users: { id: string }[]) => {
    const usersService = {
      getUsersEligibleForElearningCompletionReminder: jest
        .fn()
        .mockResolvedValue(users),
      sendElearningCompletionReminderMail: jest
        .fn()
        .mockResolvedValue(undefined),
    };
    const cronTasksSlackReporterService = {
      sendCronTaskResultToSlack: jest.fn().mockResolvedValue(undefined),
    };

    const processor = new CronTasksProcessor(
      usersService as never,
      {} as never, // userProfilesService, unused by this method
      {} as never, // userProfileRecommendationsService, unused by this method
      {} as never, // usersDeletionService, unused by this method
      cronTasksSlackReporterService as never,
      {} as never, // messagingService, unused by this method
      {} as never, // gamificationService, unused by this method
      {} as never // recruitementAlertsService, unused by this method
    );

    return { processor, usersService, cronTasksSlackReporterService };
  };

  it('sends a reminder mail to each eligible user', async () => {
    const users = [{ id: 'user-1' }, { id: 'user-2' }];
    const { processor, usersService } = buildProcessor(users);

    await processor.remindUsersElearningCompletion();

    expect(
      usersService.getUsersEligibleForElearningCompletionReminder
    ).toHaveBeenCalledWith(2);
    expect(
      usersService.sendElearningCompletionReminderMail
    ).toHaveBeenCalledTimes(2);
    expect(
      usersService.sendElearningCompletionReminderMail
    ).toHaveBeenCalledWith(users[0]);
    expect(
      usersService.sendElearningCompletionReminderMail
    ).toHaveBeenCalledWith(users[1]);
  });

  it('sends no mail and reports success when no user is eligible', async () => {
    const { processor, usersService, cronTasksSlackReporterService } =
      buildProcessor([]);

    await processor.remindUsersElearningCompletion();

    expect(
      usersService.sendElearningCompletionReminderMail
    ).not.toHaveBeenCalled();
    expect(
      cronTasksSlackReporterService.sendCronTaskResultToSlack
    ).toHaveBeenCalledWith(
      true,
      expect.stringContaining('Elearning completion reminder'),
      { total: 0, success: 0, failure: 0 },
      []
    );
  });
});
