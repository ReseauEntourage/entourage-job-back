import { CronTasksProcessor } from 'src/queues/consumers/cron-tasks/cron-tasks.processor';

// CronTasksProcessor only lives in the worker app (ConsumersModule, wired to
// a real Redis-backed BullMQ queue), which the API test harness
// (CustomTestingModule) deliberately doesn't boot — see tests/custom-testing.module.ts.
// This exercises the processor directly with mocked collaborators instead of
// going through Nest's DI/module system.
describe('CronTasksProcessor.sendUnverifiedAccountRelaunchMails', () => {
  const buildProcessor = (
    users: { id: string }[],
    sendUnverifiedAccountRelaunchMail = jest.fn().mockResolvedValue(undefined)
  ) => {
    const usersService = {
      getUsersWithUnverifiedEmailOneDayAfterCreation: jest
        .fn()
        .mockResolvedValue(users),
      sendUnverifiedAccountRelaunchMail,
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
      {} as never, // recruitementAlertsService, unused by this method
      {} as never, // conversationPipelineService, unused by this method
      {} as never // checkinService, unused by this method
    );

    return { processor, usersService, cronTasksSlackReporterService };
  };

  it('sends a relaunch mail to each eligible user', async () => {
    const users = [{ id: 'user-1' }, { id: 'user-2' }];
    const { processor, usersService } = buildProcessor(users);

    await processor.sendUnverifiedAccountRelaunchMails();

    expect(
      usersService.getUsersWithUnverifiedEmailOneDayAfterCreation
    ).toHaveBeenCalled();
    expect(
      usersService.sendUnverifiedAccountRelaunchMail
    ).toHaveBeenCalledTimes(2);
    expect(usersService.sendUnverifiedAccountRelaunchMail).toHaveBeenCalledWith(
      users[0]
    );
    expect(usersService.sendUnverifiedAccountRelaunchMail).toHaveBeenCalledWith(
      users[1]
    );
  });

  it('isolates a failure for one user and still reports success for the others', async () => {
    const users = [{ id: 'user-1' }, { id: 'user-2' }];
    const sendUnverifiedAccountRelaunchMail = jest
      .fn()
      .mockImplementationOnce(() => Promise.resolve())
      .mockImplementationOnce(() => Promise.reject(new Error('mail failed')));
    const { processor, cronTasksSlackReporterService } = buildProcessor(
      users,
      sendUnverifiedAccountRelaunchMail
    );

    await expect(
      processor.sendUnverifiedAccountRelaunchMails()
    ).rejects.toThrow('Failed sending 1/2 unverified account relaunch mails');

    expect(
      cronTasksSlackReporterService.sendCronTaskResultToSlack
    ).toHaveBeenCalledWith(
      false,
      expect.stringContaining('Unverified account relaunch'),
      { total: 2, success: 1, failure: 1 },
      expect.arrayContaining([expect.objectContaining({ itemId: 'user-2' })])
    );
  });

  it('sends no mail and reports success when no user is eligible', async () => {
    const { processor, usersService, cronTasksSlackReporterService } =
      buildProcessor([]);

    await processor.sendUnverifiedAccountRelaunchMails();

    expect(
      usersService.sendUnverifiedAccountRelaunchMail
    ).not.toHaveBeenCalled();
    expect(
      cronTasksSlackReporterService.sendCronTaskResultToSlack
    ).toHaveBeenCalledWith(
      true,
      expect.stringContaining('Unverified account relaunch'),
      { total: 0, success: 0, failure: 0 },
      []
    );
  });
});
