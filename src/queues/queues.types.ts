import { MailjetTemplate } from 'src/mails/mails.types';

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
  candidateId: string;
  is20Days: boolean;
}

export interface SendReminderVideoJob {
  candidateId: string;
}

export interface SendReminderActionsJob {
  candidateId: string;
}

export interface SendReminderExternalOffersJob {
  candidateId: string;
}

export interface SendReminderInterviewTrainingJob {
  candidateId: string;
}

export interface CacheCVJob {
  candidateId: string;
  url: string;
}

export interface CacheAllCVJob {}

export interface GenerateCVPDFJob {
  candidateId: string;
  token: string;
  paths: string[];
}

export interface GenerateCVPreviewJob {
  candidateId: string;
  uploadedImg: string;
  oldImg: string;
}

export interface GenerateCVSearchString {
  candidateId: string;
  token: string;
  paths: string[];
}

export const Queues = {
  WORK: 'work',
} as const;

export type Queue = typeof Queues[keyof typeof Queues];

export const PusherChannels = {
  CV_PREVIEW: 'cv-preview-channel',
  CV_PDF: 'cv-pdf-channel',
} as const;

export type PusherChannel = typeof PusherChannels[keyof typeof PusherChannels];

export const PusherEvents = {
  CV_PREVIEW_DONE: 'cv-preview-done',
  CV_PDF_DONE: 'cv-pdf-done',
} as const;

export type PusherEvent = typeof PusherEvents[keyof typeof PusherEvents];
