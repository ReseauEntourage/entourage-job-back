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
import { EmbeddingType } from 'src/embeddings/embedding.config';
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
  ON_ONBOARDING_COMPLETED: 'on_onboarding_completed',
  SEND_STAFF_MESSAGING_MESSAGE: 'send_staff_messaging_message',
  BULK_SEND_STAFF_MESSAGING_MESSAGE: 'bulk_send_staff_messaging_message',

  // Jobs related to cron tasks
  SEND_REMINDER_TO_USER_NOT_COMPLETED_ONBOARDING:
    'send_reminder_to_user_not_completed_onboarding',
  DELETE_INACTIVE_USERS: 'delete_inactive_users',
  PREPARE_POST_ONBOARDING_COMPLETION_MAILS:
    'prepare_post_onboarding_completion_mails',
  PREPARE_NOT_COMPLETED_PROFILE_MAILS: 'prepare_not_completed_profile_mails',
  PREPARE_USER_WITHOUT_RESPONSE_TO_FIRST_MESSAGE_MAILS:
    'prepare_user_without_response_to_first_message_mails',
  PREPARE_USER_CONVERSATION_FOLLOW_UP_MAILS:
    'prepare_user_conversation_follow_up_mails',

  // Jobs related to embedding queue
  UPDATE_USER_PROFILE_EMBEDDINGS: 'update_user_profile_embeddings',
  UPDATE_USER_PROFILE_EMBEDDINGS_BATCH: 'update_user_profile_embeddings_batch',
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
  [Jobs.ON_ONBOARDING_COMPLETED]: OnOnboardingCompletedJob;
  [Jobs.SEND_STAFF_MESSAGING_MESSAGE]: SendStaffMessagingMessageJob;
  [Jobs.BULK_SEND_STAFF_MESSAGING_MESSAGE]: BulkSendStaffMessagingMessageJob;

  // Cron tasks jobs
  [Jobs.SEND_REMINDER_TO_USER_NOT_COMPLETED_ONBOARDING]: SendReminderToUserNotCompletedOnboardingJob;
  [Jobs.DELETE_INACTIVE_USERS]: DeleteInactiveUsersJob;
  [Jobs.PREPARE_POST_ONBOARDING_COMPLETION_MAILS]: PreparePostOnboardingCompletionMailsJob;
  [Jobs.PREPARE_NOT_COMPLETED_PROFILE_MAILS]: PrepareNotCompletedProfileMailsJob;
  [Jobs.PREPARE_USER_WITHOUT_RESPONSE_TO_FIRST_MESSAGE_MAILS]: PrepareUserWithoutResponseToFirstMessageMailsJob;
  [Jobs.PREPARE_USER_CONVERSATION_FOLLOW_UP_MAILS]: PrepareUserConversationFollowUpMailsJob;

  // Embedding queue jobs
  [Jobs.UPDATE_USER_PROFILE_EMBEDDINGS]: UpdateUserProfileEmbeddingsJob;
  [Jobs.UPDATE_USER_PROFILE_EMBEDDINGS_BATCH]: UpdateUserProfileEmbeddingsBatchJob;
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

export interface OnOnboardingCompletedJob {
  userId: string;
}

export interface SendStaffMessagingMessageJob {
  addresseeEmail: string;
  message: string;
}

export interface BulkSendStaffMessagingMessageJob {
  messages: SendStaffMessagingMessageJob[];
}

export interface GenerateProfileFromPDFJob {
  s3Key: string;
  userProfileId: string;
  userId: string;
  fileHash: string;
}

export interface SendReminderToUserNotCompletedOnboardingJob {}

export interface DeleteInactiveUsersJob {}

export interface PreparePostOnboardingCompletionMailsJob {}

export interface PrepareNotCompletedProfileMailsJob {}

export interface PrepareUserWithoutResponseToFirstMessageMailsJob {}

export interface PrepareUserConversationFollowUpMailsJob {}

export interface UpdateUserProfileEmbeddingsJob {
  userId: string;
  embeddingTypes: EmbeddingType[];
}

export interface UpdateUserProfileEmbeddingsBatchJob {
  userIds: string[];
  embeddingTypes: EmbeddingType[];
}

export const Queues = {
  WORK: 'work',
  PROFILE_GENERATION: 'profile-generation',
  CRON_TASKS: 'cron-tasks',
  EMBEDDING: 'embedding',
} as const;

export type Queue = (typeof Queues)[keyof typeof Queues];

// Note: in Bull/BullMQ, lower numeric values are processed first (higher priority).
export enum QueuePriority {
  HIGH = 1,
  NORMAL = 10,
  LOW = 100,
}
