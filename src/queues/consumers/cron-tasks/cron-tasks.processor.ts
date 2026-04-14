import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import chunk from 'lodash/chunk';
import { RecruitementAlertsService } from 'src/common/recruitement-alerts/recruitement-alerts.service';
import { GamificationService } from 'src/gamification/gamification.service';
import { MessagingService } from 'src/messaging/messaging.service';
import { CronTasksSlackReporterService } from 'src/queues/consumers/cron-tasks/cron-tasks-slack-reporter.service';
import {
  collectSettledResults,
  SettledFailure,
} from 'src/queues/consumers/cron-tasks/cron-tasks.utils';
import { Jobs, Queues } from 'src/queues/queues.types';
import { UserProfileRecommendationsService } from 'src/user-profiles/recommendations/user-profile-recommendations-ai.service';
import { UserProfilesService } from 'src/user-profiles/user-profiles.service';
import { User } from 'src/users/models';
import { UsersService } from 'src/users/users.service';
import { UsersDeletionService } from 'src/users-deletion/users-deletion.service';
import { getZoneNameFromDepartment } from 'src/utils/misc';

@Processor(Queues.CRON_TASKS)
export class CronTasksProcessor extends WorkerHost {
  private readonly logger = new Logger(CronTasksProcessor.name);

  constructor(
    private usersService: UsersService,
    private userProfilesService: UserProfilesService,
    private userProfileRecommendationsService: UserProfileRecommendationsService,
    private usersDeletionService: UsersDeletionService,
    private cronTasksSlackReporterService: CronTasksSlackReporterService,
    private messagingService: MessagingService,
    private gamificationService: GamificationService,
    private recruitementAlertsService: RecruitementAlertsService
  ) {
    super();
  }

  async process(job: Job): Promise<string> {
    this.logger.log(`Processing job ${job.id} of type ${job.name}`);

    switch (job.name) {
      case Jobs.DELETE_INACTIVE_USERS:
        return this.deleteInactiveUsers();
      case Jobs.SEND_REMINDER_TO_USER_NOT_COMPLETED_ONBOARDING:
        return this.remindUsersNotCompletedOnboarding();
      case Jobs.PREPARE_POST_ONBOARDING_COMPLETION_MAILS:
        return this.preparePostOnboardingCompletionMails();
      case Jobs.PREPARE_NOT_COMPLETED_PROFILE_MAILS:
        return this.prepareNotCompletedProfileMails();
      case Jobs.PREPARE_USER_WITHOUT_RESPONSE_TO_FIRST_MESSAGE_MAILS:
        return this.prepareUserWithoutResponseToFirstMessageMails();
      case Jobs.PREPARE_USER_CONVERSATION_FOLLOW_UP_MAILS:
        return this.prepareUserConversationFollowUpMails();
      case Jobs.PREPARE_RECOMMENDATION_MAILS:
        return this.prepareRecommendationMails();
      case Jobs.PREPARE_AUTO_SET_UNAVAILABLE_USERS:
        return this.prepareAutoSetUnavailableUsers();
      case Jobs.PROCESS_EXPIRED_ACHIEVEMENTS:
        return this.processExpiredAchievements();
      case Jobs.PREPARE_SUPER_ENGAGED_ACHIEVEMENT_REMINDER_MAILS:
        return this.prepareSuperEngagedAchievementReminderMails();
      case Jobs.PREPARE_RECRUITMENT_ALERTS_MAILS:
        return this.prepareRecruitmentAlertsMails();
      case Jobs.PREPARE_COMPANY_NO_ALERTS_REMINDER_MAILS:
        return this.prepareCompanyNoAlertsReminderMails();
      case Jobs.PREPARE_REFERED_NOT_ACTIVATED_MAILS:
        return this.prepareReferedNotActivatedMails();
      case Jobs.PREPARE_REMIND_COMPANY_INVITATION_MAILS:
        return this.prepareRemindCompanyInvitationMails();
      case Jobs.PREPARE_COMPANY_INVITATIONS_PENDING_MAILS:
        return this.prepareCompanyInvitationsPendingMails();
      case Jobs.PREPARE_NOT_COMPLETED_COMPANY_MAILS:
        return this.prepareNotCompletedCompanyMails();
      case Jobs.PREPARE_COMPANY_COLLAB_FOLLOW_MAILS:
        return this.prepareCompanyCollabFollowMails();
      case Jobs.PREPARE_COMMITTED_USERS_FEEDBACK_MAILS:
        return this.prepareCommittedUsersFeedbackMails();
      case Jobs.PREPARE_UNREAD_CONVERSATIONS_MAILS:
        return this.prepareUnreadConversationsMails();
      case Jobs.PREPARE_UNAVAILABLE_USERS_MAILS:
        return this.prepareUnavailableUsersMails();
      case Jobs.PREPARE_CHURN_USERS_FEEDBACK_MAILS:
        return this.prepareChurnUsersFeedbackMails();
      case Jobs.PREPARE_INACTIVE_REFERERS_MAILS:
        return this.prepareInactiveReferersMails();
      case Jobs.PREPARE_MESSAGING_FEEDBACK_MAILS:
        return this.prepareMessagingFeedbackMails();
      case Jobs.PREPARE_WARN_ACCOUNT_DELETION_MAILS:
        return this.prepareWarnAccountDeletionMails();
      default:
        this.logger.error(
          `No process method for job ${job.id} with name ${job.name}`
        );
        throw new Error(`Unknown job type: ${job.name}`);
    }
  }

