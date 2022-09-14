import { InjectQueue } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bull';
import * as _ from 'lodash';
import { CV } from 'src/cvs/models';
import { Opportunity, OpportunityUser } from 'src/opportunities/models';
import { getMailjetVariablesForPrivateOrPublicOffer } from 'src/opportunities/opportunities.utils';
import { Jobs, Queues } from 'src/queues/queues.types';
import { User } from 'src/users/models';
import { getRelatedUser } from 'src/users/users.utils';
import {
  getAdminMailsFromDepartment,
  getAdminMailsFromZone,
  getZoneFromDepartment,
} from 'src/utils/misc';
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

  async sendOnCreatedOfferMail(opportunity: Opportunity) {
    const { companiesAdminMail } = getAdminMailsFromDepartment(
      opportunity.department
    );

    const variables = getMailjetVariablesForPrivateOrPublicOffer(opportunity);

    await this.workQueue.add(Jobs.SEND_MAIL, {
      toEmail: companiesAdminMail,
      templateId: MailjetTemplates.OFFER_TO_VALIDATE,
      variables,
    });

    await this.workQueue.add(Jobs.SEND_MAIL, {
      toEmail: opportunity.recruiterMail,
      replyTo: companiesAdminMail,
      templateId: MailjetTemplates.OFFER_SENT,
      variables,
    });
  }

  async sendOnCreatedExternalOfferMail(opportunity: Opportunity) {
    const { companiesAdminMail } = getAdminMailsFromDepartment(
      opportunity.department
    );
    await this.workQueue.add(Jobs.SEND_MAIL, {
      toEmail: companiesAdminMail,
      templateId: MailjetTemplates.OFFER_EXTERNAL_RECEIVED,
      variables: {
        offer: getMailjetVariablesForPrivateOrPublicOffer(opportunity),
        candidat: _.omitBy(opportunity.opportunityUsers[0].user, _.isNil),
      },
    });
  }

  async sendOnValidatedOfferMail(opportunity: Opportunity) {
    const { companiesAdminMail, candidatesAdminMail } =
      getAdminMailsFromDepartment(opportunity.department);

    const variables = getMailjetVariablesForPrivateOrPublicOffer(opportunity);

    await this.workQueue.add(Jobs.SEND_MAIL, {
      toEmail: opportunity.contactMail || opportunity.recruiterMail,
      replyTo: companiesAdminMail,
      templateId: opportunity.isPublic
        ? MailjetTemplates.OFFER_VALIDATED_PUBLIC
        : MailjetTemplates.OFFER_VALIDATED_PRIVATE,
      variables,
    });

    await this.workQueue.add(Jobs.SEND_MAIL, {
      toEmail: candidatesAdminMail,
      templateId: MailjetTemplates.OFFER_VALIDATED_ADMIN,
      variables,
    });
  }

  async sendCandidateOfferMail(
    opportunityUser: OpportunityUser,
    opportunity: Opportunity
  ) {
    const coach = opportunityUser.user
      ? getRelatedUser(opportunityUser.user)
      : null;

    const { candidatesAdminMail } = getAdminMailsFromZone(
      opportunityUser.user.zone
    );

    const toEmail: CustomMailParams['toEmail'] = {
      to: opportunityUser.user.email,
    };

    if (coach) {
      toEmail.cc = coach.email;
    }

    await this.workQueue.add(Jobs.SEND_MAIL, {
      toEmail,
      templateId: opportunity.isPublic
        ? MailjetTemplates.OFFER_RECOMMENDED
        : MailjetTemplates.OFFER_RECEIVED,
      replyTo: candidatesAdminMail,
      variables: {
        offer: getMailjetVariablesForPrivateOrPublicOffer(
          opportunity,
          opportunityUser.status,
          false
        ),
        candidat: opportunityUser,
      },
    });
  }

  async sendReminderOfferMail(
    opportunity: Opportunity & { opportunityUser: OpportunityUser }
  ) {
    if (
      opportunity &&
      Object.keys(opportunity).length > 0 &&
      opportunity.isPublic === false &&
      (!opportunity.opportunityUser.seen ||
        opportunity.opportunityUser.status < 0)
    ) {
      const candidatData = opportunity.opportunityUser.user;

      const { candidatesAdminMail, companiesAdminMail } = getAdminMailsFromZone(
        candidatData.zone
      );

      const toEmail: CustomMailParams['toEmail'] = {
        to: candidatData.email,
        bcc: [candidatesAdminMail, companiesAdminMail],
      };

      const coach = getRelatedUser(candidatData);
      if (coach) {
        toEmail.cc = coach.email;
      }

      await this.workQueue.add(Jobs.SEND_MAIL, {
        toEmail,
        templateId: MailjetTemplates.OFFER_REMINDER,
        replyTo: candidatesAdminMail,
        variables: {
          offer: _.omitBy(opportunity, _.isNil),
          candidat: _.omitBy(candidatData, _.isNil),
        },
      });

      return toEmail;
    }
    return false;
  }

  async sendNoResponseOfferMail(opportunity: Opportunity) {
    if (opportunity) {
      const allStatus = opportunity.opportunityUsers.map(({ status }) => {
        return status;
      });

      if (
        allStatus.every((status) => {
          return status < 0;
        })
      ) {
        const toEmail: CustomMailParams['toEmail'] = {
          to: opportunity.contactMail || opportunity.recruiterMail,
          bcc: process.env[
            `ADMIN_COMPANIES_${getZoneFromDepartment(opportunity.department)}`
          ],
        };

        await this.workQueue.add(Jobs.SEND_MAIL, {
          toEmail,
          templateId: opportunity.isPublic
            ? MailjetTemplates.OFFER_PUBLIC_NO_RESPONSE
            : MailjetTemplates.OFFER_PRIVATE_NO_RESPONSE,
          replyTo:
            process.env[
              `ADMIN_COMPANIES_${getZoneFromDepartment(opportunity.department)}`
            ],
          variables: getMailjetVariablesForPrivateOrPublicOffer(opportunity),
        });

        return toEmail;
      }
    }
    return false;
  }
}
