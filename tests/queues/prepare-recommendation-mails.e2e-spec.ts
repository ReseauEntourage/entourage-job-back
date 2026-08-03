import { CronTasksProcessor } from 'src/queues/consumers/cron-tasks/cron-tasks.processor';

// CronTasksProcessor only lives in the worker app (ConsumersModule, wired to
// a real Redis-backed BullMQ queue), which the API test harness
// (CustomTestingModule) deliberately doesn't boot — see tests/custom-testing.module.ts.
// This exercises the processor directly with mocked collaborators instead of
// going through Nest's DI/module system.
describe('CronTasksProcessor.prepareRecommendationMails', () => {
  const buildProcessor = (users: { id: string }[]) => {
    const usersService = {
      getUsersInactiveForRecommendationMails: jest
        .fn()
        .mockResolvedValue(users),
      findOneWithRelations: jest
        .fn()
        .mockImplementation((id: string) => Promise.resolve({ id })),
      sendRecommendationsMail: jest.fn().mockResolvedValue(undefined),
    };
    const userProfilesService = {
      findOneByUserId: jest
        .fn()
        .mockImplementation((id: string) => Promise.resolve({ userId: id })),
    };
    const userProfileRecommendationsService = {
      retrieveOrComputeRecommendationsForUserIdIA: jest
        .fn()
        .mockResolvedValue([{}, {}, {}]),
    };
    const cronTasksSlackReporterService = {
      sendCronTaskResultToSlack: jest.fn().mockResolvedValue(undefined),
    };

    const processor = new CronTasksProcessor(
      usersService as never,
      userProfilesService as never,
      userProfileRecommendationsService as never,
      {} as never, // usersDeletionService, unused by this method
      cronTasksSlackReporterService as never,
      {} as never, // messagingService, unused by this method
      {} as never, // gamificationService, unused by this method
      {} as never // recruitementAlertsService, unused by this method
    );

    return {
      processor,
      usersService,
      userProfileRecommendationsService,
    };
  };

  it('fetches eligible users in a single pass, not once per legacy tier', async () => {
    const { processor, usersService } = buildProcessor([]);

    await processor.prepareRecommendationMails();

    expect(
      usersService.getUsersInactiveForRecommendationMails
    ).toHaveBeenCalledTimes(1);
    expect(
      usersService.getUsersInactiveForRecommendationMails
    ).toHaveBeenCalledWith();
  });

  it('sends a recommendation mail to each user returned by the eligibility query', async () => {
    const users = [{ id: 'user-1' }, { id: 'user-2' }];
    const { processor, usersService } = buildProcessor(users);

    const result = await processor.prepareRecommendationMails();

    expect(usersService.sendRecommendationsMail).toHaveBeenCalledTimes(2);
    expect(result).toContain('2 success');
  });
});
