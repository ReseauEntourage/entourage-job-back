import { CompanyUserRole } from 'src/companies/company-user.utils';
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

export const Jobs = {
  // Jobs related to profile generation
  GENERATE_CV_PDF: 'generate_cv_pdf',

  // Jobs related to worker queue
  SEND_MAIL: 'send_mail',
  NEWSLETTER_SUBSCRIPTION: 'newsletter_subscription',
  CREATE_OR_UPDATE_SALESFORCE_USER: 'create_or_update_salesforce_user',
  CREATE_OR_UPDATE_SALESFORCE_COMPANY: 'create_or_update_salesforce_company',
  GENERATE_PROFILE_FROM_PDF: 'generate_profile_from_pdf',
  UPDATE_SALESFORCE_USER_COMPANY: 'update_salesforce_user_company',

  // Jobs related to cron tasks
  SEND_REMINDER_TO_USER_NOT_COMPLETED_ONBOARDING:
    'send_reminder_to_user_not_completed_onboarding',
  DELETE_INACTIVE_USERS: 'delete_inactive_users',
} as const;

export type Job = (typeof Jobs)[keyof typeof Jobs];

type JobsData = {
  // Profile generation jobs
  [Jobs.GENERATE_CV_PDF]: GenerateCVPDFJob;

  // Worker queue jobs
  [Jobs.SEND_MAIL]: SendMailJob | SendMailJob[];
  [Jobs.NEWSLETTER_SUBSCRIPTION]: NewsletterSubscriptionJob;
  [Jobs.CREATE_OR_UPDATE_SALESFORCE_USER]: CreateOrUpdateSalesforceUserJob;
  [Jobs.CREATE_OR_UPDATE_SALESFORCE_COMPANY]: CreateOrUpdateSalesforceCompanyJob;
  [Jobs.GENERATE_PROFILE_FROM_PDF]: GenerateProfileFromPDFJob;
  [Jobs.UPDATE_SALESFORCE_USER_COMPANY]: UpdateSalesforceUserCompanyJob;

  // Cron tasks jobs
  [Jobs.SEND_REMINDER_TO_USER_NOT_COMPLETED_ONBOARDING]: SendReminderToUserNotCompletedOnboardingJob;
  [Jobs.DELETE_INACTIVE_USERS]: DeleteInactiveUsersJob;
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

export interface CreateOrUpdateSalesforceUserJob {
  userId: string;
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
  companyId?: string;
  isCompanyAdmin?: boolean;
  companyRole?: CompanyUserRole;
}

export interface CreateOrUpdateSalesforceCompanyJob {
  name: string;
  department?: string;
  phone?: string;
  userId?: string;
}

export interface UpdateSalesforceUserCompanyJob {
  userId: string;
  companyId: string | null;
}

export interface GenerateProfileFromPDFJob {
  s3Key: string;
  userProfileId: string;
  userId: string;
  fileHash: string;
}

export interface SendReminderToUserNotCompletedOnboardingJob {}

export interface DeleteInactiveUsersJob {}

export const Queues = {
  WORK: 'work',
  PROFILE_GENERATION: 'profile-generation',
  CRON_TASKS: 'cron-tasks',
} as const;

export type Queue = (typeof Queues)[keyof typeof Queues];

export enum QueuePriority {
  LOW = 100,
  NORMAL = 2,
  HIGH = 10,
}
