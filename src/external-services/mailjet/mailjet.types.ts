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
  PASSWORD_RESET: 3271976,
  CONTACT_FORM: 3272334,
  MESSAGE_RECEIVED: 4918707,
  INTERNAL_MESSAGE: 5625323,
  INTERNAL_MESSAGE_CONFIRMATION: 5625495,
  MESSAGING_MESSAGE: 6305900,
  USER_EMAIL_VERIFICATION: 5899611,
  USER_REPORTED_ADMIN: 6223181,
  CONVERSATION_REPORTED_ADMIN: 6276909,
  ONBOARDING_J1_BAO: 6129684,
  ONBOARDING_J3_WEBINAR: 6129711,
  ONBOARDING_J4_CONTACT_ADVICE: 6559473,
  REFERER_ONBOARDING_CONFIRMATION: 6324339,
  REFERER_CANDIDATE_HAS_FINALIZED_ACCOUNT: 6482813,
  REFERED_CANDIDATE_FINALIZE_ACCOUNT: 6324039,
  ADMIN_NEW_REFERER_NOTIFICATION: 6328158,
  USER_ACCOUNT_DELETED: 6647841,
  COMPANY_COLLABORATORS_INVITATION: 7175134,
  COMPANY_INVITATION_USED: 7316486,
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
