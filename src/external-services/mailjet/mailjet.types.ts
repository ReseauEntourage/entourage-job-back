import { BulkContactManagement } from 'node-mailjet';
import { RequestConstructorConfig } from 'node-mailjet/declarations/request/Request';
import { AdminZone } from 'src/utils/types';

export const MailjetOptions: { [K in string]: RequestConstructorConfig } = {
  MAILS: { version: 'v3.1' },
  CONTACTS: { version: 'v3' },
} as const;

export interface CustomMailParams {
  toEmail:
    | string
    | string[]
    | {
        to: string | string[];
        cc?: string | string[];
        bcc?: string | string[];
      };
  replyTo?: string;
  subject?: string;
  text?: string;
  html?: string;
  variables?: object;
  templateId: MailjetTemplate;
}

export interface CustomContactParams {
  email: string;
  zone: AdminZone;
  status: ContactStatus;
}

export const MailjetContactTagNames = {
  NEWSLETTER: 'newsletter_linkedout',
  ZONE: 'antenne_linkedout',
  STATUS: 'profil_linkedout',
} as const;

const MailjetListActionsValues = {
  NO_FORCE: 'addnoforce',
  FORCE: 'addforce',
} as const;

// Hack because error when getting ManageContactsAction enum value
export const MailjetListActions = MailjetListActionsValues as Record<
  keyof typeof MailjetListActionsValues,
  BulkContactManagement.ManageContactsAction
>;

export interface MailjetContactProperties {
  [MailjetContactTagNames.NEWSLETTER]: boolean;
  [MailjetContactTagNames.ZONE]: AdminZone;
  [MailjetContactTagNames.STATUS]: ContactStatus;
}

export const MailjetTemplates = {
  ACCOUNT_CREATED: 3920498,
  WELCOME_COACH: 5786622,
  WELCOME_CANDIDATE: 5786606,
  WELCOME_REFERER: 6324333,
  CV_PREPARE: 3782475,
  CV_REMINDER_10: 3782934,
  CV_REMINDER_20: 3917533,
  CV_SUBMITTED: 3271289,
  CV_PUBLISHED: 3784733,
  PASSWORD_RESET: 3271976,
  CONTACT_FORM: 3272334,
  STATUS_CHANGED: 3275058,
  OFFER_TO_VALIDATE: 3275461,
  OFFER_EXTERNAL_RECEIVED_ADMIN: 3579003,
  OFFER_EXTERNAL_RECEIVED_COACH: 4545398,
  OFFER_RECEIVED: 3275876,
  OFFER_RECOMMENDED: 3489932,
  OFFER_SENT: 3276147,
  OFFER_VALIDATED_PRIVATE: 3908821,
  OFFER_VALIDATED_PUBLIC: 3907763,
  OFFER_VALIDATED_ADMIN: 3320744,
  OFFER_REMINDER: 3762676,
  INTERVIEW_TRAINING_REMINDER: 3917636,
  VIDEO_REMINDER: 3785221,
  ACTIONS_REMINDER: 3785473,
  EXTERNAL_OFFERS_REMINDER: 3785475,
  OFFER_PRIVATE_NO_RESPONSE: 3905256,
  OFFER_PUBLIC_NO_RESPONSE: 3905556,
  OFFER_REFUSED: 3905291,
  CONTACT_EMPLOYER: 4550570,
  RELANCE_EMPLOYER: 4550652,
  ARCHIVE_REMINDER: 4593081,
  MESSAGE_RECEIVED: 4918707,
  INTERNAL_MESSAGE: 5625323,
  INTERNAL_MESSAGE_CONFIRMATION: 5625495,
  MESSAGING_MESSAGE: 6305900,
  USER_EMAIL_VERIFICATION: 5899611,
  USER_REPORTED_ADMIN: 6223181,
  CONVERSATION_REPORTED_ADMIN: 6276909,
  ONBOARDING_J1_BAO: 6129684,
  ONBOARDING_J3_PROFILE_COMPLETION: 6129711,
  REFERER_ONBOARDING_CONFIRMATION: 6324339,
  REFERED_CANDIDATE_FINALIZE_ACCOUNT: 6324039,
} as const;

export type MailjetTemplateKey = keyof typeof MailjetTemplates;

export type MailjetTemplate = (typeof MailjetTemplates)[MailjetTemplateKey];

export const ContactStatuses = {
  INDIVIDUAL: 'PARTICULIER',
  COMPANY: 'ENTREPRISE',
  ASSOCIATION: 'ASSOCIATION',
  CANDIDATE: 'CANDIDAT',
} as const;

export type ContactStatus =
  (typeof ContactStatuses)[keyof typeof ContactStatuses];
