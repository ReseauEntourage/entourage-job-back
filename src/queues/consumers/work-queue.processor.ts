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
import { CVsService } from 'src/cvs/cvs.service';
import { MailjetService } from 'src/mails/mailjet.service';
import {
  CacheCVJob,
  Jobs,
  Queues,
  SendMailJob,
  SendReminderCVJob,
} from 'src/queues/queues.types';

// TODO PUSHER
@Processor(Queues.WORK)
export class WorkQueueProcessor {
  constructor(
    private mailjetService: MailjetService,
    private cvsService: CVsService
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
  async process(job: Job<unknown>) {
    return `No process method for this job ${job.id} with data ${JSON.stringify(
      job.data
    )}`;
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
      data.candidatId
    );
    return sentToReminderCV10
      ? `Reminder about CV after 10 days sent to '${
          data.candidatId
        }' (${JSON.stringify(sentToReminderCV10)})`
      : `No reminder after 10 about CV sent to '${data.candidatId}'`;
  }

  @Process(Jobs.REMINDER_CV_20)
  async processSendReminderCV20(job: Job<SendReminderCVJob>) {
    const { data } = job;
    const sentToReminderCV20 = await this.cvsService.sendReminderAboutCV(
      data.candidatId,
      true
    );
    return sentToReminderCV20
      ? `Reminder about CV after 20 days sent to '${
          data.candidatId
        }' (${JSON.stringify(sentToReminderCV20)})`
      : `No reminder after 20 day about CV sent to '${data.candidatId}'`;
  }

  @Process(Jobs.CACHE_CV)
  async processCacheCV(job: Job<CacheCVJob>) {
    const { data } = job;
    const cv = await this.cvsService.cacheCV(data.url, data.candidatId);
    return cv
      ? `CV cached for User ${cv.UserId} and CV ${cv.id}${
          data.url ? ` and URL ${data.url}` : ''
        }`
      : `CV not cached`;
  }
  @Process(Jobs.CACHE_ALL_CVS)
  async processCacheAllCVs() {
    const cvs = await this.cvsService.cacheAllCVs(undefined, true);
    return cvs && cvs.length > 0 ? `All published CVs cached` : `No CVs cached`;
  }
}
