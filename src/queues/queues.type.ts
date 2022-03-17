import { MailjetTemplate } from '../mails/mails.service';
import { BullModuleOptions, BullQueueEventOptions } from '@nestjs/bull';

export const Jobs = {
  GENERATE_CV_PDF: 'generate_cv_pdf',
  GENERATE_CV_PREVIEW: 'generate_cv_preview',
  CREATE_CV_SEARCH_STRING: 'create_cv_search_string',
  CACHE_CV: 'cache_cv',
  CACHE_ALL_CVS: 'cache_all_cvs',
  SEND_MAIL: 'send_mail',
  INSERT_AIRTABLE: 'insert_airtable',
  UPDATE_AIRTABLE: 'update_airtable',
  REMINDER_OFFER: 'reminder_offer',
} as const;

export type Job = typeof Jobs[keyof typeof Jobs];

export interface SendMailJob {
  type: Job;
  toEmail: string;
  templateId: MailjetTemplate;
  variables: object;
}

export const Queues = {
  WORK: 'work',
} as const;

export type Queue = typeof Queues[keyof typeof Queues];

export function getBullWorkQueueOptions(): BullModuleOptions {
  return {
    name: Queues.WORK,
    defaultJobOptions: {
      attempts: `${process.env.JOBS_NB_ATTEMPS}`
        ? parseInt(process.env.JOBS_NB_ATTEMPS)
        : 10,
      backoff: {
        type: 'exponential',
        delay: `${process.env.JOBS_BACKOFF_DELAY}`
          ? parseInt(process.env.JOBS_BACKOFF_DELAY, 10)
          : 60000,
      },
      removeOnFail: true,
      removeOnComplete: true,
    },
  };
}
