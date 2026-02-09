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
import { SlackService } from 'src/external-services/slack/slack.service';
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
    private slackService: SlackService
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
        await this.usersDeletionService.deleteCompleteUser(user as User);
        return user.id;
      })
    );

    const deletedUserIds: Array<string | number> = [];
    const failedDeletions: Array<{
      userId: string | number;
      reason: unknown;
    }> = [];

    results.forEach((result, index) => {
      const userId = inactiveUsers[index]?.id;
      if (result.status === 'fulfilled') {
        deletedUserIds.push(result.value);
        return;
      }

      failedDeletions.push({ userId, reason: result.reason });
      this.logger.error(`Failed deleting user ${userId}`, result.reason);
    });

    const successCount = deletedUserIds.length;
    const failureCount = failedDeletions.length;
    const totalToDelete = inactiveUsers.length;
    const isSuccess = failureCount === 0;

    const failedUserIdsPreview = failedDeletions
      .slice(0, 10)
      .map(({ userId }) => `- ${userId}`)
      .join('\n');
    const failedReasonsPreview = failedDeletions
      .slice(0, 10)
      .map(({ userId, reason }) => `- ${userId}: ${String(reason)}`)
      .join('\n');

    const details = isSuccess
      ? `${successCount} users have been deleted due to inactivity`
      : [
          `Some users could not be deleted.`,
          `Total to delete: ${totalToDelete}`,
          `Deleted: ${successCount}`,
          `Failed: ${failureCount}`,
          failedUserIdsPreview
            ? `Failed user IDs (first 10):\n${failedUserIdsPreview}`
            : undefined,
          failedReasonsPreview
            ? `Errors (first 10):\n${failedReasonsPreview}`
            : undefined,
        ]
          .filter(Boolean)
          .join('\n');

    await this.slackService.sendTechnicalMonitoringMessage(
      isSuccess,
      '🗑️ Delete inactive users',
      [
        {
          title: 'Users to delete',
          content: `${totalToDelete}`,
        },
        {
          title: 'Deleted successfully',
          content: `${successCount}`,
        },
        {
          title: 'Failed deletions',
          content: `${failureCount}`,
        },
      ],
      details
    );

    if (!isSuccess) {
      throw new Error(
        `Failed deleting ${failureCount}/${totalToDelete} inactive users`
      );
    }

    return `Deleted ${successCount} inactive users`;
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
        return user.id;
      })
    );

    const remindedUserIds: Array<string | number> = [];
    const failedReminders: Array<{
      userId: string | number;
      reason: unknown;
    }> = [];

    results.forEach((result, index) => {
      const userId = users[index]?.id;
      if (result.status === 'fulfilled') {
        remindedUserIds.push(result.value);
        return;
      }

      failedReminders.push({ userId, reason: result.reason });
      this.logger.error(
        `Failed sending reminder to user ${userId}`,
        result.reason
      );
    });

    const successCount = remindedUserIds.length;
    const failureCount = failedReminders.length;
    const totalToRemind = users.length;
    const isSuccess = failureCount === 0;

    const failedUserIdsPreview = failedReminders
      .slice(0, 10)
      .map(({ userId }) => `- ${userId}`)
      .join('\n');
    const failedReasonsPreview = failedReminders
      .slice(0, 10)
      .map(({ userId, reason }) => `- ${userId}: ${String(reason)}`)
      .join('\n');

    const details = isSuccess
      ? `${successCount} users were sent a reminder to complete their onboarding`
      : [
          `Some reminders could not be sent.`,
          `Total to remind: ${totalToRemind}`,
          `Sent successfully: ${successCount}`,
          `Failed: ${failureCount}`,
          failedUserIdsPreview
            ? `Failed user IDs (first 10):\n${failedUserIdsPreview}`
            : undefined,
          failedReasonsPreview
            ? `Errors (first 10):\n${failedReasonsPreview}`
            : undefined,
        ]
          .filter(Boolean)
          .join('\n');

    await this.slackService.sendTechnicalMonitoringMessage(
      isSuccess,
      '🤷‍♂️ Remind user to complete their onboarding',
      [
        {
          title: 'Delay before sending reminder',
          content: `${DAY_DELAY_BEFORE_SENDING_REMINDER} days`,
        },
        {
          title: 'Users to remind',
          content: `${totalToRemind}`,
        },
        {
          title: 'Sent successfully',
          content: `${successCount}`,
        },
        {
          title: 'Failed sends',
          content: `${failureCount}`,
        },
      ],
      details
    );

    if (!isSuccess) {
      throw new Error(
        `Failed sending ${failureCount}/${totalToRemind} onboarding reminders`
      );
    }

    return `Reminders sent to ${successCount} users that have not completed onboarding`;
  }
}
