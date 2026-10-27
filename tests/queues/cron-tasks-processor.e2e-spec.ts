import { Jobs } from 'src/queues/queues.types';
import { getZoneNameFromDepartment } from 'src/utils/misc';
import { buildCronTasksProcessor } from 'tests/queues/build-cron-tasks-processor.helper';

jest.mock('src/tracer', () => ({
  tracer: { dogstatsd: { flush: jest.fn() } },
}));

type Row = Record<string, unknown>;

const buildSlack = () => ({
  sendCronTaskResultToSlack: jest.fn().mockResolvedValue(undefined),
});

describe('CronTasksProcessor', () => {
  describe('process (job dispatch)', () => {
    const JOB_TO_METHOD: [string, string][] = [
      [Jobs.DELETE_INACTIVE_USERS, 'deleteInactiveUsers'],
      [
        Jobs.SEND_REMINDER_TO_USER_NOT_COMPLETED_ONBOARDING,
        'remindUsersNotCompletedOnboarding',
      ],
      [
        Jobs.PREPARE_POST_ONBOARDING_COMPLETION_MAILS,
        'preparePostOnboardingCompletionMails',
      ],
      [
        Jobs.PREPARE_NOT_COMPLETED_PROFILE_MAILS,
        'prepareNotCompletedProfileMails',
      ],
      [
        Jobs.PREPARE_USER_WITHOUT_RESPONSE_TO_FIRST_MESSAGE_MAILS,
        'prepareUserWithoutResponseToFirstMessageMails',
      ],
      [
        Jobs.PREPARE_USER_CONVERSATION_FOLLOW_UP_MAILS,
        'prepareUserConversationFollowUpMails',
      ],
      [Jobs.PREPARE_RECOMMENDATION_MAILS, 'prepareRecommendationMails'],
      [
        Jobs.PREPARE_AUTO_SET_UNAVAILABLE_USERS,
        'prepareAutoSetUnavailableUsers',
      ],
      [Jobs.PROCESS_EXPIRED_ACHIEVEMENTS, 'processExpiredAchievements'],
      [
        Jobs.PREPARE_SUPER_ENGAGED_ACHIEVEMENT_REMINDER_MAILS,
        'prepareSuperEngagedAchievementReminderMails',
      ],
      [Jobs.PREPARE_RECRUITMENT_ALERTS_MAILS, 'prepareRecruitmentAlertsMails'],
      [
        Jobs.PREPARE_COMPANY_NO_ALERTS_REMINDER_MAILS,
        'prepareCompanyNoAlertsReminderMails',
      ],
      [
        Jobs.PREPARE_REFERED_NOT_ACTIVATED_MAILS,
        'prepareReferedNotActivatedMails',
      ],
      [
        Jobs.PREPARE_REMIND_COMPANY_INVITATION_MAILS,
        'prepareRemindCompanyInvitationMails',
      ],
      [
        Jobs.PREPARE_COMPANY_INVITATIONS_PENDING_MAILS,
        'prepareCompanyInvitationsPendingMails',
      ],
      [
        Jobs.PREPARE_NOT_COMPLETED_COMPANY_MAILS,
        'prepareNotCompletedCompanyMails',
      ],
      [
        Jobs.PREPARE_COMPANY_COLLAB_FOLLOW_MAILS,
        'prepareCompanyCollabFollowMails',
      ],
      [
        Jobs.PREPARE_COMMITTED_USERS_FEEDBACK_MAILS,
        'prepareCommittedUsersFeedbackMails',
      ],
      [
        Jobs.PREPARE_UNANSWERED_CONVERSATIONS_MAILS,
        'prepareUnansweredConversationsMails',
      ],
      [Jobs.PREPARE_UNAVAILABLE_USERS_MAILS, 'prepareUnavailableUsersMails'],
      [
        Jobs.PREPARE_CHURN_USERS_FEEDBACK_MAILS,
        'prepareChurnUsersFeedbackMails',
      ],
      [Jobs.PREPARE_INACTIVE_REFERERS_MAILS, 'prepareInactiveReferersMails'],
      [
        Jobs.PREPARE_WARN_ACCOUNT_DELETION_MAILS,
        'prepareWarnAccountDeletionMails',
      ],
      [
        Jobs.PREPARE_UNANSWERED_CONVERSATIONS_SMS,
        'prepareUnansweredConversationsSms',
      ],
      [
        Jobs.PREPARE_LINKEDIN_SHARE_PROFILE_MAILS,
        'prepareLinkedInShareProfileMails',
      ],
      [
        Jobs.PREPARE_UNAVAILABLE_SENDER_NOTIFICATION_MAILS,
        'prepareUnavailableSenderNotificationMails',
      ],
      [
        Jobs.SEND_ELEARNING_COMPLETION_REMINDER_MAILS,
        'remindUsersElearningCompletion',
      ],
      [Jobs.DEACTIVATE_STALE_CONVERSATIONS, 'deactivateStaleConversations'],
      [Jobs.PREPARE_CHECKIN_INVITATION_MAILS, 'prepareCheckinInvitationMails'],
      [Jobs.PREPARE_CHECKIN_RELANCE_MAILS, 'prepareCheckinRelanceMails'],
      [
        Jobs.SEND_UNVERIFIED_ACCOUNT_RELAUNCH_MAILS,
        'sendUnverifiedAccountRelaunchMails',
      ],
      [Jobs.BACKFILL_SALESFORCE_APP_ID, 'backfillSalesforceAppId'],
      [Jobs.SEND_HELP_GROUPS_DAILY_DIGEST, 'sendHelpGroupsDailyDigest'],
      [Jobs.PURGE_EXPIRED_NOTIFICATIONS, 'purgeExpiredNotifications'],
    ];

    it.each(JOB_TO_METHOD)(
      'routes the "%s" job to %s',
      async (jobName, method) => {
        const processor = buildCronTasksProcessor();
        const spy = jest
          .spyOn(processor as never, method as never)
          .mockResolvedValue('done' as never);

        const result = await processor.process({
          id: '1',
          name: jobName,
          data: {},
        } as never);

        expect(spy).toHaveBeenCalledTimes(1);
        expect(result).toBe('done');
      }
    );

    it('routes the manual Salesforce link job with its payload', async () => {
      const processor = buildCronTasksProcessor();
      const spy = jest
        .spyOn(processor, 'manualLinkSalesforceContact')
        .mockResolvedValue('done');
      const data = { links: [{ userId: 'u1', sfContactId: 'sf1' }] };

      await processor.process({
        id: '1',
        name: Jobs.MANUAL_LINK_SALESFORCE_CONTACT,
        data,
      } as never);

      expect(spy).toHaveBeenCalledWith(data);
    });

    it('rejects a job that does not belong to the cron tasks queue', async () => {
      const processor = buildCronTasksProcessor();

      await expect(
        processor.process({
          id: '1',
          name: Jobs.SEND_MAIL,
          data: {},
        } as never)
      ).rejects.toThrow(`Unknown job type: ${Jobs.SEND_MAIL}`);
    });
  });

  /**
   * Most cron tasks share the same shape: fetch a list, send one mail per item
   * (optionally after re-loading the user with its relations), report to Slack and
   * either throw or only log when some items failed.
   */
  type ListTaskCase = {
    fetchArgs?: unknown[];
    fetchFn: string;
    // Key of the row holding the user id given to findOneWithRelations (hydrated tasks only)
    hydrateKey?: string;
    idOf: (row: Row) => string;
    method: string;
    ok: (count: number) => string;
    rows: (count: number) => Row[];
    sendFn: string;
    sendService: 'usersService' | 'usersDeletionService';
    throwsMessage?: (failures: number, total: number) => string;
  };

  const userRows = (count: number): Row[] =>
    Array.from({ length: count }, (_, i) => ({ id: `user-${i + 1}` }));
  const adminRows = (count: number): Row[] =>
    Array.from({ length: count }, (_, i) => ({
      adminId: `admin-${i + 1}`,
      companyId: `company-${i + 1}`,
      companyName: `Company ${i + 1}`,
      invitationEmail: `invited-${i + 1}@example.org`,
    }));
  const refererRows = (count: number): Row[] =>
    Array.from({ length: count }, (_, i) => ({
      refererId: `referer-${i + 1}`,
      candidateEmail: `candidate-${i + 1}@example.org`,
      candidateFirstName: 'Cand',
      candidateLastName: `Idate${i + 1}`,
    }));
  const unavailableRows = (count: number): Row[] =>
    Array.from({ length: count }, (_, i) => ({
      id: `user-${i + 1}`,
      unreadConversationsCount: '4',
    }));

  const byId = (row: Row) => row.id as string;
  const byAdminId = (row: Row) => row.adminId as string;

  const LIST_TASKS: ListTaskCase[] = [
    {
      method: 'deleteInactiveUsers',
      fetchFn: 'getInactiveUsersForDeletion',
      fetchArgs: [24],
      rows: userRows,
      idOf: byId,
      sendService: 'usersDeletionService',
      sendFn: 'deleteCompleteUser',
      ok: (n) => `Deleted ${n} inactive users`,
      throwsMessage: (f, n) => `Failed deleting ${f}/${n} inactive users`,
    },
    {
      method: 'remindUsersNotCompletedOnboarding',
      fetchFn: 'getUsersNotCompletedOnboarding',
      fetchArgs: [3],
      rows: userRows,
      idOf: byId,
      sendService: 'usersService',
      sendFn: 'sendReminderToCompleteOnboarding',
      ok: (n) =>
        `Reminders sent to ${n} users that have not completed onboarding`,
      throwsMessage: (f, n) => `Failed sending ${f}/${n} onboarding reminders`,
    },
    {
      method: 'sendUnverifiedAccountRelaunchMails',
      fetchFn: 'getUsersWithUnverifiedEmailOneDayAfterCreation',
      rows: userRows,
      idOf: byId,
      sendService: 'usersService',
      sendFn: 'sendUnverifiedAccountRelaunchMail',
      ok: (n) => `Sent ${n} unverified account relaunch mails`,
      throwsMessage: (f, n) =>
        `Failed sending ${f}/${n} unverified account relaunch mails`,
    },
    {
      method: 'prepareNotCompletedProfileMails',
      fetchFn: 'getUsersWithNotCompletedProfile',
      fetchArgs: [5],
      rows: userRows,
      idOf: byId,
      sendService: 'usersService',
      sendFn: 'sendReminderToCompleteProfile',
      ok: (n) =>
        `Preparation of ${n} mails for users that have not completed their profile started.`,
    },
    {
      method: 'remindUsersElearningCompletion',
      fetchFn: 'getUsersEligibleForElearningCompletionReminder',
      fetchArgs: [2],
      rows: userRows,
      idOf: byId,
      sendService: 'usersService',
      sendFn: 'sendElearningCompletionReminderMail',
      ok: (n) =>
        `Preparation of ${n} elearning completion reminder mails started.`,
    },
    {
      method: 'prepareCompanyNoAlertsReminderMails',
      fetchFn: 'getCompanyAdminIdsForNoAlertsReminder',
      rows: adminRows,
      hydrateKey: 'adminId',
      idOf: byAdminId,
      sendService: 'usersService',
      sendFn: 'sendCompanyNoAlertsReminderMail',
      ok: (n) => `Sent ${n} company no alerts reminder mails`,
      throwsMessage: (f, n) =>
        `Failed sending ${f}/${n} company no alerts reminder mails`,
    },
    {
      method: 'prepareReferedNotActivatedMails',
      fetchFn: 'getReferedNotActivatedData',
      fetchArgs: [15],
      rows: refererRows,
      hydrateKey: 'refererId',
      idOf: (row) => row.refererId as string,
      sendService: 'usersService',
      sendFn: 'sendReferedNotActivatedMail',
      ok: (n) => `Sent ${n} refered not activated mails`,
      throwsMessage: (f, n) =>
        `Failed sending ${f}/${n} refered not activated mails`,
    },
    {
      method: 'prepareRemindCompanyInvitationMails',
      fetchFn: 'getCompanyAdminIdsForRemindInvitation',
      fetchArgs: [3],
      rows: adminRows,
      hydrateKey: 'adminId',
      idOf: byAdminId,
      sendService: 'usersService',
      sendFn: 'sendRemindCompanyInvitationMail',
      ok: (n) => `Sent ${n} remind company invitation mails`,
      throwsMessage: (f, n) =>
        `Failed sending ${f}/${n} remind company invitation mails`,
    },
    {
      method: 'prepareCompanyInvitationsPendingMails',
      fetchFn: 'getCompanyInvitationPendingData',
      fetchArgs: [7],
      rows: adminRows,
      hydrateKey: 'adminId',
      idOf: byAdminId,
      sendService: 'usersService',
      sendFn: 'sendCompanyInvitationPendingMail',
      ok: (n) => `Sent ${n} company invitations pending mails`,
      throwsMessage: (f, n) =>
        `Failed sending ${f}/${n} company invitations pending mails`,
    },
    {
      method: 'prepareNotCompletedCompanyMails',
      fetchFn: 'getCompanyAdminDataForNotCompletedCompany',
      fetchArgs: [4],
      rows: adminRows,
      hydrateKey: 'adminId',
      idOf: byAdminId,
      sendService: 'usersService',
      sendFn: 'sendNotCompletedCompanyMail',
      ok: (n) => `Sent ${n} not completed company mails`,
      throwsMessage: (f, n) =>
        `Failed sending ${f}/${n} not completed company mails`,
    },
    {
      method: 'prepareCompanyCollabFollowMails',
      fetchFn: 'getCompanyAdminDataForCollabFollow',
      rows: adminRows,
      hydrateKey: 'adminId',
      idOf: byAdminId,
      sendService: 'usersService',
      sendFn: 'sendCompanyCollabFollowMail',
      ok: (n) => `Sent ${n} company collab follow mails`,
      throwsMessage: (f, n) =>
        `Failed sending ${f}/${n} company collab follow mails`,
    },
    {
      method: 'prepareCommittedUsersFeedbackMails',
      fetchFn: 'getUserIdsForCommittedFeedback',
      fetchArgs: [40],
      rows: userRows,
      hydrateKey: 'id',
      idOf: byId,
      sendService: 'usersService',
      sendFn: 'sendCommittedUsersFeedbackMail',
      ok: (n) => `Sent ${n} committed users feedback mails`,
      throwsMessage: (f, n) =>
        `Failed sending ${f}/${n} committed users feedback mails`,
    },
    {
      method: 'prepareUnavailableUsersMails',
      fetchFn: 'getUserRowsForUnavailableUsers',
      fetchArgs: [15],
      rows: unavailableRows,
      hydrateKey: 'id',
      idOf: byId,
      sendService: 'usersService',
      sendFn: 'sendUnavailableUserMail',
      ok: (n) => `Sent ${n} unavailable user mails`,
      throwsMessage: (f, n) =>
        `Failed sending ${f}/${n} unavailable user mails`,
    },
    {
      method: 'prepareChurnUsersFeedbackMails',
      fetchFn: 'getUserIdsForChurnFeedback',
      fetchArgs: [60],
      rows: userRows,
      hydrateKey: 'id',
      idOf: byId,
      sendService: 'usersService',
      sendFn: 'sendChurnUsersFeedbackMail',
      ok: (n) => `Sent ${n} churn users feedback mails`,
      throwsMessage: (f, n) =>
        `Failed sending ${f}/${n} churn users feedback mails`,
    },
    {
      method: 'prepareInactiveReferersMails',
      fetchFn: 'getUserIdsForInactiveReferers',
      fetchArgs: [15],
      rows: userRows,
      hydrateKey: 'id',
      idOf: byId,
      sendService: 'usersService',
      sendFn: 'sendInactiveRefererMail',
      ok: (n) => `Sent ${n} inactive referer mails`,
      throwsMessage: (f, n) =>
        `Failed sending ${f}/${n} inactive referer mails`,
    },
    {
      method: 'prepareWarnAccountDeletionMails',
      fetchFn: 'getUserIdsForWarnAccountDeletion',
      fetchArgs: [23],
      rows: userRows,
      hydrateKey: 'id',
      idOf: byId,
      sendService: 'usersService',
      sendFn: 'sendWarnAccountDeletionMail',
      ok: (n) => `Sent ${n} warn account deletion mails`,
      throwsMessage: (f, n) =>
        `Failed sending ${f}/${n} warn account deletion mails`,
    },
  ];

  describe.each(LIST_TASKS)('$method', (task) => {
    const build = (rowCount: number, failingIndex?: number) => {
      const rows = task.rows(rowCount);
      const usersService: Record<string, jest.Mock> = {
        [task.fetchFn]: jest.fn().mockResolvedValue(rows),
        findOneWithRelations: jest
          .fn()
          .mockImplementation((id: string) =>
            Promise.resolve({ id, email: `${id}@example.org` })
          ),
      };
      const usersDeletionService: Record<string, jest.Mock> = {};
      const services = { usersService, usersDeletionService };
      const sendMock = jest.fn().mockResolvedValue(undefined);
      services[task.sendService][task.sendFn] = sendMock;

      // Failing a given item: the send function rejects for that item only
      if (failingIndex !== undefined) {
        const failingId = task.idOf(rows[failingIndex]);
        sendMock.mockImplementation(async (arg: Row) => {
          if (arg.id === failingId) throw new Error('boom');
        });
      }

      const slack = buildSlack();
      const processor = buildCronTasksProcessor({
        usersService: usersService as never,
        usersDeletionService: usersDeletionService as never,
        cronTasksSlackReporterService: slack as never,
      });
      return { processor, rows, usersService, sendMock, slack };
    };

    const run = (processor: unknown) =>
      (processor as Record<string, () => Promise<string>>)[task.method]();

    it('fetches the eligible rows with the configured delay', async () => {
      const { processor, usersService } = build(1);

      await run(processor);

      expect(usersService[task.fetchFn]).toHaveBeenCalledTimes(1);
      if (task.fetchArgs) {
        expect(usersService[task.fetchFn]).toHaveBeenCalledWith(
          ...task.fetchArgs
        );
      }
    });

    it('sends one mail per eligible row and reports the success to Slack', async () => {
      const { processor, sendMock, slack } = build(2);

      const result = await run(processor);

      expect(result).toBe(task.ok(2));
      expect(sendMock).toHaveBeenCalledTimes(2);
      expect(slack.sendCronTaskResultToSlack).toHaveBeenCalledTimes(1);
      expect(slack.sendCronTaskResultToSlack).toHaveBeenCalledWith(
        true,
        expect.any(String),
        { total: 2, success: 2, failure: 0 },
        []
      );
    });

    it('handles an empty list of rows', async () => {
      const { processor, sendMock, slack } = build(0);

      const result = await run(processor);

      expect(result).toBe(task.ok(0));
      expect(sendMock).not.toHaveBeenCalled();
      expect(slack.sendCronTaskResultToSlack).toHaveBeenCalledWith(
        true,
        expect.any(String),
        { total: 0, success: 0, failure: 0 },
        []
      );
    });

    it('reports the failing item to Slack without blocking the other ones', async () => {
      const { processor, sendMock, slack, rows } = build(2, 0);

      const outcome = run(processor);
      if (task.throwsMessage) {
        await expect(outcome).rejects.toThrow(task.throwsMessage(1, 2));
      } else {
        await expect(outcome).resolves.toEqual(expect.any(String));
      }

      expect(sendMock).toHaveBeenCalledTimes(2);
      expect(slack.sendCronTaskResultToSlack).toHaveBeenCalledWith(
        false,
        expect.any(String),
        { total: 2, success: 1, failure: 1 },
        [{ itemId: task.idOf(rows[0]), reason: expect.any(Error) }]
      );
    });

    if (task.hydrateKey) {
      it('skips a row whose user can no longer be loaded', async () => {
        const { processor, sendMock, usersService } = build(2);
        usersService.findOneWithRelations.mockImplementation((id: string) =>
          Promise.resolve(id === task.idOf(task.rows(2)[0]) ? null : { id })
        );

        await run(processor);

        expect(sendMock).toHaveBeenCalledTimes(1);
      });
    }
  });

  describe('sendHelpGroupsDailyDigest', () => {
    const build = (stats: {
      failed: number;
      sent: number;
      skipped: number;
    }) => {
      const helpGroupsDigestService = {
        sendDailyDigests: jest.fn().mockResolvedValue(stats),
      };
      const slack = buildSlack();
      const processor = buildCronTasksProcessor({
        helpGroupsDigestService: helpGroupsDigestService as never,
        cronTasksSlackReporterService: slack as never,
      });
      return { processor, slack };
    };

    it('reports the digest statistics to Slack as a success', async () => {
      const { processor, slack } = build({ sent: 3, skipped: 2, failed: 0 });

      const result = await processor.sendHelpGroupsDailyDigest();

      expect(result).toBe(
        'Help groups daily discussions email: 3 sent, 2 without new discussion, 0 failed'
      );
      expect(slack.sendCronTaskResultToSlack).toHaveBeenCalledWith(
        true,
        expect.any(String),
        { total: 5, success: 5, failure: 0 },
        []
      );
    });

    it('flags the Slack report as failed when a digest could not be sent', async () => {
      const { processor, slack } = build({ sent: 1, skipped: 0, failed: 2 });

      await processor.sendHelpGroupsDailyDigest();

      expect(slack.sendCronTaskResultToSlack).toHaveBeenCalledWith(
        false,
        expect.any(String),
        { total: 3, success: 1, failure: 2 },
        []
      );
    });
  });

  describe('purgeExpiredNotifications', () => {
    it('purges the expired notifications and returns their count', async () => {
      const notificationsService = {
        purgeExpired: jest.fn().mockResolvedValue(7),
      };
      const processor = buildCronTasksProcessor({
        notificationsService: notificationsService as never,
      });

      await expect(processor.purgeExpiredNotifications()).resolves.toBe(
        'Purged 7 expired notifications'
      );
    });
  });

  describe('preparePostOnboardingCompletionMails', () => {
    const build = (failingUserId?: string) => {
      const usersService = {
        getUsersCompletedOnboardingSinceDelay: jest
          .fn()
          .mockImplementation((delay: number) =>
            Promise.resolve([{ id: `user-j${delay}` }])
          ),
        sendOnboardingBAOMailToUser: jest.fn().mockImplementation(async (u) => {
          if (u.id === failingUserId) throw new Error('boom');
        }),
        sendOnboardingContactAdviceMail: jest.fn().mockResolvedValue(undefined),
      };
      const slack = buildSlack();
      const processor = buildCronTasksProcessor({
        usersService: usersService as never,
        cronTasksSlackReporterService: slack as never,
      });
      return { processor, usersService, slack };
    };

    it('sends the BAO mail at J+1 and the contact advice mail at J+4', async () => {
      const { processor, usersService, slack } = build();

      await processor.preparePostOnboardingCompletionMails();

      expect(
        usersService.getUsersCompletedOnboardingSinceDelay
      ).toHaveBeenCalledWith(1);
      expect(
        usersService.getUsersCompletedOnboardingSinceDelay
      ).toHaveBeenCalledWith(4);
      expect(usersService.sendOnboardingBAOMailToUser).toHaveBeenCalledWith({
        id: 'user-j1',
      });
      expect(usersService.sendOnboardingContactAdviceMail).toHaveBeenCalledWith(
        { id: 'user-j4' }
      );
      expect(slack.sendCronTaskResultToSlack).toHaveBeenCalledTimes(2);
    });

    it('reports a failure for one delay without preventing the other delay from running', async () => {
      const { processor, usersService, slack } = build('user-j1');

      await expect(
        processor.preparePostOnboardingCompletionMails()
      ).resolves.toEqual(expect.any(String));

      expect(usersService.sendOnboardingContactAdviceMail).toHaveBeenCalled();
      expect(slack.sendCronTaskResultToSlack).toHaveBeenCalledWith(
        false,
        expect.stringContaining('J+1'),
        { total: 1, success: 0, failure: 1 },
        [{ itemId: 'user-j1', reason: expect.any(Error) }]
      );
      expect(slack.sendCronTaskResultToSlack).toHaveBeenCalledWith(
        true,
        expect.stringContaining('J+4'),
        { total: 1, success: 1, failure: 0 },
        []
      );
    });
  });

  describe('prepareUserWithoutResponseToFirstMessageMails', () => {
    const dto = (id: string, recommendationCount: number) => ({
      id,
      user: { id },
      recommendations: new Array(recommendationCount).fill({}),
    });

    const build = (dtos: ReturnType<typeof dto>[], failingUserId?: string) => {
      const usersService = {
        getUsersWithNoResponseToFirstMessage: jest.fn().mockResolvedValue(dtos),
        sendMailForNoResponseToFirstMessage: jest
          .fn()
          .mockImplementation(async (d) => {
            if (d.user.id === failingUserId) throw new Error('boom');
          }),
      };
      const slack = buildSlack();
      const processor = buildCronTasksProcessor({
        usersService: usersService as never,
        cronTasksSlackReporterService: slack as never,
      });
      return { processor, usersService, slack };
    };

    it('only mails the users who have at least 3 recommendations and reports the skipped ones', async () => {
      const { processor, usersService, slack } = build([
        dto('enough', 3),
        dto('not-enough', 2),
      ]);

      const result =
        await processor.prepareUserWithoutResponseToFirstMessageMails();

      expect(
        usersService.getUsersWithNoResponseToFirstMessage
      ).toHaveBeenCalledWith(5);
      expect(
        usersService.sendMailForNoResponseToFirstMessage
      ).toHaveBeenCalledTimes(1);
      expect(
        usersService.sendMailForNoResponseToFirstMessage
      ).toHaveBeenCalledWith(
        expect.objectContaining({ user: { id: 'enough' } })
      );
      expect(result).toContain('2 users');
      expect(slack.sendCronTaskResultToSlack).toHaveBeenCalledWith(
        true,
        expect.stringContaining('J+5'),
        { total: 2, success: 1, failure: 0 },
        [],
        ['not-enough'],
        'Skipped (not enough recommendations)'
      );
    });

    it('reports a failed mail to Slack without throwing', async () => {
      const { processor, slack } = build([dto('u1', 3), dto('u2', 4)], 'u1');

      await expect(
        processor.prepareUserWithoutResponseToFirstMessageMails()
      ).resolves.toEqual(expect.any(String));

      expect(slack.sendCronTaskResultToSlack).toHaveBeenCalledWith(
        false,
        expect.any(String),
        { total: 2, success: 1, failure: 1 },
        [{ itemId: 'u1', reason: expect.any(Error) }],
        [],
        'Skipped (not enough recommendations)'
      );
    });
  });

  describe('prepareUserConversationFollowUpMails', () => {
    const conversation = (id: string, participantIds: string[]) => ({
      id,
      participants: participantIds.map((pid) => ({ id: pid })),
    });

    const build = (
      conversations: ReturnType<typeof conversation>[],
      failingUserId?: string
    ) => {
      const messagingService = {
        getAllMutuallyRepliedConversations: jest
          .fn()
          .mockResolvedValue(conversations),
      };
      const usersService = {
        findByIdsWithRelations: jest
          .fn()
          .mockImplementation((ids: string[]) =>
            Promise.resolve(ids.map((id) => ({ id, hydrated: true })))
          ),
        sendFollowUpMailForMutuallyRepliedConversation: jest
          .fn()
          .mockImplementation(async (user) => {
            if (user.id === failingUserId) throw new Error('boom');
          }),
      };
      const slack = buildSlack();
      const processor = buildCronTasksProcessor({
        messagingService: messagingService as never,
        usersService: usersService as never,
        cronTasksSlackReporterService: slack as never,
      });
      return { processor, usersService, messagingService, slack };
    };

    it('sends a follow-up mail to each participant with the participants reloaded once', async () => {
      const { processor, usersService, messagingService, slack } = build([
        conversation('c1', ['a', 'b']),
        conversation('c2', ['a', 'c']),
      ]);

      const result = await processor.prepareUserConversationFollowUpMails();

      expect(
        messagingService.getAllMutuallyRepliedConversations
      ).toHaveBeenCalledWith(15);
      expect(usersService.findByIdsWithRelations).toHaveBeenCalledTimes(1);
      expect(usersService.findByIdsWithRelations).toHaveBeenCalledWith([
        'a',
        'b',
        'c',
      ]);
      expect(
        usersService.sendFollowUpMailForMutuallyRepliedConversation
      ).toHaveBeenCalledTimes(4);
      expect(
        usersService.sendFollowUpMailForMutuallyRepliedConversation
      ).toHaveBeenCalledWith(
        { id: 'a', hydrated: true },
        expect.objectContaining({ id: 'c2' })
      );
      expect(result).toContain('4 users-conversations');
      expect(slack.sendCronTaskResultToSlack).toHaveBeenCalledWith(
        true,
        expect.any(String),
        { total: 4, success: 4, failure: 0 },
        []
      );
    });

    it('does not reload any participant when no conversation is eligible', async () => {
      const { processor, usersService } = build([]);

      const result = await processor.prepareUserConversationFollowUpMails();

      expect(usersService.findByIdsWithRelations).not.toHaveBeenCalled();
      expect(result).toContain('0 users-conversations');
    });

    it('reports the failing participant with its conversation:user id', async () => {
      const { processor, slack } = build([conversation('c1', ['a', 'b'])], 'b');

      await processor.prepareUserConversationFollowUpMails();

      expect(slack.sendCronTaskResultToSlack).toHaveBeenCalledWith(
        false,
        expect.any(String),
        { total: 2, success: 1, failure: 1 },
        [{ itemId: 'c1:b', reason: expect.any(Error) }]
      );
    });
  });

  describe('prepareRecommendationMails (edge cases)', () => {
    const build = ({
      profileFor = (id: string) => ({ userId: id }) as unknown,
      recommendations = [{}, {}, {}] as unknown[],
      failingUserId,
      userWithRelationsFor = (id: string) => ({ id }) as unknown,
      users,
    }: {
      failingUserId?: string;
      profileFor?: (id: string) => unknown;
      recommendations?: unknown[];
      userWithRelationsFor?: (id: string) => unknown;
      users: { id: string }[];
    }) => {
      const usersService = {
        getUsersEligibleForRecommendationMails: jest
          .fn()
          .mockResolvedValue(users),
        findOneWithRelations: jest
          .fn()
          .mockImplementation((id: string) =>
            Promise.resolve(userWithRelationsFor(id))
          ),
        sendRecommendationsMail: jest.fn().mockImplementation(async (user) => {
          if (user.id === failingUserId) throw new Error('boom');
        }),
      };
      const userProfilesService = {
        findOneByUserId: jest
          .fn()
          .mockImplementation((id: string) => Promise.resolve(profileFor(id))),
      };
      const userProfileRecommendationsService = {
        retrieveOrComputeRecommendationsForUserIdIA: jest
          .fn()
          .mockResolvedValue(recommendations),
      };
      const slack = buildSlack();
      const processor = buildCronTasksProcessor({
        usersService: usersService as never,
        userProfilesService: userProfilesService as never,
        userProfileRecommendationsService:
          userProfileRecommendationsService as never,
        cronTasksSlackReporterService: slack as never,
      });
      return {
        processor,
        usersService,
        userProfileRecommendationsService,
        slack,
      };
    };

    it('skips a user without profile and does not compute recommendations for them', async () => {
      const { processor, userProfileRecommendationsService, usersService } =
        build({ users: [{ id: 'u1' }], profileFor: () => null });

      const result = await processor.prepareRecommendationMails();

      expect(
        userProfileRecommendationsService.retrieveOrComputeRecommendationsForUserIdIA
      ).not.toHaveBeenCalled();
      expect(usersService.sendRecommendationsMail).not.toHaveBeenCalled();
      expect(result).toBe(
        'Recommendation mails sent: 0 success, 1 skipped (not enough recos), 0 errors.'
      );
    });

    it('skips a user without enough recommendations and lists them in the Slack report', async () => {
      const { processor, usersService, slack } = build({
        users: [{ id: 'u1' }, { id: 'u2' }],
        recommendations: [{}, {}],
      });

      await processor.prepareRecommendationMails();

      expect(usersService.sendRecommendationsMail).not.toHaveBeenCalled();
      expect(slack.sendCronTaskResultToSlack).toHaveBeenCalledWith(
        true,
        expect.any(String),
        { total: 2, success: 0, failure: 2 },
        [],
        ['u1', 'u2'],
        'Skipped (not enough recommendations)'
      );
    });

    it('processes the users in batches and reports a failing mail as an error', async () => {
      const users = Array.from({ length: 7 }, (_, i) => ({ id: `u${i + 1}` }));
      const { processor, usersService, slack } = build({
        users,
        failingUserId: 'u5',
      });

      const result = await processor.prepareRecommendationMails();

      expect(usersService.sendRecommendationsMail).toHaveBeenCalledTimes(7);
      expect(result).toBe(
        'Recommendation mails sent: 6 success, 0 skipped (not enough recos), 1 errors.'
      );
      expect(slack.sendCronTaskResultToSlack).toHaveBeenCalledWith(
        false,
        expect.any(String),
        { total: 7, success: 6, failure: 1 },
        [{ itemId: 'u5', reason: expect.any(Error) }],
        [],
        'Skipped (not enough recommendations)'
      );
    });
  });

  describe('prepareAutoSetUnavailableUsers', () => {
    const build = (ids: string[], failingUserId?: string) => {
      const messagingService = {
        getInactiveUsersWithUnreadConversations: jest
          .fn()
          .mockResolvedValue(ids.map((id) => ({ id }))),
      };
      const usersService = {
        findByIdsWithRelations: jest
          .fn()
          .mockImplementation((userIds: string[]) =>
            Promise.resolve(userIds.map((id) => ({ id })))
          ),
      };
      const userProfilesService = {
        setUserAsUnavailableDueToInactivity: jest
          .fn()
          .mockImplementation(async (user) => {
            if (user.id === failingUserId) throw new Error('boom');
          }),
      };
      const slack = buildSlack();
      const processor = buildCronTasksProcessor({
        messagingService: messagingService as never,
        usersService: usersService as never,
        userProfilesService: userProfilesService as never,
        cronTasksSlackReporterService: slack as never,
      });
      return {
        processor,
        messagingService,
        usersService,
        userProfilesService,
        slack,
      };
    };

    it('sets the inactive users with unread messages as unavailable', async () => {
      const { processor, messagingService, userProfilesService, slack } = build(
        ['u1', 'u2']
      );

      const result = await processor.prepareAutoSetUnavailableUsers();

      expect(
        messagingService.getInactiveUsersWithUnreadConversations
      ).toHaveBeenCalledWith(30, 15);
      expect(
        userProfilesService.setUserAsUnavailableDueToInactivity
      ).toHaveBeenCalledTimes(2);
      expect(result).toBe('Set 2 inactive users as unavailable');
      expect(slack.sendCronTaskResultToSlack).toHaveBeenCalledWith(
        true,
        expect.any(String),
        { total: 2, success: 2, failure: 0 },
        []
      );
    });

    it('does not load any user when nobody is inactive', async () => {
      const { processor, usersService } = build([]);

      const result = await processor.prepareAutoSetUnavailableUsers();

      expect(usersService.findByIdsWithRelations).not.toHaveBeenCalled();
      expect(result).toBe('Set 0 inactive users as unavailable');
    });

    it('processes users by batches of 50 and throws when some updates fail', async () => {
      const ids = Array.from({ length: 120 }, (_, i) => `u${i + 1}`);
      const { processor, userProfilesService, slack } = build(ids, 'u60');

      await expect(processor.prepareAutoSetUnavailableUsers()).rejects.toThrow(
        'Failed setting 1/120 inactive users as unavailable'
      );

      expect(
        userProfilesService.setUserAsUnavailableDueToInactivity
      ).toHaveBeenCalledTimes(120);
      expect(slack.sendCronTaskResultToSlack).toHaveBeenCalledWith(
        false,
        expect.any(String),
        { total: 120, success: 119, failure: 1 },
        [{ itemId: 'u60', reason: expect.any(Error) }]
      );
    });
  });

  describe('gamification tasks', () => {
    const build = (gamificationService: Record<string, jest.Mock>) => {
      const slack = buildSlack();
      const processor = buildCronTasksProcessor({
        gamificationService: gamificationService as never,
        cronTasksSlackReporterService: slack as never,
      });
      return { processor, slack };
    };

    it('reports the Super Engaged reminder mails as a success', async () => {
      const { processor, slack } = build({
        prepareExpirationReminderMails: jest
          .fn()
          .mockResolvedValue({ total: 4, sent: 4, failures: [] }),
      });

      const result =
        await processor.prepareSuperEngagedAchievementReminderMails();

      expect(result).toBe('Sent 4/4 Super Engaged achievement reminder mails');
      expect(slack.sendCronTaskResultToSlack).toHaveBeenCalledWith(
        true,
        expect.any(String),
        { total: 4, success: 4, failure: 0 },
        []
      );
    });

    it('throws when some Super Engaged reminder mails failed', async () => {
      const failures = [{ itemId: 'u1', reason: new Error('boom') }];
      const { processor, slack } = build({
        prepareExpirationReminderMails: jest
          .fn()
          .mockResolvedValue({ total: 4, sent: 3, failures }),
      });

      await expect(
        processor.prepareSuperEngagedAchievementReminderMails()
      ).rejects.toThrow('Failed sending 1/4 Super Engaged reminder mails');
      expect(slack.sendCronTaskResultToSlack).toHaveBeenCalledWith(
        false,
        expect.any(String),
        { total: 4, success: 3, failure: 1 },
        failures
      );
    });

    it('reports the renewed and expired achievements as a success', async () => {
      const { processor, slack } = build({
        processExpiredAchievements: jest.fn().mockResolvedValue({
          total: 5,
          renewed: 3,
          expired: 2,
          failures: [],
        }),
      });

      const result = await processor.processExpiredAchievements();

      expect(result).toBe(
        'Processed 5 expired achievements: 3 renewed, 2 expired'
      );
      expect(slack.sendCronTaskResultToSlack).toHaveBeenCalledWith(
        true,
        expect.any(String),
        { total: 5, success: 5, failure: 0 },
        []
      );
    });

    it('throws when some expired achievements could not be processed', async () => {
      const failures = [{ itemId: 'a1', reason: new Error('boom') }];
      const { processor } = build({
        processExpiredAchievements: jest.fn().mockResolvedValue({
          total: 5,
          renewed: 2,
          expired: 2,
          failures,
        }),
      });

      await expect(processor.processExpiredAchievements()).rejects.toThrow(
        'Failed processing 1/5 expired achievements'
      );
    });
  });

  describe('prepareRecruitmentAlertsMails', () => {
    const alert = (id: string, { admin = true }: { admin?: boolean } = {}) => ({
      id,
      name: `Alert ${id}`,
      company: {
        companyUsers: admin
          ? [
              { isAdmin: false, userId: 'member' },
              { isAdmin: true, userId: `admin-of-${id}` },
            ]
          : [{ isAdmin: false, userId: 'member' }],
      },
    });

    const build = ({
      alerts,
      matching = {},
      notified = {},
      adminUser = (id: string) =>
        ({
          id,
          email: `${id}@example.org`,
          firstName: 'Ada',
          staffContact: { name: 'Staff' },
          userProfile: { department: undefined },
        }) as unknown,
      failingAlertEmail,
    }: {
      adminUser?: (id: string) => unknown;
      alerts: ReturnType<typeof alert>[];
      failingAlertEmail?: string;
      matching?: Record<string, { id: string }[]>;
      notified?: Record<string, { userId: string }[]>;
    }) => {
      const recruitementAlertsService = {
        findAll: jest.fn().mockResolvedValue(alerts),
        getRecruitementAlertMatching: jest
          .fn()
          .mockImplementation((id: string) =>
            Promise.resolve(matching[id] ?? [])
          ),
        findRecruitementAlertNotifiedCandidate: jest
          .fn()
          .mockImplementation((id: string) =>
            Promise.resolve(notified[id] ?? [])
          ),
        markUsersAsNotified: jest.fn().mockResolvedValue(undefined),
      };
      const usersService = {
        findOneWithRelations: jest
          .fn()
          .mockImplementation((id: string) => Promise.resolve(adminUser(id))),
        sendRecruitmentAlertMail: jest.fn().mockImplementation(async (a) => {
          if (a.companyAdminEmail === failingAlertEmail) {
            throw new Error('boom');
          }
        }),
      };
      const slack = buildSlack();
      const processor = buildCronTasksProcessor({
        recruitementAlertsService: recruitementAlertsService as never,
        usersService: usersService as never,
        cronTasksSlackReporterService: slack as never,
      });
      return { processor, recruitementAlertsService, usersService, slack };
    };

    it('mails the company admin about the new matching candidates and marks them as notified', async () => {
      const { processor, recruitementAlertsService, usersService, slack } =
        build({
          alerts: [alert('a1')],
          matching: { a1: [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }] },
          notified: { a1: [{ userId: 'c1' }] },
        });

      const result = await processor.prepareRecruitmentAlertsMails();

      expect(usersService.sendRecruitmentAlertMail).toHaveBeenCalledWith({
        alertId: 'a1',
        alertName: 'Alert a1',
        newCandidatesCount: 2,
        companyAdminEmail: 'admin-of-a1@example.org',
        companyAdminId: expect.any(String),
        firstName: 'Ada',
        zone: getZoneNameFromDepartment(undefined),
        staffContact: { name: 'Staff' },
      });
      expect(
        recruitementAlertsService.markUsersAsNotified
      ).toHaveBeenCalledWith('a1', ['c2', 'c3']);
      expect(result).toBe('Sent 1 recruitment alert mails');
      expect(slack.sendCronTaskResultToSlack).toHaveBeenCalledWith(
        true,
        expect.any(String),
        { total: 1, success: 1, failure: 0 },
        []
      );
    });

    it('ignores the alerts that have nothing new to notify or nobody to notify', async () => {
      const { processor, recruitementAlertsService, usersService } = build({
        alerts: [
          alert('no-match'),
          alert('already-notified'),
          alert('no-admin', { admin: false }),
          alert('admin-not-found'),
        ],
        matching: {
          'already-notified': [{ id: 'c1' }],
          'no-admin': [{ id: 'c1' }],
          'admin-not-found': [{ id: 'c1' }],
        },
        notified: { 'already-notified': [{ userId: 'c1' }] },
        adminUser: () => null,
      });

      const result = await processor.prepareRecruitmentAlertsMails();

      expect(usersService.sendRecruitmentAlertMail).not.toHaveBeenCalled();
      expect(
        recruitementAlertsService.markUsersAsNotified
      ).not.toHaveBeenCalled();
      expect(result).toBe('Sent 0 recruitment alert mails');
    });

    it('throws and reports the alert whose mail failed', async () => {
      const { processor, slack } = build({
        alerts: [alert('a1'), alert('a2')],
        matching: { a1: [{ id: 'c1' }], a2: [{ id: 'c2' }] },
        failingAlertEmail: 'admin-of-a2@example.org',
      });

      await expect(processor.prepareRecruitmentAlertsMails()).rejects.toThrow(
        'Failed sending 1/2 recruitment alert mails'
      );
      expect(slack.sendCronTaskResultToSlack).toHaveBeenCalledWith(
        false,
        expect.any(String),
        { total: 2, success: 1, failure: 1 },
        [{ itemId: 'a2', reason: expect.any(Error) }]
      );
    });
  });

  describe.each([
    {
      method: 'prepareCheckinInvitationMails' as const,
      sendFn: 'sendInvitationMails',
      threshold: 30,
      ok: (n: number) => `Sent checkin invitation mails for ${n} participants`,
      err: (f: number, n: number) =>
        `Failed sending checkin invitation mails for ${f}/${n} participants`,
    },
    {
      method: 'prepareCheckinRelanceMails' as const,
      sendFn: 'sendRelanceMails',
      threshold: 37,
      ok: (n: number) => `Sent checkin relance mails for ${n} participants`,
      err: (f: number, n: number) =>
        `Failed sending checkin relance mails for ${f}/${n} participants`,
    },
  ])('$method', ({ method, sendFn, threshold, ok, err }) => {
    const recipients = [
      { conversationId: 'c1', userId: 'u1' },
      { conversationId: 'c2', userId: 'u2' },
    ];

    const build = (results: PromiseSettledResult<unknown>[]) => {
      const checkinService = {
        getEligibleCheckinParticipants: jest.fn().mockResolvedValue(recipients),
        [sendFn]: jest.fn().mockResolvedValue(results),
      };
      const slack = buildSlack();
      const processor = buildCronTasksProcessor({
        checkinService: checkinService as never,
        cronTasksSlackReporterService: slack as never,
      });
      return { processor, checkinService, slack };
    };

    it('sends the mails to the participants eligible after the configured threshold', async () => {
      const { processor, checkinService, slack } = build([
        { status: 'fulfilled', value: undefined },
        { status: 'fulfilled', value: undefined },
      ]);

      const result = await processor[method]();

      expect(
        checkinService.getEligibleCheckinParticipants
      ).toHaveBeenCalledWith(threshold);
      expect(checkinService[sendFn]).toHaveBeenCalledWith(recipients);
      expect(result).toBe(ok(2));
      expect(slack.sendCronTaskResultToSlack).toHaveBeenCalledWith(
        true,
        expect.any(String),
        { total: 2, success: 2, failure: 0 },
        []
      );
    });

    it('throws and reports the participant whose mail failed', async () => {
      const reason = new Error('boom');
      const { processor, slack } = build([
        { status: 'fulfilled', value: undefined },
        { status: 'rejected', reason },
      ]);

      await expect(processor[method]()).rejects.toThrow(err(1, 2));
      expect(slack.sendCronTaskResultToSlack).toHaveBeenCalledWith(
        false,
        expect.any(String),
        { total: 2, success: 1, failure: 1 },
        [{ itemId: 'c2:u2', reason }]
      );
    });
  });

  describe('prepareUnansweredConversationsMails', () => {
    const build = (failingUserId?: string) => {
      const usersService = {
        getUserRowsForUnansweredConversations: jest
          .fn()
          .mockImplementation((days: number) =>
            Promise.resolve([
              { id: `user-d${days}`, unansweredConversationsCount: '2' },
            ])
          ),
        findOneWithRelations: jest
          .fn()
          .mockImplementation((id: string) => Promise.resolve({ id })),
        sendUnansweredConversationsMail: jest
          .fn()
          .mockImplementation(async (user) => {
            if (user.id === failingUserId) throw new Error('boom');
          }),
      };
      const slack = buildSlack();
      const processor = buildCronTasksProcessor({
        usersService: usersService as never,
        cronTasksSlackReporterService: slack as never,
      });
      return { processor, usersService, slack };
    };

    it('contacts users with unanswered conversations after 2, 10 and 20 days', async () => {
      const { processor, usersService, slack } = build();

      const result = await processor.prepareUnansweredConversationsMails();

      expect(
        usersService.getUserRowsForUnansweredConversations
      ).toHaveBeenCalledTimes(3);
      expect(usersService.sendUnansweredConversationsMail).toHaveBeenCalledWith(
        { id: 'user-d10' },
        2,
        10
      );
      expect(result).toBe('Sent 3 unanswered conversations mails');
      expect(slack.sendCronTaskResultToSlack).toHaveBeenCalledWith(
        true,
        expect.stringContaining('J+2/10/20'),
        { total: 3, success: 3, failure: 0 },
        []
      );
    });

    it('throws after having tried every delay when one mail failed', async () => {
      const { processor, usersService, slack } = build('user-d10');

      await expect(
        processor.prepareUnansweredConversationsMails()
      ).rejects.toThrow('Failed sending 1/3 unanswered conversations mails');
      expect(
        usersService.sendUnansweredConversationsMail
      ).toHaveBeenCalledTimes(3);
      expect(slack.sendCronTaskResultToSlack).toHaveBeenCalledWith(
        false,
        expect.any(String),
        { total: 3, success: 2, failure: 1 },
        [{ itemId: 'user-d10', reason: expect.any(Error) }]
      );
    });
  });

  describe('prepareUnavailableSenderNotificationMails', () => {
    const notification = (author: string, unavailable: string) => ({
      messageAuthor: { id: author, email: `${author}@example.org` },
      unavailableUser: { id: unavailable },
    });

    const build = (
      notifications: ReturnType<typeof notification>[],
      failingAuthorId?: string
    ) => {
      const usersService = {
        getUnavailableSenderNotifications: jest
          .fn()
          .mockResolvedValue(notifications),
        sendUnavailableSenderNotificationMail: jest
          .fn()
          .mockImplementation(async (dto) => {
            if (dto.messageAuthor.id === failingAuthorId) {
              throw new Error('boom');
            }
          }),
      };
      const slack = buildSlack();
      const processor = buildCronTasksProcessor({
        usersService: usersService as never,
        cronTasksSlackReporterService: slack as never,
      });
      return { processor, usersService, slack };
    };

    it('looks at the messages of the previous calendar day and mails their authors', async () => {
      const { processor, usersService, slack } = build([
        notification('author-1', 'away-1'),
        notification('author-2', 'away-2'),
      ]);

      const result =
        await processor.prepareUnavailableSenderNotificationMails();

      const [from, to] =
        usersService.getUnavailableSenderNotifications.mock.calls[0];
      expect(to.getHours()).toBe(0);
      expect(to.getMinutes()).toBe(0);
      expect(to.getTime() - from.getTime()).toBeGreaterThanOrEqual(
        23 * 60 * 60 * 1000
      );
      expect(to.getTime() - from.getTime()).toBeLessThanOrEqual(
        25 * 60 * 60 * 1000
      );
      expect(
        usersService.sendUnavailableSenderNotificationMail
      ).toHaveBeenCalledTimes(2);
      expect(result).toBe('Sent 2 unavailable sender notification mails');
      expect(slack.sendCronTaskResultToSlack).toHaveBeenCalledWith(
        true,
        expect.any(String),
        { total: 2, success: 2, failure: 0 },
        []
      );
    });

    it('throws and reports the notification that failed', async () => {
      const { processor, slack } = build(
        [
          notification('author-1', 'away-1'),
          notification('author-2', 'away-2'),
        ],
        'author-2'
      );

      await expect(
        processor.prepareUnavailableSenderNotificationMails()
      ).rejects.toThrow(
        'Failed sending 1/2 unavailable sender notification mails'
      );
      expect(slack.sendCronTaskResultToSlack).toHaveBeenCalledWith(
        false,
        expect.any(String),
        { total: 2, success: 1, failure: 1 },
        [{ itemId: 'away-2-author-2-1', reason: expect.any(Error) }]
      );
    });
  });

  describe('prepareUnansweredConversationsSms', () => {
    const row = (recipientId: string) => ({
      recipientId,
      recipientPhone: `+33600${recipientId}`,
      conversationId: `conv-${recipientId}`,
      senderId: `sender-${recipientId}`,
      senderFirstName: 'Sam',
    });

    const build = (failingPhone?: string) => {
      const usersService = {
        getUnansweredConversationSmsRows: jest
          .fn()
          .mockImplementation((role: string) =>
            Promise.resolve([row(role === 'Candidat' ? '1' : '2')])
          ),
        sendUnansweredConversationSms: jest
          .fn()
          .mockImplementation(async (phone: string) => {
            if (phone === failingPhone) throw new Error('boom');
          }),
      };
      const slack = buildSlack();
      const processor = buildCronTasksProcessor({
        usersService: usersService as never,
        cronTasksSlackReporterService: slack as never,
      });
      return { processor, usersService, slack };
    };

    it('sends the SMS to the candidates and the coaches 3 days after the first message', async () => {
      const { processor, usersService, slack } = build();

      const result = await processor.prepareUnansweredConversationsSms();

      expect(
        usersService.getUnansweredConversationSmsRows
      ).toHaveBeenCalledTimes(2);
      expect(
        usersService.getUnansweredConversationSmsRows
      ).toHaveBeenCalledWith('Candidat', 3);
      expect(
        usersService.getUnansweredConversationSmsRows
      ).toHaveBeenCalledWith('Coach', 3);
      expect(usersService.sendUnansweredConversationSms).toHaveBeenCalledWith(
        '+33600' + '1',
        'Candidat',
        'Sam',
        'sender-1',
        expect.any(String)
      );
      expect(result).toBe(
        'Sent 1 unanswered conversation SMS to Candidat, Sent 1 unanswered conversation SMS to Coach'
      );
      expect(slack.sendCronTaskResultToSlack).toHaveBeenCalledTimes(2);
    });

    it('throws a message naming the role whose SMS failed', async () => {
      const { processor, slack } = build('+336002');

      await expect(
        processor.prepareUnansweredConversationsSms()
      ).rejects.toThrow(
        'Failed sending 1/1 unanswered conversation SMS to Coach'
      );
      expect(slack.sendCronTaskResultToSlack).toHaveBeenCalledWith(
        false,
        expect.stringContaining('Coach'),
        { total: 1, success: 0, failure: 1 },
        [{ itemId: '2', reason: expect.any(Error) }]
      );
    });
  });

  describe('prepareLinkedInShareProfileMails', () => {
    const participant = (id: string, role: string) => ({ id, role });
    const conversation = (id: string, participants: unknown[]) => ({
      id,
      participants,
    });

    const build = (
      conversations: ReturnType<typeof conversation>[],
      failingCoachId?: string
    ) => {
      const messagingService = {
        getConversationsReadyForLinkedInShareMail: jest
          .fn()
          .mockResolvedValue(conversations),
      };
      const usersService = {
        findByIdsWithRelations: jest
          .fn()
          .mockImplementation((ids: string[]) =>
            Promise.resolve(ids.map((id) => ({ id, hydrated: true })))
          ),
        sendLinkedInShareProfileMail: jest
          .fn()
          .mockImplementation(async (coach) => {
            if (coach.id === failingCoachId) throw new Error('boom');
          }),
      };
      const slack = buildSlack();
      const processor = buildCronTasksProcessor({
        messagingService: messagingService as never,
        usersService: usersService as never,
        cronTasksSlackReporterService: slack as never,
      });
      return { processor, messagingService, usersService, slack };
    };

    const run = (processor: unknown) =>
      (
        processor as { prepareLinkedInShareProfileMails: () => Promise<string> }
      ).prepareLinkedInShareProfileMails();

    it('mails each coach with the hydrated candidate of the conversation', async () => {
      const { processor, messagingService, usersService, slack } = build([
        conversation('c1', [
          participant('coach-1', 'Coach'),
          participant('cand-1', 'Candidat'),
        ]),
      ]);

      const result = await run(processor);

      expect(
        messagingService.getConversationsReadyForLinkedInShareMail
      ).toHaveBeenCalledWith(7);
      expect(usersService.findByIdsWithRelations).toHaveBeenCalledWith([
        'coach-1',
        'cand-1',
      ]);
      expect(usersService.sendLinkedInShareProfileMail).toHaveBeenCalledWith(
        { id: 'coach-1', hydrated: true },
        { id: 'cand-1', hydrated: true }
      );
      expect(result).toContain('1 coaches');
      expect(slack.sendCronTaskResultToSlack).toHaveBeenCalledWith(
        true,
        expect.any(String),
        { total: 1, success: 1, failure: 0 },
        []
      );
    });

    it('ignores conversations that do not have both a coach and a candidate', async () => {
      const { processor, usersService } = build([
        conversation('c1', [participant('coach-1', 'Coach')]),
        conversation('c2', [participant('cand-2', 'Candidat')]),
      ]);

      const result = await run(processor);

      expect(usersService.findByIdsWithRelations).not.toHaveBeenCalled();
      expect(usersService.sendLinkedInShareProfileMail).not.toHaveBeenCalled();
      expect(result).toContain('0 coaches');
    });

    it('reports a failing mail without throwing', async () => {
      const { processor, slack } = build(
        [
          conversation('c1', [
            participant('coach-1', 'Coach'),
            participant('cand-1', 'Candidat'),
          ]),
        ],
        'coach-1'
      );

      await expect(run(processor)).resolves.toEqual(expect.any(String));
      expect(slack.sendCronTaskResultToSlack).toHaveBeenCalledWith(
        false,
        expect.any(String),
        { total: 1, success: 0, failure: 1 },
        [{ itemId: 'c1:coach-1', reason: expect.any(Error) }]
      );
    });
  });
});
