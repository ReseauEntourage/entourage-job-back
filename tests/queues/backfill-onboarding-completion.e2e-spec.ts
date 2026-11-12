import { buildCronTasksProcessor } from 'tests/queues/build-cron-tasks-processor.helper';

describe('CronTasksProcessor.backfillOnboardingCompletion', () => {
  const stuckUsers = [
    { id: 'user-1', role: 'Coach', category: 'evidence' },
    { id: 'user-2', role: 'Candidat', category: 'inferred' },
    { id: 'user-3', role: 'Coach', category: 'inferred' },
  ];

  const buildProcessor = (
    users = stuckUsers,
    completeOnboarding: jest.Mock = jest.fn().mockResolvedValue(true)
  ) => {
    const usersService = {
      getUsersStuckBeforeOnboardingCompletion: jest
        .fn()
        .mockResolvedValue(users),
      completeOnboarding,
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

  describe('dry run', () => {
    it('is the default and writes nothing', async () => {
      const { processor, usersService } = buildProcessor();

      const result = await processor.backfillOnboardingCompletion({});

      expect(usersService.completeOnboarding).not.toHaveBeenCalled();
      expect(result).toBe(
        'Onboarding completion backfill (dry run): 3 accounts, 1 with evidence, 2 inferred'
      );
    });

    it('is also used when the payload is missing', async () => {
      const { processor, usersService } = buildProcessor();

      await processor.backfillOnboardingCompletion(undefined);

      expect(usersService.completeOnboarding).not.toHaveBeenCalled();
    });

    it('lists the two categories apart in the report, with the ids only', async () => {
      const { processor, cronTasksSlackReporterService } = buildProcessor();

      await processor.backfillOnboardingCompletion({ dryRun: true });

      expect(
        cronTasksSlackReporterService.sendCronTaskResultToSlack
      ).toHaveBeenCalledWith(
        true,
        expect.stringContaining('dry run'),
        { total: 3, success: 3, failure: 0 },
        [],
        undefined,
        undefined,
        [
          { label: 'Preuve directe (webinaire passé)', items: ['user-1'] },
          {
            label: 'Reconstitués (étapes précédentes faites)',
            items: ['user-2', 'user-3'],
          },
        ]
      );
    });
  });

  describe('execution', () => {
    it('refuses to run without categories', async () => {
      const { processor, usersService } = buildProcessor();

      await expect(
        processor.backfillOnboardingCompletion({ dryRun: false })
      ).rejects.toThrow('needs `categories`');
      expect(usersService.completeOnboarding).not.toHaveBeenCalled();
    });

    it('completes the accounts of the chosen categories only, without the welcome message', async () => {
      const { processor, usersService } = buildProcessor();

      const result = await processor.backfillOnboardingCompletion({
        dryRun: false,
        categories: ['evidence'],
        pauseBetweenBatchesMs: 0,
      });

      expect(usersService.completeOnboarding).toHaveBeenCalledTimes(1);
      expect(usersService.completeOnboarding).toHaveBeenCalledWith('user-1', {
        skipWelcomeMessage: true,
      });
      expect(result).toBe(
        'Onboarding completion backfill: 1 completed, 0 already completed, 0 failures (1/3 accounts processed)'
      );
    });

    it('completes both categories when both are chosen', async () => {
      const { processor, usersService } = buildProcessor();

      await processor.backfillOnboardingCompletion({
        dryRun: false,
        categories: ['evidence', 'inferred'],
        pauseBetweenBatchesMs: 0,
      });

      expect(
        usersService.completeOnboarding.mock.calls.map(([id]) => id)
      ).toEqual(['user-1', 'user-2', 'user-3']);
    });

    it('stops at the limit and leaves the others for a next run', async () => {
      const { processor, usersService, cronTasksSlackReporterService } =
        buildProcessor();

      const result = await processor.backfillOnboardingCompletion({
        dryRun: false,
        categories: ['evidence', 'inferred'],
        limit: 2,
        pauseBetweenBatchesMs: 0,
      });

      expect(usersService.completeOnboarding).toHaveBeenCalledTimes(2);
      expect(result).toContain('(2/3 accounts processed)');
      expect(
        cronTasksSlackReporterService.sendCronTaskResultToSlack.mock.calls[0][7]
      ).toContainEqual({ label: 'Left for a next run', value: 1 });
    });

    it('works through the batches and pauses between them', async () => {
      jest.useFakeTimers();
      try {
        const { processor, usersService } = buildProcessor();

        const promise = processor.backfillOnboardingCompletion({
          dryRun: false,
          categories: ['evidence', 'inferred'],
          batchSize: 2,
          pauseBetweenBatchesMs: 5000,
        });
        // First batch (2 accounts), then the pause before the second one
        await jest.advanceTimersByTimeAsync(0);
        expect(usersService.completeOnboarding).toHaveBeenCalledTimes(2);

        await jest.advanceTimersByTimeAsync(5000);
        await promise;

        expect(usersService.completeOnboarding).toHaveBeenCalledTimes(3);
      } finally {
        jest.useRealTimers();
      }
    });

    it('counts an account completed in the meantime as already completed', async () => {
      const completeOnboarding = jest
        .fn()
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);
      const { processor } = buildProcessor(stuckUsers, completeOnboarding);

      const result = await processor.backfillOnboardingCompletion({
        dryRun: false,
        categories: ['evidence', 'inferred'],
        pauseBetweenBatchesMs: 0,
      });

      expect(result).toContain('2 completed, 1 already completed, 0 failures');
    });

    it('reports a failure and goes on with the other accounts', async () => {
      const completeOnboarding = jest
        .fn()
        .mockResolvedValueOnce(true)
        .mockRejectedValueOnce(new Error('queue down'))
        .mockResolvedValueOnce(true);
      const { processor, cronTasksSlackReporterService } = buildProcessor(
        stuckUsers,
        completeOnboarding
      );

      const result = await processor.backfillOnboardingCompletion({
        dryRun: false,
        categories: ['evidence', 'inferred'],
        pauseBetweenBatchesMs: 0,
      });

      expect(completeOnboarding).toHaveBeenCalledTimes(3);
      expect(result).toContain('2 completed, 0 already completed, 1 failures');
      expect(
        cronTasksSlackReporterService.sendCronTaskResultToSlack
      ).toHaveBeenCalledWith(
        false,
        expect.any(String),
        { total: 3, success: 2, failure: 1 },
        [expect.objectContaining({ itemId: 'user-2' })],
        undefined,
        undefined,
        undefined,
        expect.any(Array)
      );
    });
  });
});
