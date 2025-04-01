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
import { CVsService } from 'src/cvs/cvs.service';
import { MailjetService } from 'src/external-services/mailjet/mailjet.service';
import { PusherService } from 'src/external-services/pusher/pusher.service';
import {
  PusherChannels,
  PusherEvents,
} from 'src/external-services/pusher/pusher.types';
import { SalesforceService } from 'src/external-services/salesforce/salesforce.service';
import {
  CacheAllCVJob,
  CacheCVJob,
  CreateOrUpdateSalesforceTaskJob,
  CreateOrUpdateSalesforceUserJob,
  GenerateCVPDFJob,
  GenerateCVSearchStringJob,
  Jobs,
  NewsletterSubscriptionJob,
  Queues,
  SendMailJob,
  SendReminderActionsJob,
  SendReminderCVJob,
  SendReminderInterviewTrainingJob,
  SendReminderVideoJob,
} from 'src/queues/queues.types';
import { AnyCantFix } from 'src/utils/types';

@Processor(Queues.WORK)
export class WorkQueueProcessor {
  constructor(
    private mailjetService: MailjetService,
    private pusherService: PusherService,
    private cvsService: CVsService,
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

  @Process(Jobs.REMINDER_CV_10)
  async processSendReminderCV10(job: Job<SendReminderCVJob>) {
    const { data } = job;

    const sentToReminderCV10 = await this.cvsService.sendReminderAboutCV(
      data.candidateId
    );

    return sentToReminderCV10
      ? `Reminder about CV after 10 days sent to '${
          data.candidateId
        }' (${JSON.stringify(sentToReminderCV10)})`
      : `No reminder after 10 about CV sent to '${data.candidateId}'`;
  }

  @Process(Jobs.REMINDER_CV_20)
  async processSendReminderCV20(job: Job<SendReminderCVJob>) {
    const { data } = job;

    const sentToReminderCV20 = await this.cvsService.sendReminderAboutCV(
      data.candidateId,
      true
    );

    return sentToReminderCV20
      ? `Reminder about CV after 20 days sent to '${
          data.candidateId
        }' (${JSON.stringify(sentToReminderCV20)})`
      : `No reminder after 20 day about CV sent to '${data.candidateId}'`;
  }

  @Process(Jobs.REMINDER_VIDEO)
  async processSendReminderVideo(job: Job<SendReminderVideoJob>) {
    const { data } = job;

    const sentToReminderVideo = await this.cvsService.sendReminderAboutVideo(
      data.candidateId
    );

    return sentToReminderVideo
      ? `Reminder about video sent to '${data.candidateId}' (${JSON.stringify(
          sentToReminderVideo
        )})`
      : `No reminder about video sent to '${data.candidateId}'`;
  }

  @Process(Jobs.REMINDER_INTERVIEW_TRAINING)
  async processSendReminderInterview(
    job: Job<SendReminderInterviewTrainingJob>
  ) {
    const { data } = job;

    const sentToReminderTraining =
      await this.cvsService.sendReminderAboutInterviewTraining(
        data.candidateId
      );

    return sentToReminderTraining
      ? `Reminder about interview training sent to '${
          data.candidateId
        }' (${JSON.stringify(sentToReminderTraining)})`
      : `No reminder about interview training sent to '${data.candidateId}'`;
  }

  @Process(Jobs.REMINDER_ACTIONS)
  async processSendReminderActions(job: Job<SendReminderActionsJob>) {
    const { data } = job;

    const sentToReminderActions =
      await this.cvsService.sendReminderAboutActions(data.candidateId);

    return sentToReminderActions
      ? `Reminder about actions sent to '${data.candidateId}' (${JSON.stringify(
          sentToReminderActions
        )})`
      : `No reminder about actions sent to '${data.candidateId}'`;
  }

  @Process(Jobs.CACHE_CV)
  async processCacheCV(job: Job<CacheCVJob>) {
    const { data } = job;

    const cv = await this.cvsService.findAndCacheOneByUrl(
      data.url,
      data.candidateId
    );

    return cv
      ? `CV cached for User ${cv.UserId} and CV ${cv.id}${
          data.url ? ` and URL ${data.url}` : ''
        }`
      : `CV not cached`;
  }

  @Process(Jobs.CACHE_ALL_CVS)
  async processCacheAllCVs(job: Job<CacheAllCVJob>) {
    const {} = job;

    const cvs = await this.cvsService.findAndCacheAll(undefined, true);

    return cvs && cvs.length > 0 ? `All published CVs cached` : `No CVs cached`;
  }

  @Process(Jobs.GENERATE_CV_PDF)
  async processGenerateCVPDF(job: Job<GenerateCVPDFJob>) {
    const { data } = job;

    await this.cvsService.generatePDFFromCV(
      data.candidateId,
      data.token,
      data.fileName
    );

    await this.pusherService.sendEvent(
      PusherChannels.CV_PDF,
      PusherEvents.CV_PDF_DONE,
      {
        candidateId: data.candidateId,
      }
    );

    return `PDF generated for User ${data.candidateId} : ${data.fileName}`;
  }

  @Process(Jobs.CREATE_CV_SEARCH_STRING)
  async processGenerateCVSearchString(job: Job<GenerateCVSearchStringJob>) {
    const { data } = job;

    await this.cvsService.generateSearchStringFromCV(data.candidateId);

    return `CV search string created for User ${data.candidateId}`;
  }

  @Process(Jobs.CREATE_OR_UPDATE_SALESFORCE_TASK)
  async processCreateOrUpdateSalesforceTask(
    job: Job<CreateOrUpdateSalesforceTaskJob>
  ) {
    const { data } = job;

    if (process.env.ENABLE_SF === 'true') {
      await this.salesforceService.createOrUpdateSalesforceExternalMessage(
        data.externalMessageId
      );
      return `Salesforce : created or updated task '${data.externalMessageId}'`;
    }

    return `Salesforce job ignored : creation or update of task '${data.externalMessageId}'`;
  }

  @Process(Jobs.CREATE_OR_UPDATE_SALESFORCE_USER)
  async processCreateOrUpdateSalesforceUser(
    job: Job<CreateOrUpdateSalesforceUserJob>
  ) {
    const { data } = job;

    if (process.env.ENABLE_SF === 'true') {
      await this.salesforceService.createOrUpdateSalesforceUser(data.userId, {
        program: data.program,
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
