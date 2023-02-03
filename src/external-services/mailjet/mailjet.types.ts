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
  OFFER_EXTERNAL_RECEIVED_ADMIN: 3579003,
  OFFER_EXTERNAL_RECEIVED_COACH: 10656249,
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
  CONTACT_EMPLOYER: 10661442,
  RELANCE_EMPLOYER: 10661492,
} as const;

export type MailjetTemplateKey = keyof typeof MailjetTemplates;

export type MailjetTemplate = typeof MailjetTemplates[MailjetTemplateKey];
