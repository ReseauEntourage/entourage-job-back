import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import chunk from 'lodash/chunk';
import { GamificationService } from 'src/gamification/gamification.service';
import { MessagingService } from 'src/messaging/messaging.service';
import { CronTasksSlackReporterService } from 'src/queues/consumers/cron-tasks/cron-tasks-slack-reporter.service';
import { collectSettledResults } from 'src/queues/consumers/cron-tasks/cron-tasks.utils';
import { Jobs, Queues } from 'src/queues/queues.types';
import { UserProfileRecommendationsService } from 'src/user-profiles/recommendations/user-profile-recommendations-ai.service';
import { UserProfilesService } from 'src/user-profiles/user-profiles.service';
import { User } from 'src/users/models';
import { UsersService } from 'src/users/users.service';
import { UsersDeletionService } from 'src/users-deletion/users-deletion.service';

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
    private gamificationService: GamificationService
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
   * Processes all expired badges in a single pass: renews those whose users are
   * still eligible, expires the rest. Called daily at 3 AM via the cron job.
   */
  async processExpiredAchievements() {
    this.logger.log('Processing expired achievements...');
    await this.gamificationService.processExpiredAchievements();
    this.logger.log('Expired achievements processed');
    return 'Expired achievements processed';
  }
}
