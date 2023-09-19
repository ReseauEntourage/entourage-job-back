import { BusinessLine } from 'src/common/business-lines/models';
import { Location } from 'src/common/locations/models';
import {
  CustomMailParams,
  MailjetTemplate,
} from 'src/external-services/mailjet/mailjet.types';
import { CustomSMSParams } from 'src/external-services/vonage/vonage.types';

export const Jobs = {
  GENERATE_CV_PDF: 'generate_cv_pdf',
  GENERATE_CV_PREVIEW: 'generate_cv_preview',
  CREATE_CV_SEARCH_STRING: 'create_cv_search_string',
  CACHE_CV: 'cache_cv',
  CACHE_ALL_CVS: 'cache_all_cvs',
  SEND_MAIL: 'send_mail',
  SEND_SMS: 'send_sms',
  CREATE_OR_UPDATE_SALESFORCE_OPPORTUNITY:
    'create_or_update_salesforce_opportunity',
  CREATE_OR_UPDATE_SALESFORCE_EVENT: 'create_or_update_salesforce_event',
  CREATE_OR_UPDATE_SALESFORCE_TASK: 'create_or_update_salesforce_task',
  REMINDER_OFFER: 'reminder_offer',
  REMINDER_CV_10: 'reminder_cv_10',
  REMINDER_CV_20: 'reminder_cv_20',
  REMINDER_VIDEO: 'reminder_video',
  REMINDER_INTERVIEW_TRAINING: 'reminder_interview_training',
  REMINDER_ACTIONS: 'reminder_actions',
  REMINDER_EXTERNAL_OFFERS: 'reminder_external_offers',
  NO_RESPONSE_OFFER: 'no_response_offer',
  OFFER_ARCHIVE_REMINDER: 'offer_archive_reminder',
  SEND_OFFERS_EMAIL_AFTER_CV_PUBLISH: 'send_offers_email_after_cv_publish',
} as const;

export type Job = typeof Jobs[keyof typeof Jobs];

type JobsData = {
  [Jobs.GENERATE_CV_PDF]: GenerateCVPDFJob;
  [Jobs.GENERATE_CV_PREVIEW]: GenerateCVPreviewJob;
  [Jobs.CREATE_CV_SEARCH_STRING]: GenerateCVSearchStringJob;
  [Jobs.CACHE_CV]: CacheCVJob;
  [Jobs.CACHE_ALL_CVS]: CacheAllCVJob;
  [Jobs.SEND_MAIL]: SendMailJob | SendMailJob[];
  [Jobs.SEND_SMS]: SendSMSJob | SendSMSJob[];
  [Jobs.CREATE_OR_UPDATE_SALESFORCE_OPPORTUNITY]: CreateOrUpdateSalesforceOpportunityJob;
  [Jobs.CREATE_OR_UPDATE_SALESFORCE_EVENT]: CreateOrUpdateSalesforceEventJob;
  [Jobs.CREATE_OR_UPDATE_SALESFORCE_TASK]: CreateOrUpdateSalesforceTaskJob;
  [Jobs.REMINDER_OFFER]: SendReminderOfferJob;
  [Jobs.REMINDER_CV_10]: SendReminderCVJob;
  [Jobs.REMINDER_CV_20]: SendReminderCVJob;
  [Jobs.REMINDER_VIDEO]: SendReminderVideoJob;
  [Jobs.REMINDER_INTERVIEW_TRAINING]: SendReminderInterviewTrainingJob;
  [Jobs.REMINDER_ACTIONS]: SendReminderActionsJob;
  [Jobs.REMINDER_EXTERNAL_OFFERS]: SendReminderExternalOffersJob;
  [Jobs.NO_RESPONSE_OFFER]: SendNoResponseOfferJob;
  [Jobs.OFFER_ARCHIVE_REMINDER]: SendOfferArchiveReminder;
  [Jobs.SEND_OFFERS_EMAIL_AFTER_CV_PUBLISH]: SendOffersEmailAfterCVPublishJob;
};

export type JobData<T extends Job> = JobsData[T];

export interface SendMailJob extends CustomMailParams {
  templateId: MailjetTemplate;
  variables: object;
}

export interface SendSMSJob extends CustomSMSParams {}

export interface SendReminderOfferJob {
  opportunityId: string;
  candidateId: string;
}

export interface SendNoResponseOfferJob {
  opportunityId: string;
}

export interface SendOfferArchiveReminder {
  opportunityId: string;
}

export interface SendReminderCVJob {
  candidateId: string;
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
  url?: string;
}

export interface CacheAllCVJob {}

export interface GenerateCVPDFJob {
  candidateId: string;
  token: string;
  fileName: string;
}

export interface GenerateCVPreviewJob {
  candidateId: string;
  uploadedImg: string;
  oldImg: string;
}

export interface GenerateCVSearchStringJob {
  candidateId: string;
}

export interface CreateOrUpdateSalesforceOpportunityJob {
  opportunityId: string | string[];
  isSameOpportunity: boolean;
}

export interface CreateOrUpdateSalesforceEventJob {
  opportunityUserEventId: string | string[];
}

export interface CreateOrUpdateSalesforceTaskJob {
  externalMessageId: string | string[];
}

export interface SendOffersEmailAfterCVPublishJob {
  candidateId: string;
  locations: Location[];
  businessLines: BusinessLine[];
}

export const Queues = {
  WORK: 'work',
} as const;

export type Queue = typeof Queues[keyof typeof Queues];
