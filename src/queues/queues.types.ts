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
  MailjetContactSource,
  MailjetTemplate,
} from 'src/external-services/mailjet/mailjet.types';

export const Jobs = {
  // Jobs related to worker queue
  SEND_MAIL: 'send_mail',
  SEND_SMS: 'send_sms',
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
  PREPARE_RECOMMENDATION_MAILS: 'prepare_recommendation_mails',
  PREPARE_AUTO_SET_UNAVAILABLE_USERS: 'prepare_auto_set_unavailable_users',
  PROCESS_EXPIRED_ACHIEVEMENTS: 'process_expired_achievements',
  PREPARE_SUPER_ENGAGED_ACHIEVEMENT_REMINDER_MAILS:
    'prepare_super_engaged_achievement_reminder_mails',
  PREPARE_RECRUITMENT_ALERTS_MAILS: 'prepare_recruitment_alerts_mails',
  PREPARE_COMPANY_NO_ALERTS_REMINDER_MAILS:
    'prepare_company_no_alerts_reminder_mails',
  PREPARE_REFERED_NOT_ACTIVATED_MAILS: 'prepare_refered_not_activated_mails',
  PREPARE_REMIND_COMPANY_INVITATION_MAILS:
    'prepare_remind_company_invitation_mails',
  PREPARE_COMPANY_INVITATIONS_PENDING_MAILS:
    'prepare_company_invitations_pending_mails',
  PREPARE_NOT_COMPLETED_COMPANY_MAILS: 'prepare_not_completed_company_mails',
  PREPARE_COMPANY_COLLAB_FOLLOW_MAILS: 'prepare_company_collab_follow_mails',
  PREPARE_COMMITTED_USERS_FEEDBACK_MAILS:
    'prepare_committed_users_feedback_mails',
  PREPARE_UNANSWERED_CONVERSATIONS_MAILS:
    'prepare_unanswered_conversations_mails',
  PREPARE_UNAVAILABLE_USERS_MAILS: 'prepare_unavailable_users_mails',
  PREPARE_CHURN_USERS_FEEDBACK_MAILS: 'prepare_churn_users_feedback_mails',
  PREPARE_INACTIVE_REFERERS_MAILS: 'prepare_inactive_referers_mails',
  PREPARE_WARN_ACCOUNT_DELETION_MAILS: 'prepare_warn_account_deletion_mails',
  PREPARE_UNANSWERED_CONVERSATIONS_SMS: 'prepare_unanswered_conversations_sms',
  PREPARE_LINKEDIN_SHARE_PROFILE_MAILS: 'prepare_linkedin_share_profile_mails',
  PREPARE_UNAVAILABLE_SENDER_NOTIFICATION_MAILS:
    'prepare_unavailable_sender_notification_mails',
  SEND_ELEARNING_COMPLETION_REMINDER_MAILS:
    'send_elearning_completion_reminder_mails',
  DEACTIVATE_STALE_CONVERSATIONS: 'deactivate_stale_conversations',
  PREPARE_CHECKIN_INVITATION_MAILS: 'prepare_checkin_invitation_mails',
  PREPARE_CHECKIN_RELANCE_MAILS: 'prepare_checkin_relance_mails',
  SEND_UNVERIFIED_ACCOUNT_RELAUNCH_MAILS:
    'send_unverified_account_relaunch_mails',

  // Jobs related to embedding queue
  UPDATE_USER_PROFILE_EMBEDDINGS: 'update_user_profile_embeddings',
  UPDATE_USER_PROFILE_EMBEDDINGS_BATCH: 'update_user_profile_embeddings_batch',

  // Jobs related to user newsletter subscription
  USER_NEWSLETTER_SUBSCRIPTION: 'user_newsletter_subscription',
} as const;

export type Job = (typeof Jobs)[keyof typeof Jobs];

