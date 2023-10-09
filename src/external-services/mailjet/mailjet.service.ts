import { Injectable } from '@nestjs/common';
import _ from 'lodash';
import { connect, Email } from 'node-mailjet';
import {
  CustomContactParams,
  CustomMailParams,
  MailjetError,
  MailjetTemplates,
} from './mailjet.types';
import SendParams = Email.SendParams;
import SendParamsRecipient = Email.SendParamsRecipient;

const useCampaigns = process.env.MAILJET_CAMPAIGNS_ACTIVATED === 'true';

@Injectable()
export class MailjetService {
  private send: Email.PostResource;
  private contact: Email.PostResource;

  constructor() {
    const mailjetTransactional = connect(
      `${process.env.MAILJET_PUB}`,
      `${process.env.MAILJET_SEC}`
    );

    this.send = mailjetTransactional.post('send', {
      version: 'v3.1',
    });

    const mailjetNewsletter = connect(
      `${process.env.MAILJET_NEWSLETTER_PUB}`,
      `${process.env.MAILJET_NEWSLETTER_SEC}`
    );

    this.contact = mailjetNewsletter.post('contact', { version: 'v3' });
  }

  createMail({
    toEmail,
    replyTo,
    subject,
    text,
    html,
    variables,
    templateId,
  }: CustomMailParams) {
    const recipients: SendParams['Messages'][number] = {
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

  async sendMail(params: CustomMailParams | CustomMailParams[]) {
    const mailjetParams: SendParams = { Messages: [] };
    if (Array.isArray(params)) {
      mailjetParams.Messages = params.map((p) => {
        return this.createMail(p);
      });
    } else {
      mailjetParams.Messages = [this.createMail(params)];
    }

    return this.send.request(mailjetParams);
  }

  createContact({ email /* status, zone */ }: CustomContactParams) {
    const contacts: SendParamsRecipient = {
      Email: email,
    };
    return contacts;
  }

  async sendContact(params: CustomContactParams) {
    const mailjetParams: SendParamsRecipient = this.createContact(params);

    try {
      await this.contact.request(mailjetParams);
    } catch (err) {
      console.error(err);
      // Check if not a duplicate value error, otherwise consider it as successful request
      if (
        (err as MailjetError).statusCode !== 400 ||
        !(err as MailjetError).ErrorMessage.includes('MJ18')
      ) {
        throw err;
      }
    }
  }
}
