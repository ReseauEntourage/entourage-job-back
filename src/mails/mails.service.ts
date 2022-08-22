import { InjectQueue } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bull';
import * as _ from 'lodash';
import { CV } from 'src/cvs/models';
import { Jobs, Queues } from 'src/queues/queues.types';
import { User } from 'src/users/models';
import { getRelatedUser } from 'src/users/users.utils';
import { getAdminMailsFromZone } from 'src/utils/misc';
import { findConstantFromValue } from 'src/utils/misc/findConstantFromValue';
import { ContactUsFormDto } from './dto';
import {
  CustomMailParams,
  HeardAboutFilters,
  MailjetTemplate,
  MailjetTemplates,
} from './mails.types';

@Injectable()
export class MailsService {
  constructor(
    @InjectQueue(Queues.WORK)
    private workQueue: Queue
  ) {}

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

  async sendCVPreparationMail(candidate: User) {
    const toEmail: CustomMailParams['toEmail'] = { to: candidate.email };

    const coach = getRelatedUser(candidate);
    if (coach) {
      toEmail.cc = coach.email;
    }
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
  }

  async sendCVSubmittedMail(candidate: User) {
    const coach = getRelatedUser(candidate);

    const toEmail: CustomMailParams['toEmail'] = coach
      ? { to: candidate.email, cc: coach.email }
      : { to: candidate.email };

    const { candidatesAdminMail } = getAdminMailsFromZone(candidate.zone);

    await this.workQueue.add(Jobs.SEND_MAIL, {
      toEmail,
      templateId: MailjetTemplates.CV_SUBMITTED,
      replyTo: candidatesAdminMail,
      variables: {
        ..._.omitBy(candidate, _.isNil),
      },
    });
  }

  async sendCVPublishedMail(coach: User, cv: Partial<CV>) {
    const { candidatesAdminMail } = getAdminMailsFromZone(coach.zone);

    await this.workQueue.add(Jobs.SEND_MAIL, {
      toEmail: candidatesAdminMail,
      templateId: MailjetTemplates.CV_SUBMITTED,
      variables: {
        coach: _.omitBy(coach, _.isNil),
        cv: _.omitBy(cv, _.isNil),
      },
    });
  }

  async sendCVReminderMail(
    candidate: User,
    is20Days = false,
    toEmail: CustomMailParams['toEmail']
  ) {
    const { candidatesAdminMail } = getAdminMailsFromZone(candidate.zone);

    await this.workQueue.add(Jobs.SEND_MAIL, {
      toEmail,
      templateId: is20Days
        ? MailjetTemplates.CV_REMINDER_20
        : MailjetTemplates.CV_REMINDER_10,
      replyTo: candidatesAdminMail,
      variables: {
        ..._.omitBy(candidate, _.isNil),
      },
    });
  }

  async sendReminderIfNotEmployed(
    candidate: User,
    templateId: MailjetTemplate
  ) {
    if (!candidate.candidat.employed) {
      const toEmail: CustomMailParams['toEmail'] = {
        to: candidate.email,
      };
      const coach = getRelatedUser(candidate);
      if (coach) {
        toEmail.cc = coach.email;
      }
      const { candidatesAdminMail } = getAdminMailsFromZone(candidate.zone);

      await this.workQueue.add(Jobs.SEND_MAIL, {
        toEmail,
        templateId: templateId,
        replyTo: candidatesAdminMail,
        variables: {
          ..._.omitBy(candidate, _.isNil),
        },
      });
      return toEmail;
    }
    return false;
  }

  async sendInterviewTrainingReminderMail(candidate: User) {
    return this.sendReminderIfNotEmployed(
      candidate,
      MailjetTemplates.INTERVIEW_TRAINING_REMINDER
    );
  }

  async sendVideoReminderMail(candidate: User) {
    return this.sendReminderIfNotEmployed(
      candidate,
      MailjetTemplates.VIDEO_REMINDER
    );
  }

  async sendActionsReminderMails(candidate: User) {
    return this.sendReminderIfNotEmployed(
      candidate,
      MailjetTemplates.ACTIONS_REMINDER
    );
  }

  async sendExternalOffersReminderMails(candidate: User) {
    return this.sendReminderIfNotEmployed(
      candidate,
      MailjetTemplates.EXTERNAL_OFFERS_REMINDER
    );
  }

  async sendContactUsMail(contactUsFormDto: ContactUsFormDto) {
    await this.workQueue.add(Jobs.SEND_MAIL, {
      toEmail: process.env.MAILJET_CONTACT_EMAIL,
      templateId: MailjetTemplates.CONTACT_FORM,
      variables: {
        ..._.omitBy(
          {
            ...contactUsFormDto,
            heardAbout: findConstantFromValue(
              contactUsFormDto.heardAbout,
              HeardAboutFilters
            ).label,
          },
          _.isNil
        ),
      },
    });
  }
}
