/* eslint-disable no-console */
import {
  OnQueueActive,
  OnQueueCompleted,
  OnQueueError,
  OnQueueFailed,
  OnQueueWaiting,
  Process,
  Processor,
} from '@nestjs/bull';
import { Job } from 'bull';
import { MailjetService } from 'src/external-services/mailjet/mailjet.service';
import { PusherService } from 'src/external-services/pusher/pusher.service';
import { SalesforceService } from 'src/external-services/salesforce/salesforce.service';
import {
  CreateOrUpdateSalesforceUserJob,
  Jobs,
  NewsletterSubscriptionJob,
  Queues,
  SendMailJob,
} from 'src/queues/queues.types';
import { AnyCantFix } from 'src/utils/types';

@Processor(Queues.WORK)
export class WorkQueueProcessor {
  constructor(
    private mailjetService: MailjetService,
    private pusherService: PusherService,
    private salesforceService: SalesforceService
  ) {}

  @OnQueueActive()
  onActive(job: Job) {
    const timeInQueue = job.processedOn - job.timestamp;
    console.log(
      `Job ${job.id} of type ${job.name} has started after waiting for ${timeInQueue} ms`
    );
  }

  @OnQueueCompleted()
  onCompleted(job: Job, result: string) {
    console.log(
      `Job ${job.id} of type ${job.name} completed with result : "${result}"`
    );
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error) {
    // TODO send error to socket to stop loading if preview or PDF
    console.error(
      `Job ${job.id} of type ${job.name} failed with error : "${error}"`
    );
    console.error(job.data);
  }

  @OnQueueWaiting()
  onWaiting(jobId: number | string) {
    console.log(`Job ${jobId} is waiting to be processed`);
  }

  @OnQueueError()
  onError(error: Error) {
    console.error(`An error occured on the work queue : "${error}"`);
  }

  @Process()
  async process(job: Job<AnyCantFix>) {
    console.error(
      `No process method for this job ${job.id} with data ${JSON.stringify(
        job.data
      )}`
    );
  }

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

  @Process(Jobs.NEWSLETTER_SUBSCRIPTION)
  async processNewsletterSubscription(job: Job<NewsletterSubscriptionJob>) {
    const { data } = job;

    await this.mailjetService.sendContact(data);

    return `Contact '${data.email}' subscribed to newsletter`;
  }

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
      return `Salesforce : created or updated user '${data.userId}'`;
    }

    return `Salesforce job ignored : creation or update of user '${data.userId}'`;
  }
}
