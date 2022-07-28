import { InjectQueue } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bull';
import * as _ from 'lodash';
import { Jobs, Queues } from 'src/queues';
import { User } from 'src/users';
import { getAdminMailsFromZone } from 'src/utils/misc';
import { CustomMailParams } from './mailjet.service';

export const MailjetTemplates = {
  ACCOUNT_CREATED: 3920498,
  CV_PREPARE: 3782475,
  CV_REMINDER_10: 3782934,
  CV_REMINDER_20: 3917533,
  CV_SUBMITTED: 3271289,
  CV_PUBLISHED: 3784733,
  PASSWORD_RESET: 3271976,
  CONTACT_FORM: 3272334,
  STATUS_CHANGED: 3275058,
  OFFER_TO_VALIDATE: 3275461,
  OFFER_EXTERNAL_RECEIVED: 3579003,
  OFFER_RECEIVED: 3275876,
  OFFER_RECOMMENDED: 3489932,
  OFFER_SENT: 3276147,
  OFFER_VALIDATED_PRIVATE: 3908821,
  OFFER_VALIDATED_PUBLIC: 3907763,
  OFFER_VALIDATED_ADMIN: 3320744,
  OFFER_REMINDER: 3762676,
  OFFERS_RECAP: 3279701,
  INTERVIEW_TRAINING_REMINDER: 3917636,
  VIDEO_REMINDER: 3785221,
  ACTIONS_REMINDER: 3785473,
  EXTERNAL_OFFERS_REMINDER: 3785475,
  OFFER_PRIVATE_NO_RESPONSE: 3905256,
  OFFER_PUBLIC_NO_RESPONSE: 3905556,
  OFFER_REFUSED: 3905291,
} as const;

export type MailjetTemplate =
  typeof MailjetTemplates[keyof typeof MailjetTemplates];

@Injectable()
export class MailsService {
  constructor(@InjectQueue(Queues.WORK) private workQueue: Queue) {}

  async sendPasswordResetLinkMail(
    user: Pick<User, 'id' | 'firstName' | 'role' | 'zone' | 'email'>,
    token: string
  ) {
    const { candidatesAdminMail } = getAdminMailsFromZone(user.zone);

    return this.workQueue.add(Jobs.SEND_MAIL, {
      toEmail: user.email,
      replyTo: candidatesAdminMail,
      templateId: MailjetTemplates.PASSWORD_RESET,
      variables: {
        ..._.omitBy(user, _.isNil),
        token,
      },
    });
  }

  async sendNewAccountMail(
    user: Pick<User, 'id' | 'firstName' | 'role' | 'zone' | 'email'>,
    token: string
  ) {
    const { candidatesAdminMail } = getAdminMailsFromZone(user.zone);

    return this.workQueue.add(Jobs.SEND_MAIL, {
      toEmail: user.email,
      replyTo: candidatesAdminMail,
      templateId: MailjetTemplates.ACCOUNT_CREATED,
      variables: {
        ..._.omitBy(user, _.isNil),
        token,
      },
    });
  }

  async sendMailsAfterMatching(
    candidate: User,
    toEmail: CustomMailParams['toEmail']
  ) {
    const { candidatesAdminMail } = getAdminMailsFromZone(candidate.zone);

    await this.workQueue.add(
      Jobs.SEND_MAIL,
      {
        toEmail,
        templateId: MailjetTemplates.CV_PREPARE,
        replyTo: candidatesAdminMail,
        variables: {
          ..._.omitBy(candidate, _.isNil),
        },
      },
      {
        delay:
          (process.env.CV_START_DELAY
            ? parseFloat(process.env.CV_START_DELAY)
            : 2) *
          3600000 *
          24,
      }
    );
    await this.workQueue.add(
      Jobs.REMINDER_CV_10,
      {
        candidatId: candidate.id,
      },
      {
        delay:
          (process.env.CV_10_REMINDER_DELAY
            ? parseFloat(process.env.CV_10_REMINDER_DELAY)
            : 10) *
          3600000 *
          24,
      }
    );
    await this.workQueue.add(
      Jobs.REMINDER_CV_20,
      {
        candidatId: candidate.id,
      },
      {
        delay:
          (process.env.CV_20_REMINDER_DELAY
            ? parseFloat(process.env.CV_20_REMINDER_DELAY)
            : 20) *
          3600000 *
          24,
      }
    );
  }
}
