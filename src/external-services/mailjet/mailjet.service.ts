import { Injectable } from '@nestjs/common';
import { Client, ContactSubscription, SendEmailV3_1 } from 'node-mailjet';

import {
  CustomContactParams,
  CustomMailParams,
  MailjetContactProperties,
  MailjetContactTagNames,
  MailjetListActions,
  MailjetOptions,
} from './mailjet.types';

import { createMail } from './mailjet.utils';

@Injectable()
export class MailjetService {
  private mailjetTransactional: Client;
  private mailjetNewsletter: Client;

  constructor() {
    this.refreshInstances();
  }

  refreshInstances() {
    this.mailjetTransactional = new Client({
      apiKey: `${process.env.MAILJET_PUB}`,
      apiSecret: `${process.env.MAILJET_SEC}`,
    });
    this.mailjetNewsletter = new Client({
      apiKey: `${process.env.MAILJET_NEWSLETTER_PUB}`,
      apiSecret: `${process.env.MAILJET_NEWSLETTER_SEC}`,
    });
  }

  async sendMail(params: CustomMailParams | CustomMailParams[]) {
    const mailjetParams: SendEmailV3_1.Body = { Messages: [] };
    if (Array.isArray(params)) {
      mailjetParams.Messages = params.map((p) => {
        return createMail(p);
      });
    } else {
      mailjetParams.Messages = [createMail(params)];
    }

    try {
      return await this.mailjetTransactional
        .post('send', MailjetOptions.MAILS)
        .request(mailjetParams);
    } catch (error) {
      console.error(error);
      console.error('Mailjet Connection Reset : Refreshing Instances');
      this.refreshInstances();
      return await this.mailjetTransactional
        .post('send', MailjetOptions.MAILS)
        .request(mailjetParams);
    }
  }

  async sendContact({ email, zone, status }: CustomContactParams) {
    let contactProperties: Partial<MailjetContactProperties> = {
      [MailjetContactTagNames.NEWSLETTER]: true,
    };

    if (zone) {
      contactProperties = {
        ...contactProperties,
        [MailjetContactTagNames.ZONE]: zone,
      };
    }
    if (status) {
      contactProperties = {
        ...contactProperties,
        [MailjetContactTagNames.STATUS]: status,
      };
    }

    const contact: ContactSubscription.PostContactsListManageContactBody = {
      Properties: contactProperties,
      Action: MailjetListActions.FORCE,
      Email: email,
    };

    try {
      return await this.mailjetNewsletter
        .post('contactslist', MailjetOptions.CONTACTS)
        .id(parseInt(process.env.MAILJET_NEWSLETTER_LIST_ID))
        .action('managecontact')
        .request(contact);
    } catch (error) {
      console.error(error);
      console.error('Mailjet Connection Reset : Refreshing Instances');
      this.refreshInstances();
      return await this.mailjetNewsletter
        .post('contactslist', MailjetOptions.CONTACTS)
        .id(parseInt(process.env.MAILJET_NEWSLETTER_LIST_ID))
        .action('managecontact')
        .request(contact);
    }
  }
}
