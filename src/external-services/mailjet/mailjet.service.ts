import { Injectable, Logger } from '@nestjs/common';
import Mailjet, {
  Client,
  ContactSubscription,
  SendEmailV3_1,
} from 'node-mailjet';

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
  private readonly logger = new Logger(MailjetService.name);

  private mailjetTransactional: Client | null = null;
  private mailjetNewsletter: Client | null = null;

  constructor() {
    if (!process.env.MAILJET_PUB || !process.env.MAILJET_SEC) {
      throw new Error('Mailjet transactional API keys are not set');
    }
    this.mailjetTransactional = Mailjet.apiConnect(
      process.env.MAILJET_PUB,
      process.env.MAILJET_SEC
    );

    if (
      !process.env.MAILJET_NEWSLETTER_PUB ||
      !process.env.MAILJET_NEWSLETTER_SEC
    ) {
      throw new Error('Mailjet newsletter API keys are not set');
    }
    this.mailjetNewsletter = Mailjet.apiConnect(
      process.env.MAILJET_NEWSLETTER_PUB,
      process.env.MAILJET_NEWSLETTER_SEC
    );
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
      this.logger.error(error);
      throw error;
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
      this.logger.error(error);
      throw error;
    }
  }
}
