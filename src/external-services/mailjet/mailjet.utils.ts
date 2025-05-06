import _ from 'lodash';
import { SendEmailV3_1 } from 'node-mailjet';
import { UserRole, UserRoles } from 'src/users/users.types';
import {
  ContactStatus,
  ContactStatuses,
  CustomMailParams,
  MailjetTemplates,
} from './mailjet.types';

const useCampaigns = process.env.MAILJET_CAMPAIGNS_ACTIVATED === 'true';

export function createMail({
  toEmail,
  replyTo,
  subject,
  text,
  html,
  variables,
  templateId,
}: CustomMailParams) {
  const recipients: SendEmailV3_1.Body['Messages'][number] = {
    To: [],
    Cc: [],
    From: { Email: '' },
  };
  if (typeof toEmail === 'string') {
    recipients.To = [{ Email: toEmail }];
  } else if (Array.isArray(toEmail)) {
    recipients.To = toEmail.map((email) => {
      return { Email: email };
    });
  } else if (typeof toEmail === 'object') {
    const { to, cc, bcc } = toEmail;
    if (cc) {
      recipients.Cc = Array.isArray(cc)
        ? cc.map((email) => {
            return { Email: email };
          })
        : [{ Email: cc }];
    }
    if (to) {
      recipients.To = Array.isArray(to)
        ? to.map((email) => {
            return { Email: email };
          })
        : [{ Email: to }];
    }
    if (bcc) {
      recipients.Bcc = Array.isArray(bcc)
        ? bcc.map((email) => {
            return { Email: email };
          })
        : [{ Email: bcc }];
    }
  }

  const content = templateId
    ? {
        Variables: {
          siteLink: process.env.FRONT_URL,
          ...variables,
        },
        TemplateID: templateId,
        CustomCampaign: useCampaigns
          ? _.findKey(MailjetTemplates, (id) => {
              return id === templateId;
            })
          : undefined,
        TemplateLanguage: true,
        TemplateErrorReporting: {
          Email: `${process.env.MAILJET_SUPPORT_EMAIL}`,
          Name: `${process.env.MAILJET_FROM_NAME}`,
        },
      }
    : {
        'Text-part': text,
        'HTML-part': html,
      };
  return {
    From: {
      Email: `${process.env.MAILJET_FROM_EMAIL}`,
      Name: `${process.env.MAILJET_FROM_NAME}`,
    },
    Subject: subject,
    Headers: replyTo
      ? {
          'Reply-To': replyTo,
        }
      : undefined,
    ...recipients,
    ...content,
  };
}

export function getContactStatusFromUserRole(role: UserRole): ContactStatus {
  switch (role) {
    case UserRoles.CANDIDATE:
      return ContactStatuses.CANDIDATE;
    case UserRoles.REFERER:
      return ContactStatuses.ASSOCIATION;
    case UserRoles.COACH:
      return ContactStatuses.INDIVIDUAL;
    case UserRoles.ADMIN:
      return ContactStatuses.INDIVIDUAL;
    default:
      return ContactStatuses.INDIVIDUAL;
  }
}
