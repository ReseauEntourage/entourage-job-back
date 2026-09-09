import { buildCronTasksProcessor } from 'tests/queues/build-cron-tasks-processor.helper';

describe('CronTasksProcessor.prepareRecommendationMails', () => {
  const buildProcessor = (users: { id: string }[]) => {
    const usersService = {
      getUsersEligibleForRecommendationMails: jest
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

    const processor = buildCronTasksProcessor({
      usersService: usersService as never,
      userProfilesService: userProfilesService as never,
      userProfileRecommendationsService:
        userProfileRecommendationsService as never,
      cronTasksSlackReporterService: cronTasksSlackReporterService as never,
    });

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
      usersService.getUsersEligibleForRecommendationMails
    ).toHaveBeenCalledTimes(1);
    expect(
      usersService.getUsersEligibleForRecommendationMails
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
