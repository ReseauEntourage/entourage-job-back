import { Injectable, NotFoundException } from '@nestjs/common';
import _ from 'lodash';
import { HeardAboutFilters } from 'src/contacts/contacts.types';
import { ContactUsFormDto } from 'src/contacts/dto';
import {
  CustomMailParams,
  MailjetTemplates,
} from 'src/external-services/mailjet/mailjet.types';
import {
  ExternalMessageContactTypeFilters,
  ExternalMessageSubjectFilters,
} from 'src/messages/messages.types';
import { InternalMessage } from 'src/messages/models';
import { ExternalMessage } from 'src/messages/models/external-message.model';
import { ReportConversationDto } from 'src/messaging/dto/report-conversation.dto';
import { Conversation, Message } from 'src/messaging/models';
import { QueuesService } from 'src/queues/producers/queues.service';
import { Jobs } from 'src/queues/queues.types';
import { ReportAbuseUserProfileDto } from 'src/user-profiles/dto/report-abuse-user-profile.dto';
import { User } from 'src/users/models';
import { UserRoles } from 'src/users/users.types';
import { getCoachFromCandidate } from 'src/users/users.utils';
import { getAdminMailsFromZone } from 'src/utils/misc';
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

    if (user.role === UserRoles.REFERER) {
      return this.queuesService.addToWorkQueue(Jobs.SEND_MAIL, {
        toEmail: user.email,
        replyTo: candidatesAdminMail,
        templateId: MailjetTemplates.WELCOME_REFERER,
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
        firstName: user.firstName,
        toEmail: user.email,
        token,
        zone: user.zone,
      },
    });
  }

  async sendOnboardingJ1BAOMail(user: User) {
    return this.queuesService.addToWorkQueue(
      Jobs.SEND_MAIL,
      {
        toEmail: user.email,
        templateId: MailjetTemplates.ONBOARDING_J1_BAO,
        variables: {
          firstName: user.firstName,
          role: getRoleString(user),
          zone: user.zone,
        },
      },
      {
        // 1 jour après la création du compte
        delay: 3600000 * 24 * 1,
      }
    );
  }

  async sendOnboardingJ3ProfileCompletionMail(user: User) {
    return this.queuesService.addToWorkQueue(
      Jobs.SEND_MAIL,
      {
        toEmail: user.email,
        templateId: MailjetTemplates.ONBOARDING_J3_PROFILE_COMPLETION,
        variables: {
          firstName: user.firstName,
          role: getRoleString(user),
          zone: user.zone,
        },
      },
      {
        // 3 jours après la création du compte
        delay: 3600000 * 24 * 3,
      }
    );
  }

  async sendOnboardingJ4ContactAdviceMail(user: User) {
    const roleString = getRoleString(user);
    return this.queuesService.addToWorkQueue(
      Jobs.SEND_MAIL,
      {
        toEmail: user.email,
        templateId: MailjetTemplates.ONBOARDING_J4_CONTACT_ADVICE,
        variables: {
          subject:
            roleString === 'Candidat'
              ? 'Et si tu demandais un coup de main ? ✋'
              : '10 façons de devenir un super coach 💡',
          firstName: user.firstName,
          role: roleString,
          zone: user.zone,
          toolboxUrl:
            roleString === 'Candidat'
              ? process.env.TOOLBOX_CANDIDATE_URL
              : process.env.TOOLBOX_COACH_URL,
        },
      },
      {
        // 4 jours après la création du compte
        delay: 3600000 * 24 * 4,
      }
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

  async sendExternalMessageReceivedMail(
    candidate: User,
    message: ExternalMessage
  ) {
    const coach = getCoachFromCandidate(candidate);

    const { candidatesAdminMail } = getAdminMailsFromZone(candidate.zone);

    const mailsCC = [candidatesAdminMail];

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
    // envoi du mail au destinataire
    await this.queuesService.addToWorkQueue(Jobs.SEND_MAIL, {
      toEmail: addresseeUser.email,
      templateId: MailjetTemplates.INTERNAL_MESSAGE,
      replyTo: senderUser.email,
      variables: {
        senderId: senderUser.id,
        senderName: `${senderUser.firstName} ${senderUser.lastName}`,
        addresseeName: `${addresseeUser.firstName} ${addresseeUser.lastName}`,
        senderEmail: senderUser.email,
        message: message.message,
        zone: addresseeUser.zone,
        subject: message.subject,
        role: getRoleString(senderUser),
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
        role: getRoleString(senderUser),
      },
    });
  }

  async sendUserReportedMail(
    reportAbuseUserProfileDto: ReportAbuseUserProfileDto,
    reportedUser: User,
    reporterUser: User
  ) {
    const { candidatesAdminMail } = getAdminMailsFromZone(reportedUser.zone);

    await this.queuesService.addToWorkQueue(Jobs.SEND_MAIL, {
      toEmail: candidatesAdminMail,
      templateId: MailjetTemplates.USER_REPORTED_ADMIN,
      replyTo: candidatesAdminMail,
      variables: {
        reportedFirstName: reportedUser.firstName,
        reportedLastName: reportedUser.lastName,
        reportedEmail: reportedUser.email,
        reporterFirstName: reporterUser.firstName,
        reporterLastName: reporterUser.lastName,
        reporterEmail: reporterUser.email,
        ...reportAbuseUserProfileDto,
      },
    });
  }

  async sendConversationReportedMail(
    reportConversationDto: ReportConversationDto,
    reportedConversation: Conversation,
    reporterUser: User
  ) {
    await this.queuesService.addToWorkQueue(Jobs.SEND_MAIL, {
      toEmail: process.env.ADMIN_NATIONAL || 'contact@entourage-pro.fr',
      templateId: MailjetTemplates.CONVERSATION_REPORTED_ADMIN,
      variables: {
        reporterFirstName: reporterUser.firstName,
        reporterLastName: reporterUser.lastName,
        reporterEmail: reporterUser.email,
        reportedConversationId: reportedConversation.id,
        ...reportConversationDto,
      },
    });
  }
  async sendNewMessageNotifMail(message: Message, addressees: User[]) {
    const conversationUrl = `${process.env.FRONT_URL}/backoffice/messaging?userId=${message.authorId}`;

    await Promise.all(
      addressees.map((addressee) => {
        return this.queuesService.addToWorkQueue(Jobs.SEND_MAIL, {
          toEmail: addressee.email,
          templateId: MailjetTemplates.MESSAGING_MESSAGE,
          variables: {
            senderId: message.authorId,
            senderName: `${message.author.firstName} ${message.author.lastName}`,
            senderRole: message.author.role,
            addresseeName: `${addressee.firstName} ${addressee.lastName}`,
            zone: addressee.zone,
            role: addressee.role,
            conversationUrl,
          },
        });
      })
    );
  }

  // TODO: Call this method after completing the referer onboarding
  async sendRefererOnboardingConfirmationMail(referer: User, candidate: User) {
    const { candidatesAdminMail } = getAdminMailsFromZone(referer.zone);

    await this.queuesService.addToWorkQueue(Jobs.SEND_MAIL, {
      toEmail: referer.email,
      templateId: MailjetTemplates.REFERER_ONBOARDING_CONFIRMATION,
      replyTo: candidatesAdminMail,
      variables: {
        refererFirstName: referer.firstName,
        candidateFirstName: candidate.firstName,
        candidateLastName: candidate.lastName,
        loginUrl: `${process.env.FRONT_URL}/login`,
        zone: referer.zone,
      },
    });
  }

  async sendReferedCandidateFinalizeAccountMail(
    referer: User,
    candidate: User,
    token: string
  ) {
    await this.queuesService.addToWorkQueue(Jobs.SEND_MAIL, {
      toEmail: candidate.email,
      templateId: MailjetTemplates.REFERED_CANDIDATE_FINALIZE_ACCOUNT,
      variables: {
        id: candidate.id,
        candidateFirstName: candidate.firstName,
        refererFirstName: referer.firstName,
        refererLastName: referer.lastName,
        organizationName: referer.organization.name,
        finalizeAccountUrl: `${process.env.FRONT_URL}/finaliser-compte-oriente?token=${token}`,
        zone: candidate.zone,
      },
    });
  }

  async sendRefererCandidateHasVerifiedAccountMail(candidate: User) {
    if (candidate.referer === null) {
      throw new NotFoundException();
    }

    await this.queuesService.addToWorkQueue(Jobs.SEND_MAIL, {
      toEmail: candidate.referer.email,
      templateId: MailjetTemplates.REFERER_CANDIDATE_HAS_FINALIZED_ACCOUNT,
      variables: {
        candidateFirstName: candidate.firstName,
        candidateLastName: candidate.lastName,
        refererFirstName: candidate.referer.firstName,
        zone: candidate.zone,
        loginUrl: `${process.env.FRONT_URL}/login`,
      },
    });
  }

  async sendAdminNewRefererNotificationMail(referer: User) {
    const adminFromZone = getAdminMailsFromZone(referer.zone);
    await this.queuesService.addToWorkQueue(Jobs.SEND_MAIL, {
      toEmail: adminFromZone.candidatesAdminMail,
      templateId: MailjetTemplates.ADMIN_NEW_REFERER_NOTIFICATION,
      variables: {
        refererFirstName: referer.firstName,
        refererLastName: referer.lastName,
        refererProfileUrl: `${process.env.FRONT_URL}/backoffice/admin/membres/${referer.id}`,
      },
    });
  }

  async sendUserDeletionEmail(user: User) {
    await this.queuesService.addToWorkQueue(Jobs.SEND_MAIL, {
      toEmail: user.email,
      templateId: MailjetTemplates.USER_ACCOUNT_DELETED,
      variables: { role: getRoleString(user) },
    });
  }
}

const getRoleString = (user: User): string => {
  switch (user.role) {
    case UserRoles.CANDIDATE:
      return 'Candidat';
    case UserRoles.COACH:
      return 'Coach';
    case UserRoles.REFERER:
      return 'Prescripteur';
    case UserRoles.ADMIN:
      return 'Admin';
    default:
      throw new Error('Unknown role');
  }
};
