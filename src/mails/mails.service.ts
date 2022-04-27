import { InjectQueue } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bull';
import * as _ from 'lodash';
import { Jobs, Queues } from 'src/queues/queues.type';
import { User } from 'src/users';

export const MailjetTemplates = {
  ACCOUNT_CREATED: 3267718,
  CV_SUBMITTED: 3271289,
  PASSWORD_RESET: 3271976,
  CONTACT_FORM: 3272334,
  STATUS_CHANGED: 3275058,
  OFFER_TO_VALIDATE: 3275461,
  OFFER_EXTERNAL_RECEIVED: 3579003,
  OFFER_RECEIVED: 3275876,
  OFFER_RECOMMENDED: 3489932,
  OFFER_SENT: 3276147,
  OFFER_VALIDATED: 3277863,
  OFFER_VALIDATED_ADMIN: 3320744,
  OFFER_REMINDER: 3279365,
  OFFERS_RECAP: 3279701,
} as const;

export type MailjetTemplate =
  typeof MailjetTemplates[keyof typeof MailjetTemplates];

@Injectable()
export class MailsService {
  constructor(@InjectQueue(Queues.WORK) private workQueue: Queue) {}

  async sendPasswordResetLinkMail(user: Partial<User>, token: string) {
    return this.workQueue.add(Jobs.SEND_MAIL, {
      toEmail: user.email,
      templateId: MailjetTemplates.PASSWORD_RESET,
      variables: {
        ..._.omitBy(user, _.isNil),
        token,
      },
    });
  }
}
