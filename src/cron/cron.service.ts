import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { QueuesService } from 'src/queues/producers/queues.service';
import { Jobs } from 'src/queues/queues.types';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(private readonly queuesService: QueuesService) {}

  /**
   * This method is called every day at 1 AM.
   * It will delete every user that has not been connected for specific amount of months defined.
   */
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
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
}
