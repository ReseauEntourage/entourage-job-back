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
import { Jobs, Queues, SendMailJob } from '../queues.type';
import { MailjetService } from '../../mails/mailjet.service';

// TODO PUSHER
@Processor(Queues.WORK)
export class WorkQueueProcessor {
  constructor(private mailjetService: MailjetService) {}

  @OnQueueActive()
  onActive(job: Job) {
    const timeInQueue = job.processedOn - job.timestamp;
    console.log(
      `Job ${job.id} of type ${job.name} has started after waiting for ${timeInQueue} ms`,
    );
  }

  @OnQueueCompleted()
  onCompleted(job: Job, result: any) {
    console.log(
      `Job ${job.id} of type ${job.name} completed with result : "${result}"`,
    );
  }

  @OnQueueFailed()
  onFailed(job: Job, err: Error) {
    // TODO send error to socket to stop loading if preview or PDF
    console.error(
      `Job ${job.id} of type ${job.name} failed with error : "${err}"`,
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
      job.data,
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
}
