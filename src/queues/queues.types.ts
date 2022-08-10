import { BullModuleOptions } from '@nestjs/bull';
import { MailjetTemplate } from 'src/mails/mails.service';

export const Jobs = {
  GENERATE_CV_PDF: 'generate_cv_pdf',
  GENERATE_CV_PREVIEW: 'generate_cv_preview',
  CREATE_CV_SEARCH_STRING: 'create_cv_search_string',
  CACHE_CV: 'cache_cv',
  CACHE_ALL_CVS: 'cache_all_cvs',
  SEND_MAIL: 'send_mail',
  SEND_SMS: 'send_sms',
  INSERT_AIRTABLE: 'insert_airtable',
  UPDATE_AIRTABLE: 'update_airtable',
  CREATE_OR_UPDATE_SALESFORCE_OPPORTUNITY:
    'create_or_update_salesforce_opportunity',
  REMINDER_OFFER: 'reminder_offer',
  REMINDER_CV_10: 'reminder_cv_10',
  REMINDER_CV_20: 'reminder_cv_20',
  REMINDER_VIDEO: 'reminder_video',
  REMINDER_INTERVIEW_TRAINING: 'reminder_interview_training',
  REMINDER_ACTIONS: 'reminder_actions',
  REMINDER_EXTERNAL_OFFERS: 'reminder_external_offers',
  NO_RESPONSE_OFFER: 'no_response_offer',
} as const;

export type Job = typeof Jobs[keyof typeof Jobs];

export interface SendMailJob {
  toEmail: string;
  templateId: MailjetTemplate;
  variables: object;
}

export interface SendReminderCVJob {
  candidatId: string;
  is20Days: boolean;
}

export interface CacheCVJob {
  candidatId: string;
  url: string;
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
