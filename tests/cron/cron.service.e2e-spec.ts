import { SCHEDULE_CRON_OPTIONS } from '@nestjs/schedule/dist/schedule.constants';
import { CronService } from 'src/cron/cron.service';
import { Jobs } from 'src/queues/queues.types';

/**
 * CronService only enqueues one job per scheduled method: the actual work is done by
 * CronTasksProcessor in the worker app. Each method must enqueue the right job on the
 * cron tasks queue and report it as processing.
 */
const CRON_METHOD_TO_JOB: Record<string, string> = {
  deleteInactiveUsers: Jobs.DELETE_INACTIVE_USERS,
  sendReminderToUserNotCompletedOnboarding:
    Jobs.SEND_REMINDER_TO_USER_NOT_COMPLETED_ONBOARDING,
  sendElearningCompletionReminderMails:
    Jobs.SEND_ELEARNING_COMPLETION_REMINDER_MAILS,
  preparePostOnboardingCompletionMails:
    Jobs.PREPARE_POST_ONBOARDING_COMPLETION_MAILS,
  prepareNotCompletedProfileMails: Jobs.PREPARE_NOT_COMPLETED_PROFILE_MAILS,
  prepareUserWithoutResponseToFirstMessageMails:
    Jobs.PREPARE_USER_WITHOUT_RESPONSE_TO_FIRST_MESSAGE_MAILS,
  prepareUserConversationFollowUpMails:
    Jobs.PREPARE_USER_CONVERSATION_FOLLOW_UP_MAILS,
  prepareLinkedInShareProfileMails: Jobs.PREPARE_LINKEDIN_SHARE_PROFILE_MAILS,
  prepareAutoSetUnavailableUsers: Jobs.PREPARE_AUTO_SET_UNAVAILABLE_USERS,
  prepareSuperEngagedAchievementReminderMails:
    Jobs.PREPARE_SUPER_ENGAGED_ACHIEVEMENT_REMINDER_MAILS,
  processExpiredAchievements: Jobs.PROCESS_EXPIRED_ACHIEVEMENTS,
  prepareRecommendationMails: Jobs.PREPARE_RECOMMENDATION_MAILS,
  prepareRecruitmentAlertsMails: Jobs.PREPARE_RECRUITMENT_ALERTS_MAILS,
  prepareCompanyNoAlertsReminderMails:
    Jobs.PREPARE_COMPANY_NO_ALERTS_REMINDER_MAILS,
  prepareReferedNotActivatedMails: Jobs.PREPARE_REFERED_NOT_ACTIVATED_MAILS,
  prepareRemindCompanyInvitationMails:
    Jobs.PREPARE_REMIND_COMPANY_INVITATION_MAILS,
  prepareCompanyInvitationsPendingMails:
    Jobs.PREPARE_COMPANY_INVITATIONS_PENDING_MAILS,
  prepareNotCompletedCompanyMails: Jobs.PREPARE_NOT_COMPLETED_COMPANY_MAILS,
  prepareCompanyCollabFollowMails: Jobs.PREPARE_COMPANY_COLLAB_FOLLOW_MAILS,
  prepareCommittedUsersFeedbackMails:
    Jobs.PREPARE_COMMITTED_USERS_FEEDBACK_MAILS,
  prepareUnansweredConversationsSms: Jobs.PREPARE_UNANSWERED_CONVERSATIONS_SMS,
  prepareUnansweredConversationsMails:
    Jobs.PREPARE_UNANSWERED_CONVERSATIONS_MAILS,
  deactivateStaleConversations: Jobs.DEACTIVATE_STALE_CONVERSATIONS,
  prepareUnavailableUsersMails: Jobs.PREPARE_UNAVAILABLE_USERS_MAILS,
  prepareUnavailableSenderNotificationMails:
    Jobs.PREPARE_UNAVAILABLE_SENDER_NOTIFICATION_MAILS,
  prepareChurnUsersFeedbackMails: Jobs.PREPARE_CHURN_USERS_FEEDBACK_MAILS,
  prepareInactiveReferersMails: Jobs.PREPARE_INACTIVE_REFERERS_MAILS,
  prepareWarnAccountDeletionMails: Jobs.PREPARE_WARN_ACCOUNT_DELETION_MAILS,
  prepareCheckinInvitationMails: Jobs.PREPARE_CHECKIN_INVITATION_MAILS,
  prepareCheckinRelanceMails: Jobs.PREPARE_CHECKIN_RELANCE_MAILS,
  sendUnverifiedAccountRelaunchMails:
    Jobs.SEND_UNVERIFIED_ACCOUNT_RELAUNCH_MAILS,
  sendHelpGroupsDailyDigest: Jobs.SEND_HELP_GROUPS_DAILY_DIGEST,
  purgeExpiredNotifications: Jobs.PURGE_EXPIRED_NOTIFICATIONS,
};

describe('CronService', () => {
  const buildService = () => {
    const queuesService = {
      addToCronTasksQueue: jest.fn().mockResolvedValue({ id: 'job-42' }),
    };
    const service = new CronService(queuesService as never);
    return { service, queuesService };
  };

  it.each(Object.entries(CRON_METHOD_TO_JOB))(
    '%s enqueues the %s job on the cron tasks queue',
    async (method, job) => {
      const { service, queuesService } = buildService();

      const result = await (
        service as unknown as Record<string, () => Promise<unknown>>
      )[method]();

      expect(queuesService.addToCronTasksQueue).toHaveBeenCalledTimes(1);
      expect(queuesService.addToCronTasksQueue).toHaveBeenCalledWith(job, {});
      expect(result).toEqual({ jobId: 'job-42', status: 'processing' });
    }
  );

  it('registers a @Cron schedule on every scheduled method and no method is left untested', () => {
    const prototype = CronService.prototype as unknown as Record<
      string,
      unknown
    >;
    const scheduledMethods = Object.getOwnPropertyNames(prototype).filter(
      (name) =>
        name !== 'constructor' &&
        Reflect.getMetadata(SCHEDULE_CRON_OPTIONS, prototype[name] as object)
    );

    expect(scheduledMethods.sort()).toEqual(
      Object.keys(CRON_METHOD_TO_JOB).sort()
    );
  });

  it('propagates the error when the job cannot be enqueued', async () => {
    const { service, queuesService } = buildService();
    queuesService.addToCronTasksQueue.mockRejectedValue(
      new Error('Redis down')
    );

    await expect(service.deleteInactiveUsers()).rejects.toThrow('Redis down');
  });

  it('runs the help groups digest at 6 PM Paris time', () => {
    const options = Reflect.getMetadata(
      SCHEDULE_CRON_OPTIONS,
      CronService.prototype.sendHelpGroupsDailyDigest
    );

    expect(options.cronTime).toBe('0 18 * * *');
    expect(options.timeZone).toBe('Europe/Paris');
  });
});
