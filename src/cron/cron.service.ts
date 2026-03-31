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

  @Cron(CronExpression.EVERY_DAY_AT_10AM)
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

  @Cron(CronExpression.EVERY_DAY_AT_10AM)
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

  @Cron(CronExpression.EVERY_DAY_AT_10AM)
  async prepareUserWithoutResponseToFirstMessageMails() {
    this.logger.log(
      'Cron job started: prepareUserWithoutResponseToFirstMessageMails'
    );

    // Create a job that will be processed by the CronTasksProcessor
    const job = await this.queuesService.addToCronTasksQueue(
      Jobs.PREPARE_USER_WITHOUT_RESPONSE_TO_FIRST_MESSAGE_MAILS,
      {}
    );

    this.logger.log(
      `Job PREPARE_USER_WITHOUT_RESPONSE_TO_FIRST_MESSAGE_MAILS created (Job ID: ${job.id})`
    );

    return {
      jobId: job.id,
      status: 'processing',
    };
  }

  @Cron(CronExpression.EVERY_DAY_AT_10AM)
  async prepareUserConversationFollowUpMails() {
    this.logger.log('Cron job started: prepareUserConversationFollowUpMails');
    // Create a job that will be processed by the CronTasksProcessor
    const job = await this.queuesService.addToCronTasksQueue(
      Jobs.PREPARE_USER_CONVERSATION_FOLLOW_UP_MAILS,
      {}
    );

    this.logger.log(
      `Job PREPARE_USER_CONVERSATION_FOLLOW_UP_MAILS created (Job ID: ${job.id})`
    );

    return {
      jobId: job.id,
      status: 'processing',
    };
  }

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async prepareAutoSetUnavailableUsers() {
    this.logger.log('Cron job started: prepareAutoSetUnavailableUsers');

    const job = await this.queuesService.addToCronTasksQueue(
      Jobs.PREPARE_AUTO_SET_UNAVAILABLE_USERS,
      {}
    );

    this.logger.log(
      `Job PREPARE_AUTO_SET_UNAVAILABLE_USERS created (Job ID: ${job.id})`
    );

    return {
      jobId: job.id,
      status: 'processing',
    };
  }

  /**
   * Processes all expired badges in a single pass: renews those whose users
   * are still eligible, expires the rest. Runs daily at 3 AM.
   */
  @Cron('0 3 * * *')
  async processExpiredAchievements() {
    this.logger.log('Cron job started: processExpiredAchievements');

    const job = await this.queuesService.addToCronTasksQueue(
      Jobs.PROCESS_EXPIRED_ACHIEVEMENTS,
      {}
    );

    this.logger.log(
      `Job PROCESS_EXPIRED_ACHIEVEMENTS created (Job ID: ${job.id})`
    );

    return {
      jobId: job.id,
      status: 'processing',
    };
  }

  @Cron(CronExpression.EVERY_DAY_AT_NOON)
  async prepareRecommendationMails() {
    this.logger.log('Cron job started: prepareRecommendationMails');

    const job = await this.queuesService.addToCronTasksQueue(
      Jobs.PREPARE_RECOMMENDATION_MAILS,
      {}
    );

    this.logger.log(
      `Job PREPARE_RECOMMENDATION_MAILS created (Job ID: ${job.id})`
    );

    return {
      jobId: job.id,
      status: 'processing',
    };
  }
}
