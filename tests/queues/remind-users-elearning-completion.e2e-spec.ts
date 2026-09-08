import { buildCronTasksProcessor } from 'tests/queues/build-cron-tasks-processor.helper';

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

    const processor = buildCronTasksProcessor({
      usersService: usersService as never,
      cronTasksSlackReporterService: cronTasksSlackReporterService as never,
    });

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
