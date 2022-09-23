import Mailchimp, { AddListMemberBody } from '@mailchimp/mailchimp_marketing';
import { Injectable } from '@nestjs/common';

import { AdminZone } from 'src/utils/types';
import { ContactStatus } from './mailchimp.types';

@Injectable()
export class MailchimpService {
  private add: typeof Mailchimp.lists.addListMember;

  constructor() {
    Mailchimp.setConfig({
      apiKey: process.env.MAILCHIMP_API_KEY,
      server: 'us12',
    });
    this.add = Mailchimp.lists.addListMember;
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

    return this.add(process.env.MAILCHIMP_AUDIENCE_ID, {
      email_address: email,
      status: 'subscribed',
      tags,
    });
  }
}
