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
  SEND_MAIL: 'send_mail',
  NEWSLETTER_SUBSCRIPTION: 'newsletter_subscription',
  CREATE_OR_UPDATE_SALESFORCE_TASK: 'create_or_update_salesforce_task',
  CREATE_OR_UPDATE_SALESFORCE_USER: 'create_or_update_salesforce_user',
} as const;

export type Job = (typeof Jobs)[keyof typeof Jobs];

type JobsData = {
  [Jobs.GENERATE_CV_PDF]: GenerateCVPDFJob;
  [Jobs.SEND_MAIL]: SendMailJob | SendMailJob[];
  [Jobs.NEWSLETTER_SUBSCRIPTION]: NewsletterSubscriptionJob;
  [Jobs.CREATE_OR_UPDATE_SALESFORCE_TASK]: CreateOrUpdateSalesforceTaskJob;
  [Jobs.CREATE_OR_UPDATE_SALESFORCE_USER]: CreateOrUpdateSalesforceUserJob;
};

export type JobData<T extends Job> = JobsData[T];

export interface SendMailJob extends CustomMailParams {
  templateId: MailjetTemplate;
  variables: object;
}

export interface NewsletterSubscriptionJob extends CustomContactParams {}

export interface GenerateCVPDFJob {
  candidateId: string;
  token: string;
  fileName: string;
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
