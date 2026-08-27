import { CronTasksProcessor } from 'src/queues/consumers/cron-tasks/cron-tasks.processor';

// CronTasksProcessor only lives in the worker app (ConsumersModule, wired to
// a real Redis-backed BullMQ queue), which the API test harness
// (CustomTestingModule) deliberately doesn't boot — see tests/custom-testing.module.ts.
// This exercises the processor directly with mocked collaborators instead of
// going through Nest's DI/module system.
describe('CronTasksProcessor.deactivateStaleConversations', () => {
  const buildProcessor = ({
    deactivatedConversationIds,
    error,
  }: {
    deactivatedConversationIds?: string[];
    error?: Error;
  }) => {
    const conversationPipelineService = {
      deactivateStaleConversations: error
        ? jest.fn().mockRejectedValue(error)
        : jest.fn().mockResolvedValue(deactivatedConversationIds),
    };
    const cronTasksSlackReporterService = {
      sendCronTaskResultToSlack: jest.fn().mockResolvedValue(undefined),
    };

    const processor = new CronTasksProcessor(
      {} as never, // usersService, unused by this method
      {} as never, // userProfilesService, unused by this method
      {} as never, // userProfileRecommendationsService, unused by this method
      {} as never, // usersDeletionService, unused by this method
      cronTasksSlackReporterService as never,
      {} as never, // messagingService, unused by this method
      {} as never, // gamificationService, unused by this method
      {} as never, // recruitementAlertsService, unused by this method
      conversationPipelineService as never
    );

    return {
      processor,
      conversationPipelineService,
      cronTasksSlackReporterService,
    };
  };

  it('deactivates the stale conversations found by the pipeline service and reports success to Slack', async () => {
    const {
      processor,
      conversationPipelineService,
      cronTasksSlackReporterService,
    } = buildProcessor({
      deactivatedConversationIds: ['conversation-1', 'conversation-2'],
    });

    const result = await processor.deactivateStaleConversations();

    expect(
      conversationPipelineService.deactivateStaleConversations
    ).toHaveBeenCalled();
    expect(result).toContain('2');
    expect(
      cronTasksSlackReporterService.sendCronTaskResultToSlack
    ).toHaveBeenCalledWith(
      true,
      expect.stringContaining('Deactivate stale conversations'),
      { total: 2, success: 2, failure: 0 },
      []
    );
  });

  it('handles the case where no conversation is stale and still reports success to Slack', async () => {
    const { processor, cronTasksSlackReporterService } = buildProcessor({
      deactivatedConversationIds: [],
    });

    const result = await processor.deactivateStaleConversations();

    expect(result).toContain('0');
    expect(
      cronTasksSlackReporterService.sendCronTaskResultToSlack
    ).toHaveBeenCalledWith(
      true,
      expect.stringContaining('Deactivate stale conversations'),
      { total: 0, success: 0, failure: 0 },
      []
    );
  });

  it('reports failure to Slack and rethrows when the pipeline service fails', async () => {
    const error = new Error('DB unavailable');
    const { processor, cronTasksSlackReporterService } = buildProcessor({
      error,
    });

    await expect(processor.deactivateStaleConversations()).rejects.toThrow(
      error
    );
    expect(
      cronTasksSlackReporterService.sendCronTaskResultToSlack
    ).toHaveBeenCalledWith(
      false,
      expect.stringContaining('Deactivate stale conversations'),
      { total: 0, success: 0, failure: 1 },
      [{ itemId: 'deactivateStaleConversations', reason: error }]
    );
  });
});