  async deleteInactiveUsers() {
    this.logger.log('Deleting inactive users...');
    const inactiveUsers = await this.usersService.getInactiveUsersForDeletion();
    this.logger.log(`Found ${inactiveUsers.length} inactive users to delete`);
    const results = await Promise.allSettled(
      inactiveUsers.map(async (user) => {
        this.logger.log(`Deleting user ${user.id}`);
        await this.usersDeletionService.deleteCompleteUser(user);
      })
    );

    const { succeeded, successIds, failures } = collectSettledResults(
      inactiveUsers,
      results,
      (userId, reason) => {
        this.logger.error(`Failed deleting user ${userId}`, reason);
      }
    );

    await this.cronTasksSlackReporterService.sendCronTaskResultToSlack(
      succeeded,
      '🗑️ Delete inactive users',
      {
        total: inactiveUsers.length,
        success: successIds.length,
        failure: failures.length,
      },
      failures
    );

    if (!succeeded) {
      throw new Error(
        `Failed deleting ${failures.length}/${inactiveUsers.length} inactive users`
      );
    }

    return `Deleted ${successIds.length} inactive users`;
  }

  /**
   * Process the job to send a reminder to users that have not completed onboarding.
   * This method is called by the CronService every day at 9 AM.
   * It will send a reminder to users that have not completed onboarding after 7 days.
   * It will also send a message to the technical monitoring channel on Slack with the number of users that have not completed onboarding.
   * @param job - Job containing mail data to be sent
   * @returns A message indicating the result of the operation
   */
  async remindUsersNotCompletedOnboarding() {
    const DAY_DELAY_BEFORE_SENDING_REMINDER = 3;

    this.logger.log(
      'Sending reminder to users that have not completed onboarding...'
    );
    const users = await this.usersService.getUsersNotCompletedOnboarding(
      DAY_DELAY_BEFORE_SENDING_REMINDER
    );
    this.logger.log(
      `Found ${users.length} users that have not completed onboarding`
    );

    const results = await Promise.allSettled(
      users.map(async (user) => {
        this.logger.log(`Sending reminder to user ${user.id}`);
        await this.usersService.sendReminderToCompleteOnboarding(user);
      })
    );

    const { succeeded, successIds, failures } = collectSettledResults(
      users,
      results,
      (userId, reason) => {
        this.logger.error(`Failed sending reminder to user ${userId}`, reason);
      }
    );

    await this.cronTasksSlackReporterService.sendCronTaskResultToSlack(
      succeeded,
      '📬 Send reminder to users that have not completed onboarding',
      {
        total: users.length,
        success: successIds.length,
        failure: failures.length,
      },
      failures
    );

    if (!succeeded) {
      throw new Error(
        `Failed sending ${failures.length}/${users.length} onboarding reminders`
      );
    }

    return `Reminders sent to ${successIds.length} users that have not completed onboarding`;
  }

  /**
   * Process the job to prepare post-onboarding completion mails.
   * This method is called by the CronService every day at 10 AM.
   * It will prepare mails to be sent to users that have completed onboarding since a specific delay defined for each type of mail.
   * It will also send a message to the technical monitoring channel on Slack with the number of mails prepared for each type of mail.
   * @param job - Job containing data to prepare mails
   * @returns A message indicating the result of the operation
   */
  async preparePostOnboardingCompletionMails() {
    const postOnboardingCompletionConfig = [
      {
        icon: '🧰',
        delaySinceOnboardingCompletion: 1,
        prepareMail: async (user: User) =>
          this.usersService.sendOnboardingBAOMailToUser(user),
        title: 'Send email invitation to discover BAO',
      },
      {
        icon: '🛟',
        delaySinceOnboardingCompletion: 4,
        prepareMail: async (user: User) =>
          this.usersService.sendOnboardingContactAdviceMail(user),
        title: 'Send email with contact advice',
      },
    ];

    await Promise.allSettled(
      postOnboardingCompletionConfig.map(
        async ({
          delaySinceOnboardingCompletion,
          prepareMail,
          title,
          icon,
        }) => {
          this.logger.log(
            `Preparing onboarding completed relationship cycle mail for users that completed onboarding ${delaySinceOnboardingCompletion} days ago...`
          );
          const users =
            await this.usersService.getUsersCompletedOnboardingSinceDelay(
              delaySinceOnboardingCompletion
            );
          this.logger.log(
            `Found ${users.length} users that completed onboarding ${delaySinceOnboardingCompletion} days ago`
          );

          const results = await Promise.allSettled(
            users.map(async (user) => {
              this.logger.log(
                `Preparing onboarding completed relationship cycle mail for user ${user.id}`
              );
              await prepareMail(user);
            })
          );

          const { succeeded, successIds, failures } = collectSettledResults(
            users,
            results,
            (userId, reason) => {
              this.logger.error(
                `Failed preparing onboarding completed relationship cycle mail (${title}) for user ${userId}`,
                reason
              );
            }
          );

          await this.cronTasksSlackReporterService.sendCronTaskResultToSlack(
            succeeded,
            `${icon} Post Onboarding Completion - ${title} - J+${delaySinceOnboardingCompletion}`,
            {
              total: users.length,
              success: successIds.length,
              failure: failures.length,
            },
            failures
          );

          if (!succeeded) {
            this.logger.error(
              `Failed preparing onboarding completed relationship cycle mail for ${failures.length}/${users.length} users that completed onboarding ${delaySinceOnboardingCompletion} days ago`
            );
          }
        }
      )
    );

    return `Preparation of onboarding completed relationship cycle mails started for all configured delays.`;
  }

