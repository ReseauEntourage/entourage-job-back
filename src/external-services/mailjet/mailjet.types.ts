import { BulkContactManagement } from 'node-mailjet';
import { RequestConstructorConfig } from 'node-mailjet/declarations/request/Request';
import { ZoneName } from 'src/utils/types/zones.types';

export const MailjetOptions: { [K in string]: RequestConstructorConfig } = {
  MAILS: { version: 'v3.1' },
  CONTACTS: { version: 'v3' },
} as const;

export interface CustomMailParams {
  html?: string;
  replyTo?: string;
  subject?: string;
  templateId: MailjetTemplate;
  text?: string;
  toEmail:
    | string
    | string[]
    | {
        bcc?: string | string[];
        cc?: string | string[];
        to: string | string[];
      };
  variables?: object;
}

export enum MailjetContactPropertyNames {
  CIVILITY = 'civility',
  EMAIL = 'EMAIL',
  FIRSTNAME = 'first_name',
  IS_CANDIDATE = 'is_candidate',
  IS_COACH = 'is_coach',
  IS_COMPANY = 'is_company',
  IS_ORGANIZATION = 'is_organization',
  IS_PRECA = 'is_precarious',
  IS_VOLUNTEER = 'is_volunteer',
  LASTNAME = 'last_name',
  LOCAL_BRANCH = 'local_branch_pro',
  POSTAL_CODE = 'postal_code',
  PROGRAM = 'program',
  SOURCE = 'source',
}

export const ContactStatuses = {
  INDIVIDUAL: 'PARTICULIER',
  COMPANY: 'ENTREPRISE',
  ASSOCIATION: 'ASSOCIATION',
  CANDIDATE: 'CANDIDAT',
} as const;

export type ContactStatus =
  (typeof ContactStatuses)[keyof typeof ContactStatuses];

export interface CustomContactParams {
  email: string;
  source: MailjetContactSource;
  status?: ContactStatus;
  zone?: ZoneName;
}

export enum MailjetContactSource {
  BACKOFFICE_EP = 'Backoffice EP',
  SITE_EP = 'Site EP',
}

export const MailjetAntenneByZone: Record<ZoneName, string | null> = {
  [ZoneName.IDF]: 'Île-de-France',
  [ZoneName.NORD]: 'Haut-de-France',
  [ZoneName.AURA]: 'Sud-Est',
  [ZoneName.SUDOUEST]: 'Sud-Ouest',
  [ZoneName.BRETAGNE]: 'Ouest',
  [ZoneName.LORIENT]: 'Ouest',
  [ZoneName.HZ]: null,
};

export interface MailjetCreateContactDto {
  /** SfLocalBranchName derived from User.zone */
  antenne: string | null;
  /** 'M.' | 'Mme' | null */
  civility: string | null;
  email: string;
  firstName: string;
  isCandidate: boolean;
  isCoach: boolean;
  isCompany: boolean;
  isOrganization: boolean;
  isPreca: boolean;
  isVolunteer: boolean;
  lastName: string;
  /** Department code extracted from UserProfile.department, e.g. "75" */
  postalCode: string | null;
  program: string;
  source: MailjetContactSource;
}

const MailjetListActionsValues = {
  NO_FORCE: 'addnoforce',
  FORCE: 'addforce',
} as const;

// Hack because error when getting ManageContactsAction enum value
export const MailjetListActions = MailjetListActionsValues as Record<
  keyof typeof MailjetListActionsValues,
  BulkContactManagement.ManageContactsAction
>;

export type MailjetContactDto = {
  [MailjetContactPropertyNames.EMAIL]: string;
};

export const MailjetTemplates = {
  ACCOUNT_CREATED: 3920498,
  WELCOME_CANDIDATE_COACH: 7718550,
  WELCOME_COACH_COMPANY_ADMIN: 7312888,
  WELCOME_REFERER: 6324333,
  ONBOARDING_REMINDER: 7718674,
  ONBOARDING_COMPLETED: 7719908,
  PASSWORD_RESET: 3271976,
  CONTACT_FORM: 3272334,
  MESSAGING_MESSAGE: 6305900,
  USER_EMAIL_VERIFICATION: 8132248,
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
  ELEARNING_ALL_UNITS_COMPLETED: 7720521,
  ELEARNING_COMPLETION_REMINDER: 8259979,
  NOT_COMPLETED_PROFILE_REMINDER: 6559282,
  NO_RESPONSE_TO_FIRST_MESSAGE: 7749050,
  FOLLOW_UP_MUTUALLY_REPLIED_CONVERSATION: 7758555,
  MAILER_USER_RECOMMENDATIONS: 6060421,
  AUTO_SET_UNAVAILABLE: 7748944,
  SUPER_ENGAGED_ACHIEVEMENT: 7897486,
  SUPER_ENGAGED_ACHIEVEMENT_EXPIRED: 7906853,
  SUPER_ENGAGED_ACHIEVEMENT_REMINDER: 7910167,
  MAILER_RECRUITMENT_ALERT: 7292111,
  MAILER_COMPANY_NO_ALERTS_REMINDER: 7315221,
  MAILER_INACTIVE_REFERED_CANDIDATE: 6639650,
  MAILER_REMIND_COMPANY_INVITATION: 7314979,
  MAILER_INACTIVE_COLLABORATORS: 7316532,
  MAILER_NOT_COMPLETED_COMPANY: 7314566,
  MAILER_FOLLOW_COLLAB_COMPANY: 7316635,
  MAILER_COMMITTED_USERS_FEEDBACK: 6140990,
  MAILER_UNANSWERED_CONVERSATIONS: 6378821,
  MAILER_UNAVAILABLE_USER: 6655490,
  MAILER_CHURN_USERS_FEEDBACK: 6485209,
  MAILER_INACTIVE_REFERERS: 6639639,
  MAILER_WARN_ACCOUNT_DELETION: 6611907,
  MAILER_LINKEDIN_SHARE_PROFILE: 8052814,
  MAILER_UNAVAILABLE_SENDER_NOTIFICATION: 8156335,
  MAILER_CONVERSATION_CHECKIN_INVITATION: 8294344,
  MAILER_CONVERSATION_CHECKIN_RELANCE: 8294437,
} as const;

export type MailjetTemplateKey = keyof typeof MailjetTemplates;

export type MailjetTemplate = (typeof MailjetTemplates)[MailjetTemplateKey];
