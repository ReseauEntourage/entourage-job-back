import { BusinessLine } from 'src/common/businessLines/models';
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
  SEND_OFFERS_EMAIL_AFTER_CV_PUBLISH: 'send_offers_email_after_cv_publish',
} as const;

export type Job = typeof Jobs[keyof typeof Jobs];

export interface SendMailJob extends CustomMailParams {
  toEmail: string;
  templateId: MailjetTemplate;
  variables: object;
}

export interface SendSMSJob extends CustomSMSParams {
  toPhone: string | string[];
  text: string;
}

export interface SendReminderOffer {
  opportunityId: string;
  candidateId: string;
}

export interface SendNoResponseOffer {
  opportunityId: string;
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

export interface InsertAirtable {
  tableName: string;
  opportunityId: string;
}

export interface UpdateAirtable {
  tableName: string;
  opportunityId: string;
}

export interface CreateOrUpdateSalesforceOpportunity {
  opportunityId: string;
  isSameOpportunity: boolean;
}

export interface SendOffersEmailAfterCVPublish {
  candidateId: string;
  locations: Location[];
  businessLines: BusinessLine[];
}

export const Queues = {
  WORK: 'work',
} as const;

export type Queue = typeof Queues[keyof typeof Queues];