  async prepareNotCompletedProfileMails() {
    const DAYS_AFTER_ONBOARDING_COMPLETION = 5;

    this.logger.log(
      `Preparing mails for users that have not completed their profile...`
    );
    const userProfileNotCompleted =
      await this.usersService.getUsersWithNotCompletedProfile(
        DAYS_AFTER_ONBOARDING_COMPLETION
      );
    this.logger.log(
      `Found ${userProfileNotCompleted.length} users that have not completed their profile`
    );
    const results = await Promise.allSettled(
      userProfileNotCompleted.map(async (user) => {
        this.logger.log(`Preparing mail for user ${user.id}`);
        await this.usersService.sendReminderToCompleteProfile(user);
      })
    );

    const { succeeded, successIds, failures } = collectSettledResults(
      userProfileNotCompleted,
      results,
      (userId, reason) => {
        this.logger.error(
          `Failed preparing mail for user ${userId} that has not completed profile ${DAYS_AFTER_ONBOARDING_COMPLETION} days after onboarding completion`,
          reason
        );
      }
    );

    await this.cronTasksSlackReporterService.sendCronTaskResultToSlack(
      succeeded,
      `📋 Profile not completed reminder - J+${DAYS_AFTER_ONBOARDING_COMPLETION}`,
      {
        total: userProfileNotCompleted.length,
        success: successIds.length,
        failure: failures.length,
      },
      failures
    );

    if (!succeeded) {
      this.logger.error(
        `Failed preparing mail for ${failures.length}/${userProfileNotCompleted.length} users that have not completed their profile ${DAYS_AFTER_ONBOARDING_COMPLETION} days after onboarding completion`
      );
    }

    return `Preparation of ${userProfileNotCompleted.length} mails for users that have not completed their profile started.`;
  }

  async prepareUserWithoutResponseToFirstMessageMails() {
    const DAYS_SINCE_FIRST_MESSAGE_SENT = 5;

    this.logger.log(
      `Preparing mails for users that have no response to their first message...`
    );
    const usersWithoutResponseToFirstMessageResults =
      await this.usersService.getUsersWithNoResponseToFirstMessage(
        DAYS_SINCE_FIRST_MESSAGE_SENT
      );

    this.logger.log(
      `Found ${usersWithoutResponseToFirstMessageResults.length} users that have no response to their first message`
    );

    this.logger.log(
      `Preparing mails for ${usersWithoutResponseToFirstMessageResults.length} users that have no response to their first message...`
    );
    const results = await Promise.allSettled(
      usersWithoutResponseToFirstMessageResults.map(async (dto) => {
        this.logger.log(
          `Preparing mail for user ${dto.user.id} that have no response to their first message`
        );
        return await this.usersService.sendMailForNoResponseToFirstMessage(dto);
      })
    );

    const { succeeded, successIds, failures } = collectSettledResults(
      usersWithoutResponseToFirstMessageResults,
      results,
      (userId, reason) => {
        this.logger.error(
          `Failed preparing mail for user ${userId} that have no response to their first message ${DAYS_SINCE_FIRST_MESSAGE_SENT} days after sending the first message`,
          reason
        );
      }
    );

    await this.cronTasksSlackReporterService.sendCronTaskResultToSlack(
      succeeded,
      `📩 No response to first message reminder - J+${DAYS_SINCE_FIRST_MESSAGE_SENT}`,
      {
        total: usersWithoutResponseToFirstMessageResults.length,
        success: successIds.length,
        failure: failures.length,
      },
      failures
    );

    if (!succeeded) {
      this.logger.error(
        `Failed preparing mail for ${failures.length}/${usersWithoutResponseToFirstMessageResults.length} users that have no response to their first message ${DAYS_SINCE_FIRST_MESSAGE_SENT} days after sending the first message`
      );
    }

    return `Preparation of mails for ${usersWithoutResponseToFirstMessageResults.length} users that have no response to their first message started.`;
  }

  async prepareUserConversationFollowUpMails() {
    const DAYS_SINCE_MUTUAL_REPLY = 15;
    this.logger.log(
      `Preparing follow-up mails for users that have a conversation with mutual replies ongoing since ${DAYS_SINCE_MUTUAL_REPLY} days...`
    );
    const conversationMutuallyReplied =
      await this.messagingService.getAllMutuallyRepliedConversations(
        DAYS_SINCE_MUTUAL_REPLY
      );

    this.logger.log(
      `Found ${conversationMutuallyReplied.length} conversations with mutual replies`
    );

    // Ensure participants are fully loaded with required relations (e.g., company)
    const participantIds = Array.from(
      new Set(
        conversationMutuallyReplied.flatMap((conversation) =>
          conversation.participants.map((participant) => participant.id)
        )
      )
    );

    const participantsWithRelations =
      participantIds.length > 0
        ? await this.usersService.findByIdsWithRelations(participantIds)
        : [];

    const participantsById = new Map<string, User>(
      participantsWithRelations.map((user) => [user.id, user])
    );

    const followUpMailJobs = conversationMutuallyReplied.flatMap(
      (conversation) =>
        conversation.participants.map((participant) => {
          const hydratedParticipant =
            participantsById.get(participant.id) ?? participant;

          return {
            id: `${conversation.id}:${hydratedParticipant.id}`,
            user: hydratedParticipant,
            conversation,
          };
        })
    );

    const results = await Promise.allSettled(
      followUpMailJobs.map(async (job) => {
        this.logger.log(
          `Preparing follow-up mail for user ${job.user.id} with ongoing conversation ${job.conversation.id} mutually replied since ${DAYS_SINCE_MUTUAL_REPLY} days`
        );
        return await this.usersService.sendFollowUpMailForMutuallyRepliedConversation(
          job.user,
          job.conversation
        );
      })
    );

    const { succeeded, successIds, failures } = collectSettledResults(
      followUpMailJobs,
      results,
      (jobId, reason) => {
        const [conversationId, userId] = String(jobId).split(':');
        this.logger.error(
          `Failed preparing follow-up mail for user ${userId} with conversation ${conversationId} (${DAYS_SINCE_MUTUAL_REPLY} days after mutual reply stage)`,
          reason
        );
      }
    );

    await this.cronTasksSlackReporterService.sendCronTaskResultToSlack(
      succeeded,
      `📬 Conversation follow-up - J+${DAYS_SINCE_MUTUAL_REPLY}`,
      {
        total: followUpMailJobs.length,
        success: successIds.length,
        failure: failures.length,
      },
      failures
    );

    if (!succeeded) {
      this.logger.error(
        `Failed preparing follow-up mail for ${failures.length}/${followUpMailJobs.length} follow-up emails ${DAYS_SINCE_MUTUAL_REPLY} days after mutual reply stage`
      );
    }

    return `Preparation of follow-up mails for ${followUpMailJobs.length} users-conversations pairs started.`;
  }

