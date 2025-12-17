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
import {
  CreateOrUpdateSalesforceCompanyJob,
  CreateOrUpdateSalesforceUserJob,
  Jobs,
  NewsletterSubscriptionJob,
  Queues,
  SendMailJob,
  UpdateSalesforceUserCompanyJob,
} from 'src/queues/queues.types';

@Processor(Queues.WORK)
export class WorkQueueProcessor {
  private readonly logger = new Logger(WorkQueueProcessor.name);

  constructor(
    private mailjetService: MailjetService,
    private salesforceService: SalesforceService,
    private companiesService: CompaniesService
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
    this.logger.error(`An error occured on the work queue : "${error}"`);
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
      await this.salesforceService.updateSalesforceUserCompany(
        data.userId,
        company ? company.name : null
      );
      return `Salesforce : updated user '${data.userId}' company to '${data.companyId}'`;
    }
    return `Salesforce job ignored : update of user '${data.userId}' company to '${data.companyId}'`;
  }
}
