import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Email, connect } from 'node-mailjet';
import _ from 'lodash';
import SendParams = Email.SendParams;
import { MailjetTemplate, MailjetTemplates } from 'src/mails/mails.service';
import { Queues } from '../queues/queues.type';

interface CustomMailParams {
  toEmail:
    | string
    | string[]
    | { to: string | string[]; cc: string | string[]; bcc: string | string[] };
  subject?: string;
  text?: string;
  html?: string;
  variables?: object;
  templateId: MailjetTemplate;
}

@Injectable()
export class MailjetService {
  private send: Email.PostResource;

  constructor(@InjectQueue(Queues.WORK) private workQueue: Queue) {
    const mailjet = connect(
      `${process.env.MAILJET_PUB}`,
      `${process.env.MAILJET_SEC}`,
    );

    this.send = mailjet.post('send', { version: 'v3.1' });
  }

  createMail({
    toEmail,
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
          CustomCampaign:
            `${process.env.MAILJET_CAMPAIGNS_ACTIVATED}` === 'true'
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
}