  async prepareRecommendationMails() {
    const DAYS_TO_CONTACT = [10, 20, 30];
    const BATCH_SIZE = 3; // Process in small batches to limit concurrent calls

    this.logger.log(
      `Preparing recommendation mails for users inactive since ${DAYS_TO_CONTACT.join(
        ', '
      )} days...`
    );

    let totalUsers = 0;
    let totalSuccess = 0;
    let totalNotEnoughReco = 0;
    let totalFailures = 0;

    for (const days of DAYS_TO_CONTACT) {
      this.logger.log(
        `Fetching users inactive for ${days} days for recommendation mail...`
      );

      const users =
        await this.usersService.getUsersInactiveForRecommendationMails(days);

      this.logger.log(`Found ${users.length} users inactive for ${days} days`);

      for (const batch of chunk(users, BATCH_SIZE)) {
        const batchResults = await Promise.allSettled(
          batch.map(async (user) => {
            totalUsers++;

            const userWithRelations =
              await this.usersService.findOneWithRelations(user.id);

            const userProfile = await this.userProfilesService.findOneByUserId(
              user.id
            );

            if (!userWithRelations || !userProfile) {
              totalNotEnoughReco++;
              this.logger.log(
                `Skipping user ${user.id}: missing data (${
                  !userWithRelations ? 'user with relations' : ''
                }${!userWithRelations && !userProfile ? ' & ' : ''}${
                  !userProfile ? 'user profile' : ''
                })`
              );
              return;
            }

            const userRecommendations =
              await this.userProfileRecommendationsService.retrieveOrComputeRecommendationsForUserIdIA(
                userWithRelations,
                userProfile,
                3
              );

            if (userRecommendations.length < 3) {
              totalNotEnoughReco++;
              this.logger.log(
                `Skipping user ${user.id}: only ${userRecommendations.length} recommendations found (need 3)`
              );
              return;
            }

            await this.usersService.sendRecommendationsMail(
              userWithRelations,
              userRecommendations
            );
            totalSuccess++;
          })
        );

        batchResults.forEach((result, index) => {
          if (result.status === 'rejected') {
            totalFailures++;
            this.logger.error(
              `Failed preparing recommendation mail for user ${batch[index]?.id}`,
              result.reason
            );
          }
        });
      }
    }

    const succeeded = totalFailures === 0;

    await this.cronTasksSlackReporterService.sendCronTaskResultToSlack(
      succeeded,
      `👬 Users recommendation emails - J+${DAYS_TO_CONTACT.join('/')}`,
      {
        total: totalUsers,
        success: totalSuccess,
        failure: totalFailures + totalNotEnoughReco,
      },
      []
    );

    return `Recommendation mails sent: ${totalSuccess} success, ${totalNotEnoughReco} skipped (not enough recos), ${totalFailures} errors.`;
  }

  async prepareAutoSetUnavailableUsers() {
    const DAYS_WITHOUT_CONNECTION = 60;
    const DAYS_WITH_UNREAD_MESSAGE = 30;

    this.logger.log(
      `Setting inactive users as unavailable (no connection since ${DAYS_WITHOUT_CONNECTION} days, unread message since ${DAYS_WITH_UNREAD_MESSAGE} days)...`
    );

    const inactiveUsersRows =
      await this.messagingService.getInactiveUsersWithUnreadConversations(
        DAYS_WITHOUT_CONNECTION,
        DAYS_WITH_UNREAD_MESSAGE
      );

    this.logger.log(
      `Found ${inactiveUsersRows.length} inactive users to set as unavailable`
    );

    const userIds = inactiveUsersRows.map((row) => row.id);
    const users =
      userIds.length > 0
        ? await this.usersService.findByIdsWithRelations(userIds)
        : [];

    const BATCH_SIZE = 50;
    const results: PromiseSettledResult<void>[] = [];

    for (const userChunk of chunk(users, BATCH_SIZE)) {
      const batchResults = await Promise.allSettled(
        userChunk.map(async (user) => {
          this.logger.log(
            `Setting user ${user.id} as unavailable due to inactivity`
          );
          await this.userProfilesService.setUserAsUnavailableDueToInactivity(
            user
          );
        })
      );

      results.push(...batchResults);
    }
    const { succeeded, successIds, failures } = collectSettledResults(
      users,
      results,
      (userId, reason) => {
        this.logger.error(
          `Failed setting user ${userId} as unavailable due to inactivity`,
          reason
        );
      }
    );

    await this.cronTasksSlackReporterService.sendCronTaskResultToSlack(
      succeeded,
      '🔕 Auto set inactive users as unavailable',
      {
        total: users.length,
        success: successIds.length,
        failure: failures.length,
      },
      failures
    );

    if (!succeeded) {
      throw new Error(
        `Failed setting ${failures.length}/${users.length} inactive users as unavailable`
      );
    }

    return `Set ${successIds.length} inactive users as unavailable`;
  }

  /**
   * Sends a reminder email to all coaches whose "Super Engagé" badge expires in
   * exactly 30 days. Called daily at 10 AM via the cron job.
   */
  async prepareSuperEngagedAchievementReminderMails() {
    this.logger.log('Preparing Super Engaged achievement reminder mails...');
    const { total, sent, failures } =
      await this.gamificationService.prepareExpirationReminderMails();
    this.logger.log('Super Engaged achievement reminder mails prepared');

    const succeeded = failures.length === 0;

    await this.cronTasksSlackReporterService.sendCronTaskResultToSlack(
      succeeded,
      '🔔 Super Engaged — reminder mails (30j avant expiration)',
      {
        total,
        success: sent,
        failure: failures.length,
      },
      failures
    );

    if (!succeeded) {
      throw new Error(
        `Failed sending ${failures.length}/${total} Super Engaged reminder mails`
      );
    }

    return `Sent ${sent}/${total} Super Engaged achievement reminder mails`;
  }

