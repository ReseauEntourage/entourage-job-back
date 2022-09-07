/* eslint-disable no-console */
import {
  Processor,
  Process,
  OnQueueActive,
  OnQueueCompleted,
  OnQueueFailed,
  OnQueueWaiting,
  OnQueueError,
} from '@nestjs/bull';
import { Job } from 'bull';
import { AirtableService } from 'src/airtable/airtable.service';
import { CVsService } from 'src/cvs/cvs.service';
import { MailjetService } from 'src/mails/mailjet.service';
import {
  CacheCVJob,
  GenerateCVSearchString,
  GenerateCVPDFJob,
  Jobs,
  Queues,
  SendMailJob,
  SendReminderCVJob,
  GenerateCVPreviewJob,
  CacheAllCVJob,
  SendReminderVideoJob,
  SendReminderInterviewTrainingJob,
  SendReminderActionsJob,
  SendReminderExternalOffersJob,
  PusherChannels,
  PusherEvents,
  CreateOrUpdateSalesforceOpportunity,
  UpdateAirtable,
  InsertAirtable,
} from 'src/queues/queues.types';
import { SalesforceService } from 'src/salesforce/salesforce.service';
import { AnyCantFix } from 'src/utils/types';
import { PusherService } from './pusher.service';

@Processor(Queues.WORK)
export class WorkQueueProcessor {
  constructor(
    private mailjetService: MailjetService,
    private pusherService: PusherService,
    private cvsService: CVsService,
    private airtableService: AirtableService,
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
  onFailed(job: Job, err: Error) {
    // TODO send error to socket to stop loading if preview or PDF
    console.error(
      `Job ${job.id} of type ${job.name} failed with error : "${err}"`
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
    throw new Error(
      `No process method for this job ${job.id} with data ${JSON.stringify(
        job.data
      )}`
    );
  }

  @Process(Jobs.SEND_MAIL)
  async processSendMail(job: Job<SendMailJob>) {
    const { data } = job;

    await this.mailjetService.sendMail(data);

    return `Mail sent to '${JSON.stringify(data.toEmail)}' with template '${
      data.templateId
    }'`;
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

  @Process(Jobs.REMINDER_EXTERNAL_OFFERS)
  async processSendReminderExternalOffers(
    job: Job<SendReminderExternalOffersJob>
  ) {
    const { data } = job;

    const sentToReminderExternalOffers =
      await this.cvsService.sendReminderAboutExternalOffers(data.candidateId);

    return sentToReminderExternalOffers
      ? `Reminder about external offers sent to '${
          data.candidateId
        }' (${JSON.stringify(sentToReminderExternalOffers)})`
      : `No reminder about external offers sent to '${data.candidateId}'`;
  }

  @Process(Jobs.CACHE_CV)
  async processCacheCV(job: Job<CacheCVJob>) {
    const { data } = job;

    const cv = await this.cvsService.cacheCV(data.url, data.candidateId);

    return cv
      ? `CV cached for User ${cv.UserId} and CV ${cv.id}${
          data.url ? ` and URL ${data.url}` : ''
        }`
      : `CV not cached`;
  }

  @Process(Jobs.CACHE_ALL_CVS)
  async processCacheAllCVs(job: Job<CacheAllCVJob>) {
    const {} = job;

    const cvs = await this.cvsService.cacheAllCVs(undefined, true);

    return cvs && cvs.length > 0 ? `All published CVs cached` : `No CVs cached`;
  }

  @Process(Jobs.GENERATE_CV_PDF)
  async processGenerateCVPDF(job: Job<GenerateCVPDFJob>) {
    const { data } = job;

    await this.cvsService.generatePDFFromCV(
      data.candidateId,
      data.token,
      data.paths
    );

    await this.pusherService.sendEvent(
      PusherChannels.CV_PDF,
      PusherEvents.CV_PDF_DONE,
      {
        candidateId: data.candidateId,
      }
    );

    return `PDF generated for User ${data.candidateId} : ${data.paths[2]}`;
  }

  @Process(Jobs.GENERATE_CV_PREVIEW)
  async processGenerateCVPreview(job: Job<GenerateCVPreviewJob>) {
    const { data } = job;

    const previewUrl = await this.cvsService.generatePreviewFromCV(
      data.candidateId,
      data.uploadedImg,
      data.oldImg
    );

    await this.pusherService.sendEvent(
      PusherChannels.CV_PREVIEW,
      PusherEvents.CV_PREVIEW_DONE,
      {
        candidateId: data.candidateId,
      }
    );

    return `Preview generated for User ${data.candidateId} : ${previewUrl}`;
  }

  @Process(Jobs.CREATE_CV_SEARCH_STRING)
  async processGenerateCVSearchString(job: Job<GenerateCVSearchString>) {
    const { data } = job;

    await this.cvsService.generateSearchStringFromCV(data.candidateId);

    return `CV search string created for User ${data.candidateId}`;
  }

  @Process(Jobs.INSERT_AIRTABLE)
  async processInsertAirtable(job: Job<InsertAirtable>) {
    const { data } = job;

    await this.airtableService.insertOpportunityAirtable(
      data.tableName,
      data.opportunityId
    );
    return `Airtable : insertion in '${data.tableName}'`;
  }

  @Process(Jobs.UPDATE_AIRTABLE)
  async processUpdateAirtable(job: Job<UpdateAirtable>) {
    const { data } = job;

    await this.airtableService.updateOpportunityAirtable(
      data.tableName,
      data.opportunityId
    );
    return `Airtable : update in '${data.tableName}'`;
  }

  @Process(Jobs.CREATE_OR_UPDATE_SALESFORCE_OPPORTUNITY)
  async processCreateOrUpdateSalesforceOpportunity(
    job: Job<CreateOrUpdateSalesforceOpportunity>
  ) {
    const { data } = job;

    if (process.env.ENABLE_SF === 'true') {
      await this.salesforceService.createOrUpdateSalesforceOpportunity(
        data.opportunityId,
        data.isSameOpportunity
      );
      return `Salesforce : created or updated offer '${data.opportunityId}'`;
    }
    return `Salesforce job ignored : creation or update of offer '${data.opportunityId}'`;
  }
}
