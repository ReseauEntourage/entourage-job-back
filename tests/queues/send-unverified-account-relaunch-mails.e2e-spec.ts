import { buildCronTasksProcessor } from 'tests/queues/build-cron-tasks-processor.helper';

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

    const processor = buildCronTasksProcessor({
      usersService: usersService as never,
      cronTasksSlackReporterService: cronTasksSlackReporterService as never,
    });

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