  /**
   * Processes all expired badges in a single pass: renews those whose users are
   * still eligible, expires the rest. Called daily at 3 AM via the cron job.
   */
  async processExpiredAchievements() {
    this.logger.log('Processing expired achievements...');
    const { total, renewed, expired, failures } =
      await this.gamificationService.processExpiredAchievements();
    this.logger.log('Expired achievements processed');

    const succeeded = failures.length === 0;

    await this.cronTasksSlackReporterService.sendCronTaskResultToSlack(
      succeeded,
      '🏆 Process expired achievements',
      {
        total,
        success: renewed + expired,
        failure: failures.length,
      },
      failures
    );

    if (!succeeded) {
      throw new Error(
        `Failed processing ${failures.length}/${total} expired achievements`
      );
    }

    return `Processed ${total} expired achievements: ${renewed} renewed, ${expired} expired`;
  }

  async prepareRecruitmentAlertsMails() {
    this.logger.log('Preparing recruitment alerts mails...');
    const recruitementAlerts = await this.recruitementAlertsService.findAll();
    const alertsToSend: {
      companyAdminEmail: string;
      firstName: string;
      newCandidatesCount: number;
      alertName: string;
      alertId: string;
      zone: string;
      staffContact: User['staffContact'];
    }[] = [];

    for (const alert of recruitementAlerts) {
      const matchingUsers =
        await this.recruitementAlertsService.getRecruitementAlertMatching(
          alert.id
        );
      if (matchingUsers.length === 0) continue;

      const alreadyNotifiedUserIds = await this.recruitementAlertsService
        .findRecruitementAlertNotifiedCandidate(alert.id)
        .then((notified) => notified.map((c) => c.userId));

      const newMatchingUsers = matchingUsers.filter(
        (user) => !alreadyNotifiedUserIds.includes(user.id)
      );
      if (newMatchingUsers.length === 0) continue;

      const companyAdmin = alert.company.companyUsers.find((cu) => cu.isAdmin);
      if (!companyAdmin) continue;

      const adminUser = await this.usersService.findOneWithRelations(
        companyAdmin.userId
      );
      if (!adminUser) continue;

      alertsToSend.push({
        alertId: alert.id,
        alertName: alert.name,
        newCandidatesCount: newMatchingUsers.length,
        companyAdminEmail: adminUser.email,
        firstName: adminUser.firstName,
        zone: getZoneNameFromDepartment(adminUser.userProfile?.department),
        staffContact: adminUser.staffContact,
      });

      await this.recruitementAlertsService.markUsersAsNotified(
        alert.id,
        newMatchingUsers.map((user) => user.id)
      );
    }

    this.logger.log(`Found ${alertsToSend.length} recruitment alerts to send`);
    const results = await Promise.allSettled(
      alertsToSend.map(async (alert) => {
        this.logger.log(
          `Sending recruitment alert mail to ${alert.companyAdminEmail}`
        );
        await this.usersService.sendRecruitmentAlertMail(alert);
      })
    );

    const { succeeded, successIds, failures } = collectSettledResults(
      alertsToSend.map((a) => ({ id: a.alertId })),
      results,
      (alertId, reason) => {
        this.logger.error(
          `Failed sending recruitment alert mail for alert ${alertId}`,
          reason
        );
      }
    );

    await this.cronTasksSlackReporterService.sendCronTaskResultToSlack(
      succeeded,
      '🤝 Recruitment alerts',
      {
        total: alertsToSend.length,
        success: successIds.length,
        failure: failures.length,
      },
      failures
    );

    if (!succeeded) {
      throw new Error(
        `Failed sending ${failures.length}/${alertsToSend.length} recruitment alert mails`
      );
    }

    return `Sent ${successIds.length} recruitment alert mails`;
  }

  async prepareCompanyNoAlertsReminderMails() {
    this.logger.log('Preparing company no alerts reminder mails...');
    const rows =
      await this.usersService.getCompanyAdminIdsForNoAlertsReminder();
    this.logger.log(`Found ${rows.length} company admins without alerts`);

    const results = await Promise.allSettled(
      rows.map(async ({ adminId }) => {
        const admin = await this.usersService.findOneWithRelations(adminId);
        if (!admin) return;
        this.logger.log(
          `Sending company no alerts reminder mail to ${admin.email}`
        );
        await this.usersService.sendCompanyNoAlertsReminderMail(admin);
      })
    );

    const { succeeded, successIds, failures } = collectSettledResults(
      rows.map((r) => ({ id: r.adminId })),
      results,
      (adminId, reason) => {
        this.logger.error(
          `Failed sending company no alerts reminder mail to admin ${adminId}`,
          reason
        );
      }
    );

    await this.cronTasksSlackReporterService.sendCronTaskResultToSlack(
      succeeded,
      '🏢 Company no alerts reminder',
      {
        total: rows.length,
        success: successIds.length,
        failure: failures.length,
      },
      failures
    );

    if (!succeeded) {
      throw new Error(
        `Failed sending ${failures.length}/${rows.length} company no alerts reminder mails`
      );
    }

    return `Sent ${successIds.length} company no alerts reminder mails`;
  }

