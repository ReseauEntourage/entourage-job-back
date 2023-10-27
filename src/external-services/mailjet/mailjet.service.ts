import { Injectable } from '@nestjs/common';
import { connect, Email } from 'node-mailjet';
import {
  CustomContactParams,
  CustomMailParams,
  MailjetContactList,
  MailjetContactTag,
  MailjetContactTagNames,
  MailjetCustomContact,
  MailjetCustomResponse,
  MailjetListActions,
} from './mailjet.types';
import { createMail } from './mailjet.utils';
import SendParams = Email.SendParams;
import SendParamsRecipient = Email.SendParamsRecipient;

@Injectable()
export class MailjetService {
  private mailjetTransactional: Email.Client;
  private mailjetNewsletter: Email.Client;

  constructor() {
    this.mailjetTransactional = connect(
      `${process.env.MAILJET_PUB}`,
      `${process.env.MAILJET_SEC}`
    );

    this.mailjetNewsletter = connect(
      `${process.env.MAILJET_NEWSLETTER_PUB}`,
      `${process.env.MAILJET_NEWSLETTER_SEC}`
    );
  }

  async sendMail(params: CustomMailParams | CustomMailParams[]) {
    const mailjetParams: SendParams = { Messages: [] };
    if (Array.isArray(params)) {
      mailjetParams.Messages = params.map((p) => {
        return createMail(p);
      });
    } else {
      mailjetParams.Messages = [createMail(params)];
    }

    return this.mailjetTransactional
      .post('send', {
        version: 'v3.1',
      })
      .request(mailjetParams);
  }

  async findContact(
    email: CustomContactParams['email']
  ): Promise<MailjetCustomContact> {
    const contact: SendParamsRecipient = {
      Email: email.toLowerCase(),
    };

    const {
      body: { Data: data },
    } = (await this.mailjetNewsletter
      .get('contact', { version: 'v3' })
      .request(contact)) as MailjetCustomResponse;

    return data[0];
  }

  async createContact(
    email: CustomContactParams['email']
  ): Promise<MailjetCustomContact> {
    const contact: SendParamsRecipient = {
      Email: email,
    };
    const {
      body: { Data: data },
    } = (await this.mailjetNewsletter
      .post('contact', { version: 'v3' })
      .request(contact)) as MailjetCustomResponse;

    return data[0];
  }

  async updateContactTags(
    id: string,
    { zone, status }: Pick<CustomContactParams, 'zone' | 'status'>
  ) {
    let dataToUpdate: { Data: MailjetContactTag[] } = {
      Data: [
        {
          Name: MailjetContactTagNames.NEWSLETTER,
          Value: true,
        },
      ],
    };

    if (zone) {
      dataToUpdate = {
        Data: [
          ...dataToUpdate.Data,
          {
            Name: MailjetContactTagNames.ZONE,
            Value: zone,
          },
        ],
      };
    }
    if (status) {
      dataToUpdate = {
        Data: [
          ...dataToUpdate.Data,
          {
            Name: MailjetContactTagNames.STATUS,
            Value: status,
          },
        ],
      };
    }

    return this.mailjetNewsletter
      .put('contactdata', { version: 'v3' })
      .id(id)
      .request(dataToUpdate);
  }

  async subscribeToNewsletterList(id: string) {
    const dataToUpdate: { ContactsLists: MailjetContactList[] } = {
      ContactsLists: [
        {
          Action: MailjetListActions.FORCE,
          ListID: process.env.MAILJET_NEWSLETTER_LIST_ID,
        },
      ],
    };

    return this.mailjetNewsletter
      .post('contact', { version: 'v3' })
      .id(id)
      .action('managecontactslists')
      .request(dataToUpdate);
  }

  async sendContact({ email, zone, status }: CustomContactParams) {
    let contact = await this.findContact(email);
    if (!contact) {
      contact = await this.createContact(email);
    }
    await this.subscribeToNewsletterList(contact.ID);
    await this.updateContactTags(contact.ID, { zone, status });
  }
}
