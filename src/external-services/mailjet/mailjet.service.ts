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
  private mailjetTransactionalProxy: Client | null = null;
  private mailjetNewsletterProxy: Client | null = null;

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

    const proxyOptions = this.buildProxyOptions();
    if (proxyOptions) {
      this.mailjetTransactionalProxy = Mailjet.apiConnect(
        process.env.MAILJET_PUB,
        process.env.MAILJET_SEC,
        { options: proxyOptions }
      );
      this.mailjetNewsletterProxy = Mailjet.apiConnect(
        process.env.MAILJET_NEWSLETTER_PUB,
        process.env.MAILJET_NEWSLETTER_SEC,
        { options: proxyOptions }
      );
    }
  }

  private buildProxyOptions(): Record<string, unknown> | null {
    const fixieUrl = process.env.FIXIE_URL;
    if (!fixieUrl) return null;

    const url = new URL(fixieUrl);
    return {
      proxy: {
        protocol: url.protocol.replace(':', ''),
        host: url.hostname,
        port: parseInt(url.port, 10),
        ...(url.username && {
          auth: { username: url.username, password: url.password },
        }),
      },
    };
  }

  private isConnectionError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: string }).code === 'ECONNRESET'
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
      if (this.isConnectionError(error) && this.mailjetTransactionalProxy) {
        this.logger.warn('sendMail: ECONNRESET, retrying via Fixie proxy');
        try {
          return await this.mailjetTransactionalProxy
            .post('send', MailjetOptions.MAILS)
            .request(mailjetParams);
        } catch (proxyError) {
          this.logger.error(proxyError);
          throw proxyError;
        }
      }
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
      if (this.isConnectionError(error) && this.mailjetNewsletterProxy) {
        this.logger.warn('sendContact: ECONNRESET, retrying via Fixie proxy');
        try {
          return await this.mailjetNewsletterProxy
            .post('contactslist', MailjetOptions.CONTACTS)
            .id(parseInt(process.env.MAILJET_NEWSLETTER_LIST_ID))
            .action('managecontact')
            .request(contact);
        } catch (proxyError) {
          this.logger.error(proxyError);
          throw proxyError;
        }
      }
    }
  }
}
