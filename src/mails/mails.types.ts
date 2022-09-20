import { FilterConstant } from 'src/utils/types';

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
  OFFER_EXTERNAL_RECEIVED: 3579003,
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
} as const;

export type MailjetTemplateKey = keyof typeof MailjetTemplates;

export type MailjetTemplate = typeof MailjetTemplates[MailjetTemplateKey];

export type HeardAbout =
  | 'contact'
  | 'search'
  | 'socialAdd'
  | 'otherAdd'
  | 'press'
  | 'other';

export const HeardAboutFilters: FilterConstant<HeardAbout>[] = [
  {
    label: 'Par un de mes contacts',
    value: 'contact',
  },
  {
    label: 'Recherche internet',
    value: 'search',
  },
  {
    label: 'Publicité sur les réseaux sociaux',
    value: 'socialAdd',
  },
  {
    label: 'Autre publicité',
    value: 'otherAdd',
  },
  {
    label: 'Press',
    value: 'press',
  },
  {
    label: 'Autre',
    value: 'other',
  },
];

export const ContactStatuses = {
  INDIVIDUAL: 'PARTICULIER',
  COMPANY: 'ENTREPRISE',
  STRUCTURE: 'STRUCTURE_INSERTION',
  CANDIDATE: 'CANDIDAT_POTENTIEL',
} as const;

export type ContactStatus =
  typeof ContactStatuses[keyof typeof ContactStatuses];
