import { CheckinService } from 'src/checkin/checkin.service';
import { SalesforceService } from 'src/external-services/salesforce/salesforce.service';
import { SlackService } from 'src/external-services/slack/slack.service';
import { GamificationService } from 'src/gamification/gamification.service';
import { ConversationPipelineService } from 'src/messaging/conversation-pipeline.service';
import { MessagingService } from 'src/messaging/messaging.service';
import { CronTasksSlackReporterService } from 'src/queues/consumers/cron-tasks/cron-tasks-slack-reporter.service';
import { CronTasksProcessor } from 'src/queues/consumers/cron-tasks/cron-tasks.processor';
import { RecruitementAlertsService } from 'src/recruitement-alerts/recruitement-alerts.service';
import { UserProfileRecommendationsService } from 'src/user-profile-recommendations/user-profile-recommendations-ai.service';
import { UserProfilesService } from 'src/user-profiles/user-profiles.service';
import { UsersService } from 'src/users/users.service';
import { UsersDeletionService } from 'src/users-deletion/users-deletion.service';

type CronTasksProcessorDeps = {
  usersService: UsersService;
  userProfilesService: UserProfilesService;
  userProfileRecommendationsService: UserProfileRecommendationsService;
  usersDeletionService: UsersDeletionService;
  cronTasksSlackReporterService: CronTasksSlackReporterService;
  messagingService: MessagingService;
  gamificationService: GamificationService;
  recruitementAlertsService: RecruitementAlertsService;
  conversationPipelineService: ConversationPipelineService;
  checkinService: CheckinService;
  salesforceService: SalesforceService;
  slackService: SlackService;
};

/**
 * CronTasksProcessor only lives in the worker app (ConsumersModule, wired to
 * a real Redis-backed BullMQ queue), which the API test harness
 * (CustomTestingModule) deliberately doesn't boot — see tests/custom-testing.module.ts.
 * e2e specs exercise it directly with mocked collaborators instead of going
 * through Nest's DI/module system, which means its constructor is called by
 * hand in every such spec. This helper is the single place listing all
 * dependencies (defaulted to `{} as never`) so that adding/removing a
 * constructor param only requires updating this file, not every spec.
 */
export function buildCronTasksProcessor(
  overrides: Partial<CronTasksProcessorDeps> = {}
): CronTasksProcessor {
  const deps: CronTasksProcessorDeps = {
    usersService: {} as never,
    userProfilesService: {} as never,
    userProfileRecommendationsService: {} as never,
    usersDeletionService: {} as never,
    cronTasksSlackReporterService: {} as never,
    messagingService: {} as never,
    gamificationService: {} as never,
    recruitementAlertsService: {} as never,
    conversationPipelineService: {} as never,
    checkinService: {} as never,
    salesforceService: {} as never,
    slackService: {} as never,
    ...overrides,
  };

  return new CronTasksProcessor(
    deps.usersService,
    deps.userProfilesService,
    deps.userProfileRecommendationsService,
    deps.usersDeletionService,
    deps.cronTasksSlackReporterService,
    deps.messagingService,
    deps.gamificationService,
    deps.recruitementAlertsService,
    deps.conversationPipelineService,
    deps.checkinService,
    deps.salesforceService,
    deps.slackService
  );
}
