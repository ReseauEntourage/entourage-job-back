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
import { Job, Queue } from 'bull';
import { CompaniesService } from 'src/companies/companies.service';
import { MailjetService } from 'src/external-services/mailjet/mailjet.service';
import { SalesforceService } from 'src/external-services/salesforce/salesforce.service';
import { MessagingService } from 'src/messaging/messaging.service';
import {
  BulkSendStaffMessagingMessageJob,
  CreateOrUpdateSalesforceCompanyJob,
  CreateOrUpdateSalesforceUserJob,
  Jobs,
  NewsletterSubscriptionJob,
  OnOnboardingCompletedJob,
  Queues,
  SendMailJob,
  SendStaffMessagingMessageJob,
  UpdateSalesforceUserCompanyJob,
} from 'src/queues/queues.types';
import { UserProfileRecommendationsLegacyService } from 'src/user-profiles/recommendations/user-profile-recommendations-legacy.service';
import { UserProfilesService } from 'src/user-profiles/user-profiles.service';
import { UsersService } from 'src/users/users.service';

@Processor(Queues.WORK)
export class WorkQueueProcessor {
  private readonly logger = new Logger(WorkQueueProcessor.name);

  constructor(
    private mailjetService: MailjetService,
    private salesforceService: SalesforceService,
    private companiesService: CompaniesService,
    private usersService: UsersService,
    private userProfilesService: UserProfilesService,
    private messagingService: MessagingService,
    private userProfileRecommendationsLegacyService: UserProfileRecommendationsLegacyService
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
    this.logger.error(`An error occurred on the work queue : "${error}"`);
  }

  @Process()
  async process(job: Job) {
    this.logger.error(
      `No process method for this job ${job.id} with data ${JSON.stringify(
        job.data
      )}`
    );
  }

  /**
   * Process send mail job
   * @param job - Job containing mail data to be sent
   * @returns A message indicating the result of the operation
   */
  @Process(Jobs.SEND_MAIL)
  async processSendMail(job: Job<SendMailJob | SendMailJob[]>) {
    const { data } = job;

    let emails: SendMailJob[];

    if (Array.isArray(data)) {
      emails = data;
    } else {
      emails = [data];
    }

    await this.mailjetService.sendMail(emails);

    return `Mail sent to '${JSON.stringify(
      emails.map(({ toEmail }) => {
        return toEmail;
      })
    )}' with template '${emails.map(({ templateId }) => {
      return templateId;
    })}'`;
  }

  /**
   * Process newsletter subscription job
   * @param job - Job containing contact data to subscribe to newsletter
   * @returns A message indicating the result of the operation
   */
  @Process(Jobs.NEWSLETTER_SUBSCRIPTION)
  async processNewsletterSubscription(job: Job<NewsletterSubscriptionJob>) {
    const { data } = job;

    await this.mailjetService.sendContact(data);

    return `Contact '${data.email}' subscribed to newsletter`;
  }

  /**
   * Create or update a user in Salesforce
   * If companyId is provided, also create or update the company in Salesforce through a separate job (CREATE_OR_UPDATE_SALESFORCE_COMPANY)
   * @param job - Job containing user data to create or update in Salesforce
   * @returns A message indicating the result of the operation
   */
  @Process(Jobs.CREATE_OR_UPDATE_SALESFORCE_USER)
  async processCreateOrUpdateSalesforceUser(
    job: Job<CreateOrUpdateSalesforceUserJob>
  ) {
    const { data } = job;

    if (process.env.ENABLE_SF === 'true') {
      await this.salesforceService.createOrUpdateSalesforceUser(data.userId, {
        campaign: data.campaign,
        birthDate: data.birthDate,
        nationality: data.nationality,
        accommodation: data.accommodation,
        hasSocialWorker: data.hasSocialWorker,
        resources: data.resources,
        studiesLevel: data.studiesLevel,
        workingExperience: data.workingExperience,
        jobSearchDuration: data.jobSearchDuration,
        workingRight: data.workingRight,
        gender: data.gender,
        refererEmail: data.refererEmail,
        structure: data.structure,
        isCompanyAdmin: data.isCompanyAdmin,
        // The "Position" field in Salesforce corresponds to the user's role in the company
        position: data.companyRole,
      });
      // If companyId is provided, create or update the company in Salesforce
      if (data.companyId) {
        const company = await this.companiesService.findOne(data.companyId);
        if (!company) throw new Error('Company not found');
        const queue = job.queue as Queue<CreateOrUpdateSalesforceCompanyJob>;
        await queue.add(Jobs.CREATE_OR_UPDATE_SALESFORCE_COMPANY, {
          name: company.name,
          userId: data.userId,
        });
      }
      return `Salesforce : created or updated user '${data.userId}'`;
    }

    return `Salesforce job ignored : creation or update of user '${data.userId}'`;
  }

