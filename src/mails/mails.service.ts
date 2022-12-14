import { Injectable } from '@nestjs/common';
import * as _ from 'lodash';

import { HeardAboutFilters } from 'src/contacts/contacts.types';
import { ContactUsFormDto } from 'src/contacts/dto';
import { CV } from 'src/cvs/models';
import {
  CustomMailParams,
  MailjetTemplate,
  MailjetTemplates,
} from 'src/external-services/mailjet/mailjet.types';
import { Opportunity, OpportunityUser } from 'src/opportunities/models';
import {
  OfferStatuses,
  OpportunityRestricted,
} from 'src/opportunities/opportunities.types';
import { getMailjetVariablesForPrivateOrPublicOffer } from 'src/opportunities/opportunities.utils';
import { QueuesService } from 'src/queues/producers/queues.service';
import { Jobs } from 'src/queues/queues.types';
import { User } from 'src/users/models';
import { getRelatedUser } from 'src/users/users.utils';
import {
  getAdminMailsFromDepartment,
  getAdminMailsFromZone,
  getZoneFromDepartment,
} from 'src/utils/misc';
import { findConstantFromValue } from 'src/utils/misc/findConstantFromValue';

@Injectable()
export class MailsService {
  constructor(private queuesService: QueuesService) {}

  async sendPasswordResetLinkMail(
    user: Pick<User, 'id' | 'firstName' | 'role' | 'zone' | 'email'>,
    token: string
  ) {
    const { candidatesAdminMail } = getAdminMailsFromZone(user.zone);

    return this.queuesService.addToWorkQueue(Jobs.SEND_MAIL, {
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

    return this.queuesService.addToWorkQueue(Jobs.SEND_MAIL, {
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

    await this.queuesService.addToWorkQueue(
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

  async sendCVPublishedMail(candidate: User) {
    const coach = getRelatedUser(candidate);

    const toEmail: CustomMailParams['toEmail'] = coach
      ? { to: candidate.email, cc: coach.email }
      : { to: candidate.email };

    const { candidatesAdminMail } = getAdminMailsFromZone(candidate.zone);

    await this.queuesService.addToWorkQueue(Jobs.SEND_MAIL, {
      toEmail,
      templateId: MailjetTemplates.CV_PUBLISHED,
      replyTo: candidatesAdminMail,
      variables: {
        ..._.omitBy(candidate, _.isNil),
      },
    });
  }

  async sendCVSubmittedMail(coach: User, cv: Partial<CV>) {
    const candidate = getRelatedUser(coach);
    const { candidatesAdminMail } = getAdminMailsFromZone(candidate.zone);

    await this.queuesService.addToWorkQueue(Jobs.SEND_MAIL, {
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

    await this.queuesService.addToWorkQueue(Jobs.SEND_MAIL, {
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

      await this.queuesService.addToWorkQueue(Jobs.SEND_MAIL, {
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
    await this.queuesService.addToWorkQueue(Jobs.SEND_MAIL, {
      toEmail: process.env.MAILJET_CONTACT_EMAIL,
      templateId: MailjetTemplates.CONTACT_FORM,
      variables: {
        ..._.omitBy(
          {
            ...contactUsFormDto,
            heardAbout: contactUsFormDto.heardAbout
              ? findConstantFromValue(
                  contactUsFormDto.heardAbout,
                  HeardAboutFilters
                ).label
              : null,
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

    await this.queuesService.addToWorkQueue(Jobs.SEND_MAIL, {
      toEmail: companiesAdminMail,
      templateId: MailjetTemplates.OFFER_TO_VALIDATE,
      variables,
    });

    await this.queuesService.addToWorkQueue(Jobs.SEND_MAIL, {
      toEmail: opportunity.recruiterMail,
      replyTo: companiesAdminMail,
      templateId: MailjetTemplates.OFFER_SENT,
      variables,
    });
  }

  async sendOnCreatedExternalOfferMail(opportunity: OpportunityRestricted) {
    const { companiesAdminMail } = getAdminMailsFromDepartment(
      opportunity.department
    );
    await this.queuesService.addToWorkQueue(Jobs.SEND_MAIL, {
      toEmail: companiesAdminMail,
      templateId: MailjetTemplates.OFFER_EXTERNAL_RECEIVED,
      variables: {
        offer: getMailjetVariablesForPrivateOrPublicOffer(
          opportunity,
          opportunity.opportunityUsers.status,
          false
        ),
        candidat: _.omitBy(opportunity.opportunityUsers.user, _.isNil),
      },
    });
  }

  async sendOnValidatedOfferMail(opportunity: Opportunity) {
    const { companiesAdminMail, candidatesAdminMail } =
      getAdminMailsFromDepartment(opportunity.department);

    const variables = getMailjetVariablesForPrivateOrPublicOffer(opportunity);

    await this.queuesService.addToWorkQueue(Jobs.SEND_MAIL, {
      toEmail: opportunity.contactMail || opportunity.recruiterMail,
      replyTo: companiesAdminMail,
      templateId: opportunity.isPublic
        ? MailjetTemplates.OFFER_VALIDATED_PUBLIC
        : MailjetTemplates.OFFER_VALIDATED_PRIVATE,
      variables,
    });

    await this.queuesService.addToWorkQueue(Jobs.SEND_MAIL, {
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

    await this.queuesService.addToWorkQueue(Jobs.SEND_MAIL, {
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

  async sendReminderOfferMail(opportunity: OpportunityRestricted) {
    if (
      opportunity &&
      Object.keys(opportunity).length > 0 &&
      opportunity.isPublic === false &&
      (!opportunity.opportunityUsers.seen ||
        opportunity.opportunityUsers.status < 0)
    ) {
      const candidatData = opportunity.opportunityUsers.user;

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

      await this.queuesService.addToWorkQueue(Jobs.SEND_MAIL, {
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

        await this.queuesService.addToWorkQueue(Jobs.SEND_MAIL, {
          toEmail,
          templateId: opportunity.isPublic
            ? MailjetTemplates.OFFER_PUBLIC_NO_RESPONSE
            : MailjetTemplates.OFFER_PRIVATE_NO_RESPONSE,
          replyTo:
            process.env[
              `ADMIN_COMPANIES_${getZoneFromDepartment(opportunity.department)}`
            ],
          variables: getMailjetVariablesForPrivateOrPublicOffer(
            opportunity.toJSON()
          ),
        });

        return toEmail;
      }
    }
    return false;
  }

  async sendOnOfferStatusUpdatedMails(
    opportunityUser: OpportunityUser,
    opportunity: Opportunity
  ) {
    const mailVariables = {
      candidat: _.omitBy(opportunityUser.user.toJSON(), _.isNil),
      offer: getMailjetVariablesForPrivateOrPublicOffer(
        opportunity.toJSON(),
        opportunityUser.status,
        false
      ),
    };

    const { candidatesAdminMail } = getAdminMailsFromZone(
      opportunityUser.user.zone
    );

    await this.queuesService.addToWorkQueue(Jobs.SEND_MAIL, {
      toEmail: candidatesAdminMail,
      templateId: MailjetTemplates.STATUS_CHANGED,
      variables: mailVariables,
    });

    if (
      opportunityUser.status === OfferStatuses.REFUSAL_BEFORE_INTERVIEW.value &&
      !opportunity.isPublic &&
      !opportunity.isExternal
    ) {
      const { companiesAdminMail } = getAdminMailsFromDepartment(
        opportunity.department
      );

      await this.queuesService.addToWorkQueue(Jobs.SEND_MAIL, {
        toEmail: opportunity.contactMail || opportunity.recruiterMail,
        replyTo: companiesAdminMail,
        templateId: MailjetTemplates.OFFER_REFUSED,
        variables: mailVariables,
      });
    }
  }

  async sendRelevantOpportunitiesMail(
    user: User,
    opportunities: Opportunity[]
  ) {
    const { candidatesAdminMail } = getAdminMailsFromZone(user.zone);
    await this.queuesService.addToWorkQueue(
      Jobs.SEND_MAIL,
      opportunities.map((opportunity) => {
        return {
          toEmail: user.email,
          templateId: MailjetTemplates.OFFER_RECOMMENDED,
          replyTo: candidatesAdminMail,
          variables: {
            offer: getMailjetVariablesForPrivateOrPublicOffer(
              opportunity.toJSON(),
              OfferStatuses.TO_PROCESS.value,
              false
            ),
            candidat: user,
          },
        };
      })
    );
  }
}
