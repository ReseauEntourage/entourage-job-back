import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { QueuesService } from 'src/queues/producers/queues.service';
import { Jobs } from 'src/queues/queues.types';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(private readonly queuesService: QueuesService) {}

  /**
   * This method is called every 1st day of the month at midnight.
   * It will delete every user that has not been connected for specific amount of months defined.
   */
  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
  async deleteInactiveUsers() {
    this.logger.log('Cron job started: deleteInactiveUsers');
    // Create a job that will be processed by the CronTasksProcessor
    const job = await this.queuesService.addToCronTasksQueue(
      Jobs.DELETE_INACTIVE_USERS,
      {}
    );

    this.logger.log(`Job DELETE_INACTIVE_USERS created (Job ID: ${job.id})`);

    return {
      jobId: job.id,
      status: 'processing',
    };
  }

  /**
   * This method is called every day at 9 AM.
   * This method will create a job to send a reminder to users that have not completed onboarding after a specific delay defined.
   */
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async sendReminderToUserNotCompletedOnboarding() {
    this.logger.log(
      'Cron job started: sendReminderToUserNotCompletedOnboarding'
    );
    // Create a job that will be processed by the CronTasksProcessor
    const job = await this.queuesService.addToCronTasksQueue(
      Jobs.SEND_REMINDER_TO_USER_NOT_COMPLETED_ONBOARDING,
      {}
    );

    this.logger.log(
      `Job SEND_REMINDER_TO_USER_NOT_COMPLETED_ONBOARDING created (Job ID: ${job.id})`
    );

    return {
      jobId: job.id,
      status: 'processing',
    };
  }

  // @Cron(CronExpression.EVERY_DAY_AT_10AM)
  async preparePostOnboardingCompletionMails() {
    this.logger.log('Cron job started: preparePostOnboardingCompletionMails');

    // Create a job that will be processed by the CronTasksProcessor
    const job = await this.queuesService.addToCronTasksQueue(
      Jobs.PREPARE_POST_ONBOARDING_COMPLETION_MAILS,
      {}
    );

    this.logger.log(
      `Job PREPARE_POST_ONBOARDING_COMPLETION_MAILS created (Job ID: ${job.id})`
    );

    return {
      jobId: job.id,
      status: 'processing',
    };
  }

  // @Cron(CronExpression.EVERY_DAY_AT_10AM)
  async prepareNotCompletedProfileMails() {
    this.logger.log('Cron job started: prepareNotCompletedProfileMails');

    // Create a job that will be processed by the CronTasksProcessor
    const job = await this.queuesService.addToCronTasksQueue(
      Jobs.PREPARE_NOT_COMPLETED_PROFILE_MAILS,
      {}
    );

    this.logger.log(
      `Job PREPARE_NOT_COMPLETED_PROFILE_MAILS created (Job ID: ${job.id})`
    );

    return {
      jobId: job.id,
      status: 'processing',
    };
  }
}
