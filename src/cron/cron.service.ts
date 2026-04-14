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
   * Sends a reminder email to all coaches whose "Super Engagé" badge expires in
   * exactly 30 days. Runs daily at 10 AM.
   */
  @Cron(CronExpression.EVERY_DAY_AT_10AM)
  async prepareSuperEngagedAchievementReminderMails() {
    this.logger.log(
      'Cron job started: prepareSuperEngagedAchievementReminderMails'
    );

    const job = await this.queuesService.addToCronTasksQueue(
      Jobs.PREPARE_SUPER_ENGAGED_ACHIEVEMENT_REMINDER_MAILS,
      {}
    );

    this.logger.log(
      `Job PREPARE_SUPER_ENGAGED_ACHIEVEMENT_REMINDER_MAILS created (Job ID: ${job.id})`
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
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
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

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async prepareRecruitmentAlertsMails() {
    this.logger.log('Cron job started: prepareRecruitmentAlertsMails');
    const job = await this.queuesService.addToCronTasksQueue(
      Jobs.PREPARE_RECRUITMENT_ALERTS_MAILS,
      {}
    );
    this.logger.log(
      `Job PREPARE_RECRUITMENT_ALERTS_MAILS created (Job ID: ${job.id})`
    );
    return { jobId: job.id, status: 'processing' };
  }

  @Cron('30 8 * * *')
  async prepareCompanyNoAlertsReminderMails() {
    this.logger.log('Cron job started: prepareCompanyNoAlertsReminderMails');
    const job = await this.queuesService.addToCronTasksQueue(
      Jobs.PREPARE_COMPANY_NO_ALERTS_REMINDER_MAILS,
      {}
    );
    this.logger.log(
      `Job PREPARE_COMPANY_NO_ALERTS_REMINDER_MAILS created (Job ID: ${job.id})`
    );
    return { jobId: job.id, status: 'processing' };
  }

  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async prepareReferedNotActivatedMails() {
    this.logger.log('Cron job started: prepareReferedNotActivatedMails');
    const job = await this.queuesService.addToCronTasksQueue(
      Jobs.PREPARE_REFERED_NOT_ACTIVATED_MAILS,
      {}
    );
    this.logger.log(
      `Job PREPARE_REFERED_NOT_ACTIVATED_MAILS created (Job ID: ${job.id})`
    );
    return { jobId: job.id, status: 'processing' };
  }

  @Cron('5 9 * * *')
  async prepareRemindCompanyInvitationMails() {
    this.logger.log('Cron job started: prepareRemindCompanyInvitationMails');
    const job = await this.queuesService.addToCronTasksQueue(
      Jobs.PREPARE_REMIND_COMPANY_INVITATION_MAILS,
      {}
    );
    this.logger.log(
      `Job PREPARE_REMIND_COMPANY_INVITATION_MAILS created (Job ID: ${job.id})`
    );
    return { jobId: job.id, status: 'processing' };
  }

  @Cron('10 9 * * *')
  async prepareCompanyInvitationsPendingMails() {
    this.logger.log('Cron job started: prepareCompanyInvitationsPendingMails');
    const job = await this.queuesService.addToCronTasksQueue(
      Jobs.PREPARE_COMPANY_INVITATIONS_PENDING_MAILS,
      {}
    );
    this.logger.log(
      `Job PREPARE_COMPANY_INVITATIONS_PENDING_MAILS created (Job ID: ${job.id})`
    );
    return { jobId: job.id, status: 'processing' };
  }

  @Cron('15 9 * * *')
  async prepareNotCompletedCompanyMails() {
    this.logger.log('Cron job started: prepareNotCompletedCompanyMails');
    const job = await this.queuesService.addToCronTasksQueue(
      Jobs.PREPARE_NOT_COMPLETED_COMPANY_MAILS,
      {}
    );
    this.logger.log(
      `Job PREPARE_NOT_COMPLETED_COMPANY_MAILS created (Job ID: ${job.id})`
    );
    return { jobId: job.id, status: 'processing' };
  }

  @Cron('20 9 * * *')
  async prepareCompanyCollabFollowMails() {
    this.logger.log('Cron job started: prepareCompanyCollabFollowMails');
    const job = await this.queuesService.addToCronTasksQueue(
      Jobs.PREPARE_COMPANY_COLLAB_FOLLOW_MAILS,
      {}
    );
    this.logger.log(
      `Job PREPARE_COMPANY_COLLAB_FOLLOW_MAILS created (Job ID: ${job.id})`
    );
    return { jobId: job.id, status: 'processing' };
  }

  @Cron(CronExpression.EVERY_DAY_AT_10AM)
  async prepareCommittedUsersFeedbackMails() {
    this.logger.log('Cron job started: prepareCommittedUsersFeedbackMails');
    const job = await this.queuesService.addToCronTasksQueue(
      Jobs.PREPARE_COMMITTED_USERS_FEEDBACK_MAILS,
      {}
    );
    this.logger.log(
      `Job PREPARE_COMMITTED_USERS_FEEDBACK_MAILS created (Job ID: ${job.id})`
    );
    return { jobId: job.id, status: 'processing' };
  }

  @Cron(CronExpression.EVERY_DAY_AT_1PM)
  async prepareUnreadConversationsMails() {
    this.logger.log('Cron job started: prepareUnreadConversationsMails');
    const job = await this.queuesService.addToCronTasksQueue(
      Jobs.PREPARE_UNREAD_CONVERSATIONS_MAILS,
      {}
    );
    this.logger.log(
      `Job PREPARE_UNREAD_CONVERSATIONS_MAILS created (Job ID: ${job.id})`
    );
    return { jobId: job.id, status: 'processing' };
  }

  @Cron(CronExpression.EVERY_DAY_AT_2PM)
  async prepareUnavailableUsersMails() {
    this.logger.log('Cron job started: prepareUnavailableUsersMails');
    const job = await this.queuesService.addToCronTasksQueue(
      Jobs.PREPARE_UNAVAILABLE_USERS_MAILS,
      {}
    );
    this.logger.log(
      `Job PREPARE_UNAVAILABLE_USERS_MAILS created (Job ID: ${job.id})`
    );
    return { jobId: job.id, status: 'processing' };
  }

  @Cron(CronExpression.EVERY_DAY_AT_3PM)
  async prepareChurnUsersFeedbackMails() {
    this.logger.log('Cron job started: prepareChurnUsersFeedbackMails');
    const job = await this.queuesService.addToCronTasksQueue(
      Jobs.PREPARE_CHURN_USERS_FEEDBACK_MAILS,
      {}
    );
    this.logger.log(
      `Job PREPARE_CHURN_USERS_FEEDBACK_MAILS created (Job ID: ${job.id})`
    );
    return { jobId: job.id, status: 'processing' };
  }

  @Cron(CronExpression.EVERY_DAY_AT_5PM)
  async prepareInactiveReferersMails() {
    this.logger.log('Cron job started: prepareInactiveReferersMails');
    const job = await this.queuesService.addToCronTasksQueue(
      Jobs.PREPARE_INACTIVE_REFERERS_MAILS,
      {}
    );
    this.logger.log(
      `Job PREPARE_INACTIVE_REFERERS_MAILS created (Job ID: ${job.id})`
    );
    return { jobId: job.id, status: 'processing' };
  }

  @Cron(CronExpression.EVERY_DAY_AT_7PM)
  async prepareMessagingFeedbackMails() {
    this.logger.log('Cron job started: prepareMessagingFeedbackMails');
    const job = await this.queuesService.addToCronTasksQueue(
      Jobs.PREPARE_MESSAGING_FEEDBACK_MAILS,
      {}
    );
    this.logger.log(
      `Job PREPARE_MESSAGING_FEEDBACK_MAILS created (Job ID: ${job.id})`
    );
    return { jobId: job.id, status: 'processing' };
  }

  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_NOON)
  async prepareWarnAccountDeletionMails() {
    this.logger.log('Cron job started: prepareWarnAccountDeletionMails');
    const job = await this.queuesService.addToCronTasksQueue(
      Jobs.PREPARE_WARN_ACCOUNT_DELETION_MAILS,
      {}
    );
    this.logger.log(
      `Job PREPARE_WARN_ACCOUNT_DELETION_MAILS created (Job ID: ${job.id})`
    );
    return { jobId: job.id, status: 'processing' };
  }
}