type JobsData = {
  // Worker queue jobs
  [Jobs.SEND_MAIL]: SendMailJob | SendMailJob[];
  [Jobs.SEND_SMS]: SendSmsJob;
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
  [Jobs.PREPARE_RECOMMENDATION_MAILS]: PrepareRecommendationMailsJob;
  [Jobs.PREPARE_AUTO_SET_UNAVAILABLE_USERS]: PrepareAutoSetUnavailableUsersJob;
  [Jobs.PROCESS_EXPIRED_ACHIEVEMENTS]: ProcessExpiredAchievementsJob;
  [Jobs.PREPARE_SUPER_ENGAGED_ACHIEVEMENT_REMINDER_MAILS]: PrepareSuperEngagedAchievementReminderMailsJob;
  [Jobs.PREPARE_RECRUITMENT_ALERTS_MAILS]: PrepareRecruitmentAlertsMailsJob;
  [Jobs.PREPARE_COMPANY_NO_ALERTS_REMINDER_MAILS]: PrepareCompanyNoAlertsReminderMailsJob;
  [Jobs.PREPARE_REFERED_NOT_ACTIVATED_MAILS]: PrepareReferedNotActivatedMailsJob;
  [Jobs.PREPARE_REMIND_COMPANY_INVITATION_MAILS]: PrepareRemindCompanyInvitationMailsJob;
  [Jobs.PREPARE_COMPANY_INVITATIONS_PENDING_MAILS]: PrepareCompanyInvitationsPendingMailsJob;
  [Jobs.PREPARE_NOT_COMPLETED_COMPANY_MAILS]: PrepareNotCompletedCompanyMailsJob;
  [Jobs.PREPARE_COMPANY_COLLAB_FOLLOW_MAILS]: PrepareCompanyCollabFollowMailsJob;
  [Jobs.PREPARE_COMMITTED_USERS_FEEDBACK_MAILS]: PrepareCommittedUsersFeedbackMailsJob;
  [Jobs.PREPARE_UNANSWERED_CONVERSATIONS_MAILS]: PrepareUnansweredConversationsMailsJob;
  [Jobs.PREPARE_UNAVAILABLE_USERS_MAILS]: PrepareUnavailableUsersMailsJob;
  [Jobs.PREPARE_CHURN_USERS_FEEDBACK_MAILS]: PrepareChurnUsersFeedbackMailsJob;
  [Jobs.PREPARE_INACTIVE_REFERERS_MAILS]: PrepareInactiveReferersMailsJob;
  [Jobs.PREPARE_WARN_ACCOUNT_DELETION_MAILS]: PrepareWarnAccountDeletionMailsJob;
  [Jobs.PREPARE_UNANSWERED_CONVERSATIONS_SMS]: PrepareUnansweredConversationsSmsJob;
  [Jobs.PREPARE_LINKEDIN_SHARE_PROFILE_MAILS]: PrepareLinkedInShareProfileMailsJob;
  [Jobs.PREPARE_UNAVAILABLE_SENDER_NOTIFICATION_MAILS]: PrepareUnavailableSenderNotificationMailsJob;
  [Jobs.SEND_ELEARNING_COMPLETION_REMINDER_MAILS]: SendElearningCompletionReminderMailsJob;
  [Jobs.DEACTIVATE_STALE_CONVERSATIONS]: DeactivateStaleConversationsJob;
  [Jobs.PREPARE_CHECKIN_INVITATION_MAILS]: PrepareCheckinInvitationMailsJob;
  [Jobs.PREPARE_CHECKIN_RELANCE_MAILS]: PrepareCheckinRelanceMailsJob;
  [Jobs.SEND_UNVERIFIED_ACCOUNT_RELAUNCH_MAILS]: SendUnverifiedAccountRelaunchMailsJob;

  // Embedding queue jobs
  [Jobs.UPDATE_USER_PROFILE_EMBEDDINGS]: UpdateUserProfileEmbeddingsJob;
  [Jobs.UPDATE_USER_PROFILE_EMBEDDINGS_BATCH]: UpdateUserProfileEmbeddingsBatchJob;

  // User newsletter subscription
  [Jobs.USER_NEWSLETTER_SUBSCRIPTION]: UserNewsletterSubscriptionJob;
};

export type JobData<T extends Job> = JobsData[T];

