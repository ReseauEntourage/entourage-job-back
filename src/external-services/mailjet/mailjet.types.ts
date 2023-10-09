import { AdminZone, AdminZones } from 'src/utils/types';

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
  zone: AdminZone | AdminZone[];
  status: ContactStatus | ContactStatus[];
}

export const MailjetTemplates = {
  ACCOUNT_CREATED: 3920498,
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
  OFFERS_RECAP: 3279701,
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
} as const;

export type MailjetTemplateKey = keyof typeof MailjetTemplates;

export type MailjetTemplate = typeof MailjetTemplates[MailjetTemplateKey];

export const ContactStatuses = {
  INDIVIDUAL: 'PARTICULIER',
  COMPANY: 'ENTREPRISE',
  STRUCTURE: 'STRUCTURE_INSERTION',
  CANDIDATE: 'CANDIDAT_POTENTIEL',
} as const;

export type ContactStatus =
  typeof ContactStatuses[keyof typeof ContactStatuses];

export const MailjetContactRegions: { [K in AdminZone]: string } = {
  [AdminZones.LYON]: AdminZones.LYON.toLowerCase(),
  [AdminZones.PARIS]: AdminZones.PARIS.toLowerCase(),
  [AdminZones.LILLE]: AdminZones.LILLE.toLowerCase(),
  [AdminZones.LORIENT]: AdminZones.LORIENT.toLowerCase(),
  [AdminZones.RENNES]: AdminZones.RENNES.toLowerCase(),
  [AdminZones.HZ]: AdminZones.HZ.toLowerCase(),
} as const;

export const MailjetContactStatuses: { [K in ContactStatus]: string } = {
  PARTICULIER: 'un-particulier',
  ENTREPRISE: 'une-entreprise',
  STRUCTURE_INSERTION: 'une-structure-d-insertion',
  CANDIDAT_POTENTIEL: 'un-candidat-potentiel',
} as const;

export interface MailjetError {
  statusCode: number;
  ErrorMessage: string;
}
