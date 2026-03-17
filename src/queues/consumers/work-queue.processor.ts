import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
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
export class WorkQueueProcessor extends WorkerHost {
  private readonly logger = new Logger(WorkQueueProcessor.name);

  constructor(
    @InjectQueue(Queues.WORK) private workQueue: Queue,
    private mailjetService: MailjetService,
    private salesforceService: SalesforceService,
    private companiesService: CompaniesService,
    private usersService: UsersService,
    private userProfilesService: UserProfilesService,
    private messagingService: MessagingService,
    private userProfileRecommendationsLegacyService: UserProfileRecommendationsLegacyService
  ) {
    super();
  }

  async process(job: Job): Promise<string> {
    this.logger.log(`Processing job ${job.id} of type ${job.name}`);

    switch (job.name) {
      case Jobs.SEND_MAIL:
        return this.processSendMail(job as Job<SendMailJob | SendMailJob[]>);
      case Jobs.CREATE_OR_UPDATE_SALESFORCE_COMPANY:
        return this.processCreateOrUpdateSalesforceCompany(
          job as Job<CreateOrUpdateSalesforceCompanyJob>
        );
      case Jobs.CREATE_OR_UPDATE_SALESFORCE_USER:
        return this.processCreateOrUpdateSalesforceUser(
          job as Job<CreateOrUpdateSalesforceUserJob>
        );
      case Jobs.UPDATE_SALESFORCE_USER_COMPANY:
        return this.processUpdateSalesforceUserCompany(
          job as Job<UpdateSalesforceUserCompanyJob>
        );
      case Jobs.NEWSLETTER_SUBSCRIPTION:
        return this.processNewsletterSubscription(
          job as Job<NewsletterSubscriptionJob>
        );
      case Jobs.SEND_STAFF_MESSAGING_MESSAGE:
        return this.processSendStaffMessagingMessage(
          job as Job<SendStaffMessagingMessageJob>
        );
      case Jobs.BULK_SEND_STAFF_MESSAGING_MESSAGE:
        return this.processBulkSendStaffMessagingMessage(
          job as Job<BulkSendStaffMessagingMessageJob>
        );
      case Jobs.ON_ONBOARDING_COMPLETED:
        return this.processOnOnboardingCompleted(
          job as Job<OnOnboardingCompletedJob>
        );
      default:
        this.logger.error(
          `No process method for job ${job.id} with name ${job.name}`
        );
        throw new Error(`Unknown job type: ${job.name}`);
    }
  }

  /**
   * Process send mail job
   * @param job - Job containing mail data to be sent
   * @returns A message indicating the result of the operation
   */
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
        await this.workQueue.add(Jobs.CREATE_OR_UPDATE_SALESFORCE_COMPANY, {
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
        await this.workQueue.add(Jobs.UPDATE_SALESFORCE_USER_COMPANY, {
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
      await this.workQueue.add(
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
      const recommendations =
        await this.userProfileRecommendationsLegacyService.retrieveOrComputeRecommendationsForUserId(
          user,
          userProfile,
          3
        );
      if (recommendations.length > 0) {
        await this.usersService.sendOnboardingCompletedMail(
          user,
          recommendations.map((r) => r.publicProfile)
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

    await Promise.all(
      messages.map(({ addresseeEmail, message }) =>
        // Add a job for each addressee to send the message individually, to avoid blocking the queue with a long job if there are many addressees
        this.workQueue.add(Jobs.SEND_STAFF_MESSAGING_MESSAGE, {
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