  async prepareReferedNotActivatedMails() {
    const DAYS_SINCE_CREATION = 15;
    this.logger.log('Preparing refered not activated mails...');
    const rows = await this.usersService.getReferedNotActivatedData(
      DAYS_SINCE_CREATION
    );
    this.logger.log(`Found ${rows.length} inactive refered candidates`);

    const results = await Promise.allSettled(
      rows.map(async (row) => {
        const refererUser = await this.usersService.findOneWithRelations(
          row.refererId
        );
        if (!refererUser) return;
        this.logger.log(
          `Sending refered not activated mail to referer ${refererUser.email}`
        );
        await this.usersService.sendReferedNotActivatedMail(refererUser, {
          candidateEmail: row.candidateEmail,
          candidateFirstName: row.candidateFirstName,
          candidateLastName: row.candidateLastName,
        });
      })
    );

    const { succeeded, successIds, failures } = collectSettledResults(
      rows.map((r) => ({ id: r.refererId })),
      results,
      (refererId, reason) => {
        this.logger.error(
          `Failed sending refered not activated mail for referer ${refererId}`,
          reason
        );
      }
    );

    await this.cronTasksSlackReporterService.sendCronTaskResultToSlack(
      succeeded,
      `🤷 Refered not activated - J+${DAYS_SINCE_CREATION}`,
      {
        total: rows.length,
        success: successIds.length,
        failure: failures.length,
      },
      failures
    );

    if (!succeeded) {
      throw new Error(
        `Failed sending ${failures.length}/${rows.length} refered not activated mails`
      );
    }

    return `Sent ${successIds.length} refered not activated mails`;
  }

  async prepareRemindCompanyInvitationMails() {
    const DAYS_SINCE_REGISTRATION = 3;
    this.logger.log('Preparing remind company invitation mails...');
    const rows = await this.usersService.getCompanyAdminIdsForRemindInvitation(
      DAYS_SINCE_REGISTRATION
    );
    this.logger.log(
      `Found ${rows.length} company admins without invitations sent`
    );

    const results = await Promise.allSettled(
      rows.map(async ({ adminId }) => {
        const admin = await this.usersService.findOneWithRelations(adminId);
        if (!admin) return;
        this.logger.log(
          `Sending remind company invitation mail to ${admin.email}`
        );
        await this.usersService.sendRemindCompanyInvitationMail(admin);
      })
    );

    const { succeeded, successIds, failures } = collectSettledResults(
      rows.map((r) => ({ id: r.adminId })),
      results,
      (adminId, reason) => {
        this.logger.error(
          `Failed sending remind company invitation mail to admin ${adminId}`,
          reason
        );
      }
    );

    await this.cronTasksSlackReporterService.sendCronTaskResultToSlack(
      succeeded,
      `📨 Remind company invitation - J+${DAYS_SINCE_REGISTRATION}`,
      {
        total: rows.length,
        success: successIds.length,
        failure: failures.length,
      },
      failures
    );

    if (!succeeded) {
      throw new Error(
        `Failed sending ${failures.length}/${rows.length} remind company invitation mails`
      );
    }

    return `Sent ${successIds.length} remind company invitation mails`;
  }

  async prepareCompanyInvitationsPendingMails() {
    const DAYS_SINCE_INVITATION = 7;
    this.logger.log('Preparing company invitations pending mails...');
    const rows = await this.usersService.getCompanyInvitationPendingData(
      DAYS_SINCE_INVITATION
    );
    this.logger.log(`Found ${rows.length} pending company invitations`);

    const results = await Promise.allSettled(
      rows.map(async (row) => {
        const admin = await this.usersService.findOneWithRelations(row.adminId);
        if (!admin) return;
        this.logger.log(
          `Sending company invitations pending mail to ${admin.email}`
        );
        await this.usersService.sendCompanyInvitationPendingMail(
          admin,
          row.invitationEmail,
          row.companyId
        );
      })
    );

    const { succeeded, successIds, failures } = collectSettledResults(
      rows.map((r) => ({ id: r.adminId })),
      results,
      (adminId, reason) => {
        this.logger.error(
          `Failed sending company invitations pending mail to admin ${adminId}`,
          reason
        );
      }
    );

    await this.cronTasksSlackReporterService.sendCronTaskResultToSlack(
      succeeded,
      `⏳ Company invitations pending - J+${DAYS_SINCE_INVITATION}`,
      {
        total: rows.length,
        success: successIds.length,
        failure: failures.length,
      },
      failures
    );

    if (!succeeded) {
      throw new Error(
        `Failed sending ${failures.length}/${rows.length} company invitations pending mails`
      );
    }

    return `Sent ${successIds.length} company invitations pending mails`;
  }

  async prepareNotCompletedCompanyMails() {
    const DAYS_SINCE_CREATION = 4;
    this.logger.log('Preparing not completed company mails...');
    const rows =
      await this.usersService.getCompanyAdminDataForNotCompletedCompany(
        DAYS_SINCE_CREATION
      );
    this.logger.log(
      `Found ${rows.length} company admins with incomplete company profiles`
    );

    const results = await Promise.allSettled(
      rows.map(async (row) => {
        const admin = await this.usersService.findOneWithRelations(row.adminId);
        if (!admin) return;
        this.logger.log(`Sending not completed company mail to ${admin.email}`);
        await this.usersService.sendNotCompletedCompanyMail(
          admin,
          row.companyName
        );
      })
    );

    const { succeeded, successIds, failures } = collectSettledResults(
      rows.map((r) => ({ id: r.adminId })),
      results,
      (adminId, reason) => {
        this.logger.error(
          `Failed sending not completed company mail to admin ${adminId}`,
          reason
        );
      }
    );

    await this.cronTasksSlackReporterService.sendCronTaskResultToSlack(
      succeeded,
      `🏗️ Not completed company - J+${DAYS_SINCE_CREATION}`,
      {
        total: rows.length,
        success: successIds.length,
        failure: failures.length,
      },
      failures
    );

    if (!succeeded) {
      throw new Error(
        `Failed sending ${failures.length}/${rows.length} not completed company mails`
      );
    }

    return `Sent ${successIds.length} not completed company mails`;
  }

