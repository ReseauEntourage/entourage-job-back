import {
  CandidateAccommodation,
  CandidateGender,
  CandidateResource,
  CandidateYesNoNSPPValue,
  JobSearchDuration,
  Nationality,
  StudiesLevel,
  WorkingExperience,
  YesNoJNSPRValue,
} from 'src/contacts/contacts.types';
import {
  CustomContactParams,
  CustomMailParams,
  MailjetTemplate,
} from 'src/external-services/mailjet/mailjet.types';
import { Program } from 'src/users/users.types';

export const Jobs = {
  GENERATE_CV_PDF: 'generate_cv_pdf',
  CREATE_CV_SEARCH_STRING: 'create_cv_search_string',
  CACHE_CV: 'cache_cv',
  CACHE_ALL_CVS: 'cache_all_cvs',
  SEND_MAIL: 'send_mail',
  NEWSLETTER_SUBSCRIPTION: 'newsletter_subscription',
  CREATE_OR_UPDATE_SALESFORCE_TASK: 'create_or_update_salesforce_task',
  CREATE_OR_UPDATE_SALESFORCE_USER: 'create_or_update_salesforce_user',
  REMINDER_CV_10: 'reminder_cv_10',
  REMINDER_CV_20: 'reminder_cv_20',
  REMINDER_VIDEO: 'reminder_video',
  REMINDER_INTERVIEW_TRAINING: 'reminder_interview_training',
  REMINDER_ACTIONS: 'reminder_actions',
} as const;

export type Job = (typeof Jobs)[keyof typeof Jobs];

type JobsData = {
  [Jobs.GENERATE_CV_PDF]: GenerateCVPDFJob;
  [Jobs.CREATE_CV_SEARCH_STRING]: GenerateCVSearchStringJob;
  [Jobs.CACHE_CV]: CacheCVJob;
  [Jobs.CACHE_ALL_CVS]: CacheAllCVJob;
  [Jobs.SEND_MAIL]: SendMailJob | SendMailJob[];
  [Jobs.NEWSLETTER_SUBSCRIPTION]: NewsletterSubscriptionJob;
  [Jobs.CREATE_OR_UPDATE_SALESFORCE_TASK]: CreateOrUpdateSalesforceTaskJob;
  [Jobs.CREATE_OR_UPDATE_SALESFORCE_USER]: CreateOrUpdateSalesforceUserJob;
  [Jobs.REMINDER_CV_10]: SendReminderCVJob;
  [Jobs.REMINDER_CV_20]: SendReminderCVJob;
  [Jobs.REMINDER_VIDEO]: SendReminderVideoJob;
  [Jobs.REMINDER_INTERVIEW_TRAINING]: SendReminderInterviewTrainingJob;
  [Jobs.REMINDER_ACTIONS]: SendReminderActionsJob;
};

export type JobData<T extends Job> = JobsData[T];

export interface SendMailJob extends CustomMailParams {
  templateId: MailjetTemplate;
  variables: object;
}

export interface NewsletterSubscriptionJob extends CustomContactParams {}

export interface SendReminderCVJob {
  candidateId: string;
}

export interface SendReminderVideoJob {
  candidateId: string;
}

export interface SendReminderActionsJob {
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

export interface GenerateCVSearchStringJob {
  candidateId: string;
}

export interface CreateOrUpdateSalesforceTaskJob {
  externalMessageId: string | string[];
}

export interface CreateOrUpdateSalesforceUserJob {
  userId: string;
  program?: Program;
  birthDate?: Date;
  campaign?: string;
  nationality?: Nationality;
  accommodation?: CandidateAccommodation;
  hasSocialWorker?: YesNoJNSPRValue;
  resources?: CandidateResource;
  studiesLevel?: StudiesLevel;
  workingExperience?: WorkingExperience;
  jobSearchDuration?: JobSearchDuration;
  workingRight?: CandidateYesNoNSPPValue;
  gender?: CandidateGender;
  refererEmail?: string;
  structure?: string;
}

export const Queues = {
  WORK: 'work',
} as const;

export type Queue = (typeof Queues)[keyof typeof Queues];
