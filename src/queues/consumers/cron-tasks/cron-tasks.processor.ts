import {
  OnQueueActive,
  OnQueueCompleted,
  OnQueueError,
  OnQueueFailed,
  OnQueueWaiting,
  Process,
  Processor,
} from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { CronTasksSlackReporterService } from 'src/queues/consumers/cron-tasks/cron-tasks-slack-reporter.service';
import { collectSettledResults } from 'src/queues/consumers/cron-tasks/cron-tasks.utils';
import { Jobs, Queues } from 'src/queues/queues.types';
import { User } from 'src/users/models';
import { UsersService } from 'src/users/users.service';
import { UsersDeletionService } from 'src/users-deletion/users-deletion.service';

@Processor(Queues.CRON_TASKS)
export class CronTasksProcessor {
  private readonly logger = new Logger(CronTasksProcessor.name);

  constructor(
    private usersService: UsersService,
    private usersDeletionService: UsersDeletionService,
    private cronTasksSlackReporterService: CronTasksSlackReporterService
  ) {}

  @OnQueueActive()
  onActive(job: Job) {
    const timeInQueue = job.processedOn - job.timestamp;
    this.logger.log(
      `Job ${job.id} of type ${job.name} has started after waiting for ${timeInQueue} ms`
    );
  }

  @OnQueueCompleted()
  onCompleted(job: Job, result: string) {
    this.logger.log(
      `Job ${job.id} of type ${job.name} completed with result : "${result}"`
    );
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error) {
    this.logger.error(
      `Job ${job.id} of type ${job.name} failed with error : "${error}"`,
      job.data
    );
  }

  @OnQueueWaiting()
  onWaiting(jobId: number | string) {
    this.logger.log(`Job ${jobId} is waiting to be processed`);
  }

  @OnQueueError()
  onError(error: Error) {
    this.logger.error(`An error occurred on the cron-tasks queue : "${error}"`);
  }

  @Process()
  async process(job: Job) {
    this.logger.error(
      `No process method for this job ${job.id} with data ${JSON.stringify(
        job.data
      )}`
    );
  }

  @Process(Jobs.DELETE_INACTIVE_USERS)
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
  @Process(Jobs.SEND_REMINDER_TO_USER_NOT_COMPLETED_ONBOARDING)
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
  @Process(Jobs.PREPARE_POST_ONBOARDING_COMPLETION_MAILS)
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

  @Process(Jobs.PREPARE_NOT_COMPLETED_PROFILE_MAILS)
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

    return `Preparation of mails for users that have not completed their profile started.`;
  }
}