  async prepareCompanyCollabFollowMails() {
    this.logger.log('Preparing company collab follow mails...');
    const rows = await this.usersService.getCompanyAdminDataForCollabFollow();
    this.logger.log(
      `Found ${rows.length} company admins whose first collaborator sent a message today`
    );

    const results = await Promise.allSettled(
      rows.map(async (row) => {
        const admin = await this.usersService.findOneWithRelations(row.adminId);
        if (!admin) return;
        this.logger.log(`Sending company collab follow mail to ${admin.email}`);
        await this.usersService.sendCompanyCollabFollowMail(
          admin,
          row.companyId,
          row.companyName
        );
      })
    );

    const { succeeded, successIds, failures } = collectSettledResults(
      rows.map((r) => ({ id: r.adminId })),
      results,
      (adminId, reason) => {
        this.logger.error(
          `Failed sending company collab follow mail to admin ${adminId}`,
          reason
        );
      }
    );

    await this.cronTasksSlackReporterService.sendCronTaskResultToSlack(
      succeeded,
      '🤝 Company collab follow',
      {
        total: rows.length,
        success: successIds.length,
        failure: failures.length,
      },
      failures
    );

    if (!succeeded) {
      throw new Error(
        `Failed sending ${failures.length}/${rows.length} company collab follow mails`
      );
    }

    return `Sent ${successIds.length} company collab follow mails`;
  }

  async prepareCommittedUsersFeedbackMails() {
    const DAYS_SINCE_FIRST_MESSAGE = 40;
    this.logger.log('Preparing committed users feedback mails...');
    const rows = await this.usersService.getUserIdsForCommittedFeedback(
      DAYS_SINCE_FIRST_MESSAGE
    );
    this.logger.log(`Found ${rows.length} users for committed feedback email`);

    const results = await Promise.allSettled(
      rows.map(async ({ id }) => {
        const user = await this.usersService.findOneWithRelations(id);
        if (!user) return;
        this.logger.log(
          `Sending committed users feedback mail to ${user.email}`
        );
        await this.usersService.sendCommittedUsersFeedbackMail(user);
      })
    );

    const { succeeded, successIds, failures } = collectSettledResults(
      rows,
      results,
      (userId, reason) => {
        this.logger.error(
          `Failed sending committed users feedback mail to user ${userId}`,
          reason
        );
      }
    );

    await this.cronTasksSlackReporterService.sendCronTaskResultToSlack(
      succeeded,
      `💬 Committed users feedback - J+${DAYS_SINCE_FIRST_MESSAGE}`,
      {
        total: rows.length,
        success: successIds.length,
        failure: failures.length,
      },
      failures
    );

    if (!succeeded) {
      throw new Error(
        `Failed sending ${failures.length}/${rows.length} committed users feedback mails`
      );
    }

    return `Sent ${successIds.length} committed users feedback mails`;
  }

  async prepareUnreadConversationsMails() {
    const DAYS_TO_CONTACT = [4, 20];
    this.logger.log(
      `Preparing unread conversations mails for days ${DAYS_TO_CONTACT.join(
        ', '
      )}...`
    );

    let total = 0;
    let totalSuccess = 0;
    const allFailures: SettledFailure[] = [];

    for (const days of DAYS_TO_CONTACT) {
      const rows = await this.usersService.getUserRowsForUnreadConversations(
        days
      );
      this.logger.log(
        `Found ${rows.length} users with unread conversations since ${days} days`
      );
      total += rows.length;

      const results = await Promise.allSettled(
        rows.map(async (row) => {
          const user = await this.usersService.findOneWithRelations(row.id);
          if (!user) return;
          await this.usersService.sendUnreadConversationsMail(
            user,
            Number(row.unreadConversationsCount),
            days
          );
        })
      );

      const { successIds, failures } = collectSettledResults(
        rows,
        results,
        (userId, reason) => {
          this.logger.error(
            `Failed sending unread conversations mail to user ${userId}`,
            reason
          );
        }
      );
      totalSuccess += successIds.length;
      allFailures.push(...failures);
    }

    const succeeded = allFailures.length === 0;

    await this.cronTasksSlackReporterService.sendCronTaskResultToSlack(
      succeeded,
      `📫 Unread conversations - J+${DAYS_TO_CONTACT.join('/')}`,
      { total, success: totalSuccess, failure: allFailures.length },
      allFailures
    );

    if (!succeeded) {
      throw new Error(
        `Failed sending ${allFailures.length}/${total} unread conversations mails`
      );
    }

    return `Sent ${totalSuccess} unread conversations mails`;
  }

  async prepareUnavailableUsersMails() {
    const DAYS_SINCE_LAST_CONVERSATION = 30;
    this.logger.log('Preparing unavailable users mails...');
    const rows = await this.usersService.getUserRowsForUnavailableUsers(
      DAYS_SINCE_LAST_CONVERSATION
    );
    this.logger.log(
      `Found ${rows.length} users eligible for unavailable reminder`
    );

    const results = await Promise.allSettled(
      rows.map(async (row) => {
        const user = await this.usersService.findOneWithRelations(row.id);
        if (!user) return;
        this.logger.log(`Sending unavailable user mail to ${user.email}`);
        await this.usersService.sendUnavailableUserMail(
          user,
          Number(row.unreadConversationsCount)
        );
      })
    );

    const { succeeded, successIds, failures } = collectSettledResults(
      rows,
      results,
      (userId, reason) => {
        this.logger.error(
          `Failed sending unavailable user mail to user ${userId}`,
          reason
        );
      }
    );

    await this.cronTasksSlackReporterService.sendCronTaskResultToSlack(
      succeeded,
      `📵 Unavailable users - J+${DAYS_SINCE_LAST_CONVERSATION}`,
      {
        total: rows.length,
        success: successIds.length,
        failure: failures.length,
      },
      failures
    );

    if (!succeeded) {
      throw new Error(
        `Failed sending ${failures.length}/${rows.length} unavailable user mails`
      );
    }

    return `Sent ${successIds.length} unavailable user mails`;
  }

