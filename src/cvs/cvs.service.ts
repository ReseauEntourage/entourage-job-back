import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import _ from 'lodash';
import moment from 'moment/moment';
import { CustomMailParams, MailjetService } from 'src/mails';
import { MailjetTemplate, MailjetTemplates } from 'src/mails/mails.service';
import { getRelatedUser, User, UsersService } from 'src/users';
import { getAdminMailsFromZone } from 'src/utils/misc';

import { CV, CVStatusValue, CVStatuses } from './models';

@Injectable()
export class CVsService {
  constructor(
    @InjectModel(CV)
    private cvModel: typeof CV,
    // TODO fix forwardRef
    @Inject(forwardRef(() => UsersService))
    private usersService: UsersService,
    private mailjetService: MailjetService
  ) {}

  async getAllUserCVsVersions(candidateId: string): Promise<CV[]> {
    return this.cvModel.findAll({
      attributes: ['status', 'version'],
      where: {
        UserId: candidateId,
      },
    });
  }

  async sendReminderAboutCV(candidateId: string, is20Days = false) {
    const firstOfMarch2022 = '2022-03-01';
    const user = await this.usersService.findOne(candidateId);
    if (
      moment(user.createdAt).isAfter(moment(firstOfMarch2022, 'YYYY-MM-DD'))
    ) {
      const cvs = await this.getAllUserCVsVersions(candidateId);
      const hasSubmittedAtLeastOnce = cvs?.some(({ status }) => {
        return status === CVStatuses.Pending.value;
      });

      if (!hasSubmittedAtLeastOnce) {
        const toEmail: CustomMailParams['toEmail'] = {
          to: user.email,
        };
        const coach = getRelatedUser(user);
        if (coach) {
          toEmail.cc = coach.email;
        }

        await this.sendCvReminderMail(user.toJSON(), is20Days, toEmail);
        return toEmail;
      }
    }
    return false;
  }

  async sendCvReminderMail(
    candidate: User,
    is20Days = false,
    toEmail: CustomMailParams['toEmail']
  ) {
    const { candidatesAdminMail } = getAdminMailsFromZone(candidate.zone);

    await this.mailjetService.sendMail({
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

  // TODO send mails through MailsService
  async sendReminderIfNotEmployed(
    candidateId: string,
    templateId: MailjetTemplate
  ) {
    const user = await this.usersService.findOne(candidateId);
    if (!user.candidat.employed) {
      const toEmail: CustomMailParams['toEmail'] = {
        to: user.email,
      };
      const coach = getRelatedUser(user);
      if (coach) {
        toEmail.cc = coach.email;
      }
      const { candidatesAdminMail } = getAdminMailsFromZone(user.zone);

      await this.mailjetService.sendMail({
        toEmail,
        templateId: templateId,
        replyTo: candidatesAdminMail,
        variables: {
          ..._.omitBy(user.toJSON(), _.isNil),
        },
      });
      return toEmail;
    }
    return false;
  }

  async sendReminderAboutInterviewTraining(candidateId: string) {
    return this.sendReminderIfNotEmployed(
      candidateId,
      MailjetTemplates.INTERVIEW_TRAINING_REMINDER
    );
  }

  async sendReminderAboutVideo(candidateId: string) {
    return this.sendReminderIfNotEmployed(
      candidateId,
      MailjetTemplates.VIDEO_REMINDER
    );
  }

  async sendReminderAboutActions(candidateId: string) {
    return this.sendReminderIfNotEmployed(
      candidateId,
      MailjetTemplates.ACTIONS_REMINDER
    );
  }

  /*
  async sendReminderAboutExternalOffers(candidateId: string) {
    const user = await getUser(candidateId);
    if (!user.candidat.employed) {
      const toEmail: CustomMailParams['toEmail'] = {
        to: user.email,
      };

      let opportunitiesCreatedByCandidateOrCoach =
        await getExternalOpportunitiesCreatedByUserCount(candidateId);

      const coach = getRelatedUser(user);
      if (coach) {
        toEmail.cc = coach.email;
        opportunitiesCreatedByCandidateOrCoach +=
          await getExternalOpportunitiesCreatedByUserCount(coach.id);
      }
      const { candidatesAdminMail } = getAdminMailsFromZone(user.zone);

      if (opportunitiesCreatedByCandidateOrCoach === 0) {
        await this.mailjetService.sendMail({
          toEmail,
          templateId: MailjetTemplates.EXTERNAL_OFFERS_REMINDER,
          replyTo: candidatesAdminMail,
          variables: {
            ..._.omitBy(user.toJSON(), _.isNil),
          },
        });
        return toEmail;
      }
    }
    return false;
  }
  */
}
