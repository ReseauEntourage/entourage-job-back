import Mailchimp, { AddListMemberBody } from '@mailchimp/mailchimp_marketing';
import { Injectable } from '@nestjs/common';

import { AdminZone } from 'src/utils/types';
import { ContactStatus } from './mailchimp.types';

@Injectable()
export class MailchimpService {
  private mailchimp: typeof Mailchimp;

  constructor() {
    Mailchimp.setConfig({
      apiKey: process.env.MAILCHIMP_API_KEY,
      server: 'us12',
    });
    this.mailchimp = Mailchimp;
  }

  async sendContact(
    email: string,
    zone: AdminZone | AdminZone[],
    status: ContactStatus | ContactStatus[]
  ) {
    let tags: AddListMemberBody['tags'] = [];
    if (zone) {
      tags = [...tags, ...(Array.isArray(zone) ? zone : [zone])];
    }

    if (status) {
      tags = [...tags, ...(Array.isArray(status) ? status : [status])];
    }

    try {
      await this.mailchimp.lists.addListMember(
        process.env.MAILCHIMP_AUDIENCE_ID,
        {
          email_address: email,
          status: 'subscribed',
          tags,
        }
      );
    } catch (err) {
      if ((err as Mailchimp.MemberErrorResponse).status !== 400) {
        throw err;
      }
    }
  }
}
