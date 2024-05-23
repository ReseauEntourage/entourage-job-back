import { Injectable } from '@nestjs/common';
import * as _ from 'lodash';
import { HeardAboutFilters } from 'src/contacts/contacts.types';
import { ContactUsFormDto } from 'src/contacts/dto';
import { CV } from 'src/cvs/models';
import {
  CustomMailParams,
  MailjetTemplate,
  MailjetTemplateKey,
  MailjetTemplates,
} from 'src/external-services/mailjet/mailjet.types';
import {
  ExternalMessageContactTypeFilters,
  ExternalMessageSubjectFilters,
} from 'src/messages/messages.types';
import { InternalMessage } from 'src/messages/models';
import { ExternalMessage } from 'src/messages/models/external-message.model';
import { Opportunity, OpportunityUser } from 'src/opportunities/models';
import {
  ContactEmployerType,
  ContactEmployerTypes,
  OfferStatuses,
  OpportunityRestricted,
} from 'src/opportunities/opportunities.types';
import { getMailjetVariablesForPrivateOrPublicOffer } from 'src/opportunities/opportunities.utils';
import { QueuesService } from 'src/queues/producers/queues.service';
import { Jobs } from 'src/queues/queues.types';
import { User } from 'src/users/models';
import {
  CandidateUserRoles,
  CoachUserRoles,
  UserRole,
  UserRoles,
} from 'src/users/users.types';
import {
  getCandidateFromCoach,
  getCoachFromCandidate,
  isRoleIncluded,
} from 'src/users/users.utils';
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

  async sendWelcomeMail(
    user: Pick<User, 'id' | 'firstName' | 'role' | 'zone' | 'email'>
  ) {
    const { candidatesAdminMail } = getAdminMailsFromZone(user.zone);

    if (user.role === UserRoles.COACH) {
      return this.queuesService.addToWorkQueue(Jobs.SEND_MAIL, {
        toEmail: user.email,
        replyTo: candidatesAdminMail,
        templateId: MailjetTemplates.WELCOME_COACH,
        variables: {
          ..._.omitBy(user, _.isNil),
        },
      });
    }

    if (user.role === UserRoles.CANDIDATE) {
      return this.queuesService.addToWorkQueue(Jobs.SEND_MAIL, {
        toEmail: user.email,
        replyTo: candidatesAdminMail,
        templateId: MailjetTemplates.WELCOME_CANDIDATE,
        variables: {
          ..._.omitBy(user, _.isNil),
        },
      });
    }
  }

  async sendVerificationMail(user: User, token: string) {
    return this.queuesService.addToWorkQueue(Jobs.SEND_MAIL, {
      toEmail: user.email,
      templateId: MailjetTemplates.USER_EMAIL_VERIFICATION,
      variables: {
        firstname: user.firstName,
        toEmail: user.email,
        token,
      },
    });
  }

  async sendCVPreparationMail(candidate: User) {
    const toEmail: CustomMailParams['toEmail'] = { to: candidate.email };

    const coach = getCoachFromCandidate(candidate);
    if (coach && coach.role !== UserRoles.COACH_EXTERNAL) {
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
    const coach = getCoachFromCandidate(candidate);

    const toEmail: CustomMailParams['toEmail'] =
      coach && coach.role !== UserRoles.COACH_EXTERNAL
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

  async sendCVSubmittedMail(coach: User, candidateId: string, cv: Partial<CV>) {
    const candidate = getCandidateFromCoach(coach, candidateId);
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

  async sendCVReminderMail(candidate: User, is20Days = false) {
    const { candidatesAdminMail } = getAdminMailsFromZone(candidate.zone);

    const toEmail: CustomMailParams['toEmail'] = {
      to: candidate.email,
    };

    const coach = getCoachFromCandidate(candidate);
    if (coach && coach.role !== UserRoles.COACH_EXTERNAL) {
      toEmail.cc = coach.email;
    }

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

    return toEmail;
  }

  async sendReminderIfNotEmployed(
    candidate: User,
    templateId: MailjetTemplate
  ) {
    if (!candidate.candidat.employed) {
      const toEmail: CustomMailParams['toEmail'] = {
        to: candidate.email,
      };
      const coach = getCoachFromCandidate(candidate);
      if (coach && coach.role !== UserRoles.COACH_EXTERNAL) {
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

  async sendOnCreatedExternalOfferMailToAdmin(
    opportunity: OpportunityRestricted
  ) {
    const { companiesAdminMail } = getAdminMailsFromDepartment(
      opportunity.department
    );
    await this.queuesService.addToWorkQueue(Jobs.SEND_MAIL, {
      toEmail: companiesAdminMail,
      templateId: MailjetTemplates.OFFER_EXTERNAL_RECEIVED_ADMIN,
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

  async sendOnCreatedExternalOfferMailToCoach(
    opportunity: OpportunityRestricted,
    coach: User
  ) {
    await this.queuesService.addToWorkQueue(Jobs.SEND_MAIL, {
      toEmail: coach.email,
      templateId: MailjetTemplates.OFFER_EXTERNAL_RECEIVED_COACH,
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
      ? getCoachFromCandidate(opportunityUser.user)
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
      const candidateData = opportunity.opportunityUsers.user;

      const { candidatesAdminMail, companiesAdminMail } = getAdminMailsFromZone(
        candidateData.zone
      );

      const toEmail: CustomMailParams['toEmail'] = {
        to: candidateData.email,
        bcc: [candidatesAdminMail, companiesAdminMail],
      };

      const coach = getCoachFromCandidate(candidateData);
      if (coach) {
        toEmail.cc = coach.email;
      }

      await this.queuesService.addToWorkQueue(Jobs.SEND_MAIL, {
        toEmail,
        templateId: MailjetTemplates.OFFER_REMINDER,
        replyTo: candidatesAdminMail,
        variables: {
          offer: _.omitBy(opportunity, _.isNil),
          candidat: _.omitBy(candidateData, _.isNil),
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

      const { companiesAdminMail } = getAdminMailsFromDepartment(
        opportunity.department
      );

      if (
        allStatus.every((status) => {
          return status < 0;
        })
      ) {
        const toEmail: CustomMailParams['toEmail'] = {
          to: opportunity.contactMail || opportunity.recruiterMail,
          bcc: companiesAdminMail,
        };

        await this.queuesService.addToWorkQueue(Jobs.SEND_MAIL, {
          toEmail,
          templateId: opportunity.isPublic
            ? MailjetTemplates.OFFER_PUBLIC_NO_RESPONSE
            : MailjetTemplates.OFFER_PRIVATE_NO_RESPONSE,
          replyTo: companiesAdminMail,
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

  async sendMailContactEmployer(
    type: ContactEmployerType,
    candidate: User,
    opportunity: Opportunity,
    description: string
  ) {
    const { candidatesAdminMail, companiesAdminMail } = getAdminMailsFromZone(
      candidate.zone
    );
    const types: { [K in string]: MailjetTemplateKey } = {
      [ContactEmployerTypes.CONTACT]: 'CONTACT_EMPLOYER',
      [ContactEmployerTypes.RELANCE]: 'RELANCE_EMPLOYER',
    };
    const coach = getCoachFromCandidate(candidate);
    const emailCoach = coach?.email ? [coach?.email] : [];

    await this.queuesService.addToWorkQueue(Jobs.SEND_MAIL, {
      toEmail: {
        to: opportunity.recruiterMail,
        cc: [
          candidate.email,
          ...emailCoach,
          candidatesAdminMail,
          companiesAdminMail,
        ],
      },
      templateId: MailjetTemplates[types[type]],
      replyTo: candidate.email,
      variables: {
        description,
        zone: candidate.zone,
        gender: candidate.gender,
        offerId: opportunity.id,
        offerTitle: opportunity.title,
        candidateEmail: candidate.email,
        candidatePhone: candidate.phone,
        cvUrl: candidate.candidat.url,
        candidateFirstName: candidate.firstName,
        recruiterFirstName: opportunity.recruiterFirstName,
        company: opportunity.company,
      },
    });
  }

  async sendArchiveOfferReminderMail(opportunity: Opportunity) {
    const zone = getZoneFromDepartment(opportunity.department);
    const { companiesAdminMail } = getAdminMailsFromZone(zone);
    await this.queuesService.addToWorkQueue(Jobs.SEND_MAIL, {
      toEmail: opportunity.recruiterMail,
      templateId: MailjetTemplates.ARCHIVE_REMINDER,
      replyTo: companiesAdminMail,
      variables: {
        zone: zone || '',
        company: opportunity.company || '',
        offerId: opportunity.id || '',
        offerTitle: opportunity.title || '',
        recruiterFirstName: opportunity.recruiterFirstName || '',
      },
    });
  }

  async sendExternalMessageReceivedMail(
    candidate: User,
    message: ExternalMessage,
    isHiringOffer: boolean
  ) {
    const coach = getCoachFromCandidate(candidate);

    const { candidatesAdminMail, companiesAdminMail } = getAdminMailsFromZone(
      candidate.zone
    );

    const mailsCC = [candidatesAdminMail];

    if (isHiringOffer) mailsCC.push(companiesAdminMail);

    const toEmail: CustomMailParams['toEmail'] = {
      to: candidate.email,
      cc: mailsCC,
    };

    if (coach) {
      toEmail.cc = [...toEmail.cc, coach.email];
    }

    await this.queuesService.addToWorkQueue(Jobs.SEND_MAIL, {
      toEmail,
      templateId: MailjetTemplates.MESSAGE_RECEIVED,
      replyTo: message.senderEmail,
      variables: {
        candidateFirstName: candidate.firstName,
        zone: candidate.zone,
        subject: findConstantFromValue(
          message.subject,
          ExternalMessageSubjectFilters
        ).label,
        message: message.message,
        firstName: message.senderFirstName,
        lastName: message.senderLastName,
        email: message.senderEmail,
        phone: message.senderPhone || '',
        type: message.type
          ? findConstantFromValue(
              message.type,
              ExternalMessageContactTypeFilters
            ).label
          : '',
      },
    });
  }

  async sendInternalMessageByMail(
    senderUser: User,
    addresseeUser: User,
    message: InternalMessage
  ) {
    let senderRole: UserRole;
    if (isRoleIncluded(CandidateUserRoles, senderUser.role)) {
      senderRole = 'Candidat';
    } else if (isRoleIncluded(CoachUserRoles, senderUser.role)) {
      senderRole = 'Coach';
    } else {
      senderRole = 'Admin';
    }

    // envoi du mail au destinataire
    await this.queuesService.addToWorkQueue(Jobs.SEND_MAIL, {
      toEmail: addresseeUser.email,
      templateId: MailjetTemplates.INTERNAL_MESSAGE,
      replyTo: senderUser.email,
      variables: {
        senderId: senderUser.id,
        senderName: `${senderUser.firstName} ${senderUser.lastName}`,
        addresseeName: `${addresseeUser.firstName} ${addresseeUser.lastName}`,
        senderRole,
        senderEmail: senderUser.email,
        message: message.message,
        zone: addresseeUser.zone,
        subject: message.subject,
      },
    });

    // envoi de la confirmation à l'expéditeur
    await this.queuesService.addToWorkQueue(Jobs.SEND_MAIL, {
      toEmail: senderUser.email,
      templateId: MailjetTemplates.INTERNAL_MESSAGE_CONFIRMATION,
      replyTo: senderUser.email,
      variables: {
        senderName: `${senderUser.firstName} ${senderUser.lastName}`,
        addresseeName: `${addresseeUser.firstName} ${addresseeUser.lastName}`,
        senderEmail: senderUser.email,
        zone: senderUser.zone,
        subject: message.subject,
      },
    });
  }
}