export interface SendMailJob extends CustomMailParams {
  templateId: MailjetTemplate;
  variables: object;
}

export interface SendSmsJob {
  text: string;
  to: string;
}

export type NewsletterSubscriptionJob = CustomContactParams;

export interface UserNewsletterSubscriptionJob {
  source: MailjetContactSource;
  userId: string;
}

export interface CreateOrUpdateSalesforceUserJob {
  accommodation?: CandidateAccommodation;
  birthDate?: Date;
  campaign?: string;
  companyId?: string;
  companyRole?: CompanyUserRole;
  gender?: CandidateGender;
  hasSocialWorker?: YesNoJNSPRValue;
  isCompanyAdmin?: boolean;
  jobSearchDuration?: JobSearchDuration;
  nationality?: Nationality;
  refererEmail?: string;
  resources?: CandidateResource;
  structure?: string;
  studiesLevel?: StudiesLevel;
  userId: string;
  workingExperience?: WorkingExperience;
  workingRight?: CandidateYesNoNSPPValue;
}

export interface CreateOrUpdateSalesforceCompanyJob {
  department?: string;
  name: string;
  phone?: string;
  userId?: string;
}

export interface UpdateSalesforceUserCompanyJob {
  companyId: string | null;
  userId: string;
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
  cancelled?: boolean;
  fileHash: string;
  s3Key: string;
  userId: string;
  userProfileId: string;
}

export type SendReminderToUserNotCompletedOnboardingJob = Record<string, never>;

export type DeleteInactiveUsersJob = Record<string, never>;

export type PreparePostOnboardingCompletionMailsJob = Record<string, never>;

export type PrepareNotCompletedProfileMailsJob = Record<string, never>;

export type PrepareUserWithoutResponseToFirstMessageMailsJob = Record<
  string,
  never
>;

export type PrepareUserConversationFollowUpMailsJob = Record<string, never>;

export type PrepareRecommendationMailsJob = Record<string, never>;

export type PrepareAutoSetUnavailableUsersJob = Record<string, never>;

export type ProcessExpiredAchievementsJob = Record<string, never>;

export type PrepareSuperEngagedAchievementReminderMailsJob = Record<
  string,
  never
>;

export type PrepareRecruitmentAlertsMailsJob = Record<string, never>;

export type PrepareCompanyNoAlertsReminderMailsJob = Record<string, never>;

export type PrepareReferedNotActivatedMailsJob = Record<string, never>;

export type PrepareRemindCompanyInvitationMailsJob = Record<string, never>;

export type PrepareCompanyInvitationsPendingMailsJob = Record<string, never>;

export type PrepareNotCompletedCompanyMailsJob = Record<string, never>;

export type PrepareCompanyCollabFollowMailsJob = Record<string, never>;

export type PrepareCommittedUsersFeedbackMailsJob = Record<string, never>;

export type PrepareCheckinInvitationMailsJob = Record<string, never>;
export type PrepareCheckinRelanceMailsJob = Record<string, never>;
export type SendUnverifiedAccountRelaunchMailsJob = Record<string, never>;

export type PrepareUnansweredConversationsMailsJob = Record<string, never>;

export type PrepareUnavailableUsersMailsJob = Record<string, never>;

export type PrepareChurnUsersFeedbackMailsJob = Record<string, never>;

export type PrepareInactiveReferersMailsJob = Record<string, never>;

export type PrepareWarnAccountDeletionMailsJob = Record<string, never>;

export type PrepareUnansweredConversationsSmsJob = Record<string, never>;

export type PrepareLinkedInShareProfileMailsJob = Record<string, never>;

export type PrepareUnavailableSenderNotificationMailsJob = Record<
  string,
  never
>;

export type SendElearningCompletionReminderMailsJob = Record<string, never>;

export type DeactivateStaleConversationsJob = Record<string, never>;

export interface UpdateUserProfileEmbeddingsJob {
  embeddingTypes: EmbeddingType[];
  userId: string;
}

export interface UpdateUserProfileEmbeddingsBatchJob {
  embeddingTypes: EmbeddingType[];
  userIds: string[];
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