  /**
   * Create or update a company in Salesforce
   * If userId is provided, also update the user's company in Salesforce through a separate job (UPDATE_SALESFORCE_USER_COMPANY)
   * @param job
   * @returns
   */
  @Process(Jobs.CREATE_OR_UPDATE_SALESFORCE_COMPANY)
  async processCreateOrUpdateSalesforceCompany(
    job: Job<CreateOrUpdateSalesforceCompanyJob>
  ) {
    const { data } = job;
    if (process.env.ENABLE_SF === 'true') {
      await this.salesforceService.createOrUpdateSalesforceCompany(data.name, {
        department: data.department,
        phone: data.phone,
      });
      // If userId is provided, update the user's company in Salesforce
      if (data.userId) {
        const company = await this.companiesService.findOneByName(data.name);
        if (!company) throw new Error('Company not found');
        const queue =
          job.queue as unknown as Queue<UpdateSalesforceUserCompanyJob>;
        await queue.add(Jobs.UPDATE_SALESFORCE_USER_COMPANY, {
          userId: data.userId,
          companyId: company.id,
        });
      }
      return `Salesforce : created or updated company '${data.name}'`;
    }

    return `Salesforce job ignored : creation or update of company '${data.name}'`;
  }

  /**
   * Update a user's company in Salesforce
   * @param job - Job containing userId and companyId to update the user's company in Salesforce
   * @returns A message indicating the result of the operation
   */
  @Process(Jobs.UPDATE_SALESFORCE_USER_COMPANY)
  async processUpdateSalesforceUserCompany(
    job: Job<UpdateSalesforceUserCompanyJob>
  ) {
    const { data } = job;
    if (process.env.ENABLE_SF === 'true') {
      const company = await this.companiesService.findOne(data.companyId);
      if (!company) throw new Error('Company not found');
      const isAdmin = company.admin && company.admin.id === data.userId;

      await this.salesforceService.updateSalesforceUserCompany(
        data.userId,
        company ? company.name : null,
        isAdmin
      );
      return `Salesforce : updated user '${data.userId}' company to '${data.companyId}'`;
    }
    return `Salesforce job ignored : update of user '${data.userId}' company to '${data.companyId}'`;
  }