  async prepareChurnUsersFeedbackMails() {
    const DAYS_SINCE_LAST_CONNECTION = 60;
    this.logger.log('Preparing churn users feedback mails...');
    const rows = await this.usersService.getUserIdsForChurnFeedback(
      DAYS_SINCE_LAST_CONNECTION
    );
    this.logger.log(
      `Found ${rows.length} inactive users for churn feedback email`
    );

    const results = await Promise.allSettled(
      rows.map(async ({ id }) => {
        const user = await this.usersService.findOneWithRelations(id);
        if (!user) return;
        this.logger.log(`Sending churn users feedback mail to ${user.email}`);
        await this.usersService.sendChurnUsersFeedbackMail(user);
      })
    );

    const { succeeded, successIds, failures } = collectSettledResults(
      rows,
      results,
      (userId, reason) => {
        this.logger.error(
          `Failed sending churn users feedback mail to user ${userId}`,
          reason
        );
      }
    );

    await this.cronTasksSlackReporterService.sendCronTaskResultToSlack(
      succeeded,
      `😴 Churn users feedback - J+${DAYS_SINCE_LAST_CONNECTION}`,
      {
        total: rows.length,
        success: successIds.length,
        failure: failures.length,
      },
      failures
    );

    if (!succeeded) {
      throw new Error(
        `Failed sending ${failures.length}/${rows.length} churn users feedback mails`
      );
    }

    return `Sent ${successIds.length} churn users feedback mails`;
  }

  async prepareInactiveReferersMails() {
    const DAYS_SINCE_CREATION = 15;
    this.logger.log('Preparing inactive referers mails...');
    const rows = await this.usersService.getUserIdsForInactiveReferers(
      DAYS_SINCE_CREATION
    );
    this.logger.log(`Found ${rows.length} inactive referers`);

    const results = await Promise.allSettled(
      rows.map(async ({ id }) => {
        const user = await this.usersService.findOneWithRelations(id);
        if (!user) return;
        this.logger.log(`Sending inactive referer mail to ${user.email}`);
        await this.usersService.sendInactiveRefererMail(user);
      })
    );

    const { succeeded, successIds, failures } = collectSettledResults(
      rows,
      results,
      (userId, reason) => {
        this.logger.error(
          `Failed sending inactive referer mail to user ${userId}`,
          reason
        );
      }
    );

    await this.cronTasksSlackReporterService.sendCronTaskResultToSlack(
      succeeded,
      `🔇 Inactive referers - J+${DAYS_SINCE_CREATION}`,
      {
        total: rows.length,
        success: successIds.length,
        failure: failures.length,
      },
      failures
    );

    if (!succeeded) {
      throw new Error(
        `Failed sending ${failures.length}/${rows.length} inactive referer mails`
      );
    }

    return `Sent ${successIds.length} inactive referer mails`;
  }

  async prepareMessagingFeedbackMails() {
    const MESSAGING_DAYS = 30;
    this.logger.log('Preparing messaging feedback mails...');
    const rows = await this.usersService.getUserTriplesForMessagingFeedback(
      MESSAGING_DAYS
    );
    this.logger.log(
      `Found ${rows.length} user-conversation pairs for messaging feedback`
    );

    const results = await Promise.allSettled(
      rows.map(async (row) => {
        const user = await this.usersService.findOneWithRelations(row.userId);
        if (!user) return;
        this.logger.log(`Sending messaging feedback mail to ${user.email}`);
        await this.usersService.sendMessagingFeedbackMail(
          user,
          row.interlocutorFirstName,
          row.interlocutorId
        );
      })
    );

    const { succeeded, successIds, failures } = collectSettledResults(
      rows.map((r) => ({ id: r.userId })),
      results,
      (userId, reason) => {
        this.logger.error(
          `Failed sending messaging feedback mail to user ${userId}`,
          reason
        );
      }
    );

    await this.cronTasksSlackReporterService.sendCronTaskResultToSlack(
      succeeded,
      `🚦 Messaging feedback - J+${MESSAGING_DAYS}`,
      {
        total: rows.length,
        success: successIds.length,
        failure: failures.length,
      },
      failures
    );

    if (!succeeded) {
      throw new Error(
        `Failed sending ${failures.length}/${rows.length} messaging feedback mails`
      );
    }

    return `Sent ${successIds.length} messaging feedback mails`;
  }

  async prepareWarnAccountDeletionMails() {
    const MONTHS_SINCE_LAST_CONNECTION = 23;
    this.logger.log('Preparing warn account deletion mails...');
    const rows = await this.usersService.getUserIdsForWarnAccountDeletion(
      MONTHS_SINCE_LAST_CONNECTION
    );
    this.logger.log(
      `Found ${rows.length} users to warn about account deletion`
    );

    const results = await Promise.allSettled(
      rows.map(async ({ id }) => {
        const user = await this.usersService.findOneWithRelations(id);
        if (!user) return;
        this.logger.log(`Sending warn account deletion mail to ${user.email}`);
        await this.usersService.sendWarnAccountDeletionMail(user);
      })
    );

    const { succeeded, successIds, failures } = collectSettledResults(
      rows,
      results,
      (userId, reason) => {
        this.logger.error(
          `Failed sending warn account deletion mail to user ${userId}`,
          reason
        );
      }
    );

    await this.cronTasksSlackReporterService.sendCronTaskResultToSlack(
      succeeded,
      `⚠️ Warn account deletion - M+${MONTHS_SINCE_LAST_CONNECTION}`,
      {
        total: rows.length,
        success: successIds.length,
        failure: failures.length,
      },
      failures
    );

    if (!succeeded) {
      throw new Error(
        `Failed sending ${failures.length}/${rows.length} warn account deletion mails`
      );
    }

    return `Sent ${successIds.length} warn account deletion mails`;
  }
}