  /**
   * Process onboarding completion for a user (can be all user roles)
   * @param job
   * @returns
   */
  @Process(Jobs.ON_ONBOARDING_COMPLETED)
  async processOnOnboardingCompleted(job: Job) {
    const { data } = job;
    const { userId } = data as OnOnboardingCompletedJob;

    this.logger.log(
      `Processing onboarding completion for user with id ${userId}`
    );
    const user = await this.usersService.findOneWithRelations(userId);
    if (!user) {
      this.logger.error(`User with id ${userId} not found`);
      throw new Error(`User with id ${userId} not found`);
    }

    const userProfile = await this.userProfilesService.findOneByUserId(userId);
    if (!userProfile) {
      this.logger.error(`UserProfile not found for user with id ${userId}`);
      throw new Error(`UserProfile not found for user with id ${userId}`);
    }

    // Send a welcome message from a staff member in the messaging system
    const welcomeMessageToSend =
      await this.usersService.generatePostOnboardingWelcomeMessage(user);
    if (welcomeMessageToSend) {
      const queue = job.queue as unknown as Queue<SendStaffMessagingMessageJob>;
      await queue.add(
        Jobs.SEND_STAFF_MESSAGING_MESSAGE,
        {
          addresseeEmail: user.email,
          message: welcomeMessageToSend,
        },
        {
          delay: 60 * 60 * 1000, // 1 hour
        }
      );
    }

    try {
      const recommendedProfiles =
        await this.userProfileRecommendationsLegacyService.retrieveOrComputeRecommendationsForUserId(
          user,
          userProfile,
          3
        );
      if (recommendedProfiles.length > 0) {
        await this.usersService.sendOnboardingCompletedMail(
          user,
          recommendedProfiles
        );
      } else {
        this.logger.log(
          `No recommended profiles found for user with id ${userId} after onboarding completion`
        );
      }
    } catch (err) {
      this.logger.error(
        `Failed to prepare recommendations for user with id ${user.id} after onboarding completion`,
        err
      );
    }
    return `Processed onboarding completion for user with id ${userId}`;
  }

  @Process(Jobs.SEND_STAFF_MESSAGING_MESSAGE)
  async processSendStaffMessagingMessage(
    job: Job<SendStaffMessagingMessageJob>
  ) {
    const { data } = job;
    const { addresseeEmail, message } = data;

    const addressee = await this.usersService.findOneByMailWithRelations(
      addresseeEmail
    );

    if (!addressee) {
      this.logger.error(
        `Addressee with email ${addresseeEmail} not found in the system`
      );
      throw new Error(
        `Addressee with email ${addresseeEmail} not found in the system`
      );
    }

    const staffContactEmail = addressee.staffContact.entourageProEmail;
    if (!staffContactEmail) {
      this.logger.error(
        `No staff contact email found for user with email ${addresseeEmail}, zone: ${addressee.zone}`
      );
      throw new Error(
        `No staff contact email found for user with email ${addresseeEmail}, zone: ${addressee.zone}`
      );
    }
    const staffContactEpUser = await this.usersService.findOneByMail(
      staffContactEmail
    );
    if (!staffContactEpUser) {
      this.logger.error(
        `Staff contact with email ${staffContactEmail} not found for user with email ${addresseeEmail}, zone: ${addressee.zone}`
      );
      throw new Error(
        `Staff contact with email ${staffContactEmail} not found for user with email ${addresseeEmail}, zone: ${addressee.zone}`
      );
    }

    await this.messagingService.createMessageWithConversation(
      {
        content: message,
        participantIds: [addressee.id],
      },
      staffContactEpUser.id
    );
    return `Message sent from staff member with email ${staffContactEmail} to user with email ${addresseeEmail}`;
  }

  @Process(Jobs.BULK_SEND_STAFF_MESSAGING_MESSAGE)
  async processBulkSendStaffMessagingMessage(
    job: Job<BulkSendStaffMessagingMessageJob>
  ) {
    const { data } = job;
    const { messages } = data;

    if (messages.length === 0) {
      this.logger.warn(
        `No messages provided for bulk sending staff messaging message`
      );
      return `No messages provided for bulk sending staff messaging message`;
    }
    const queue = job.queue as unknown as Queue<SendStaffMessagingMessageJob>;

    await Promise.all(
      messages.map(({ addresseeEmail, message }) =>
        // Add a job for each addressee to send the message individually, to avoid blocking the queue with a long job if there are many addressees
        queue.add(Jobs.SEND_STAFF_MESSAGING_MESSAGE, {
          addresseeEmail,
          message,
        })
      )
    );
    return `Bulk message sent from staff member to users with emails ${messages
      .map((m) => m.addresseeEmail)
      .join(', ')}`;
  }
}
