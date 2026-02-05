import { Injectable, NotFoundException } from '@nestjs/common';
import _ from 'lodash';
import { CompanyInvitation } from 'src/companies/models/company-invitation.model';
import { HeardAboutFilters } from 'src/contacts/contacts.types';
import { ContactUsFormDto } from 'src/contacts/dto';
import { MailjetTemplates } from 'src/external-services/mailjet/mailjet.types';
import { ReportConversationDto } from 'src/messaging/dto/report-conversation.dto';
import { Conversation, Message } from 'src/messaging/models';
import { QueuesService } from 'src/queues/producers/queues.service';
import { Jobs } from 'src/queues/queues.types';
import { ReportAbuseUserProfileDto } from 'src/user-profiles/dto/report-abuse-user-profile.dto';
import { User } from 'src/users/models';
import { UserRoles } from 'src/users/users.types';
import { Zones } from 'src/utils/constants/zones';
import { findConstantFromValue } from 'src/utils/misc/findConstantFromValue';
import { ZoneName } from 'src/utils/types/zones.types';

@Injectable()
export class MailsService {
  constructor(private queuesService: QueuesService) {}

  async sendPasswordResetLinkMail(
    user: Pick<User, 'id' | 'firstName' | 'role' | 'zone' | 'email'>,
    token: string
  ) {
    const staffContactMainEmail = Zones[user.zone]?.staffContact?.main?.email;
    return this.queuesService.addToWorkQueue(Jobs.SEND_MAIL, {
      toEmail: user.email,
      replyTo: staffContactMainEmail,
      templateId: MailjetTemplates.PASSWORD_RESET,
      variables: {
        ..._.omitBy(user, _.isNil),
        zone: user.zone || ZoneName.HZ,
        token,
      },
    });
  }

  async sendNewAccountMail(
    user: Pick<User, 'id' | 'firstName' | 'role' | 'zone' | 'email'>,
    token: string
  ) {
    const staffContactMainEmail = Zones[user.zone]?.staffContact?.main?.email;

    return this.queuesService.addToWorkQueue(Jobs.SEND_MAIL, {
      toEmail: user.email,
      replyTo: staffContactMainEmail,
      templateId: MailjetTemplates.ACCOUNT_CREATED,
      variables: {
        ..._.omitBy(user, _.isNil),
        zone: user.zone || ZoneName.HZ,
        token,
      },
    });
  }

  async sendWelcomeMail(
    user: Pick<User, 'id' | 'firstName' | 'role' | 'zone' | 'email' | 'company'>
  ) {
    const staffContactMainEmail = Zones[user.zone]?.staffContact?.main?.email;

    // Send welcome message for company admins
    if (user.role === UserRoles.COACH && user.company?.companyUser?.isAdmin) {
      const staffContactCompanyEmail =
        Zones[user.zone]?.staffContact?.company?.email;
      return this.queuesService.addToWorkQueue(Jobs.SEND_MAIL, {
        toEmail: user.email,
        replyTo: staffContactCompanyEmail,
        templateId: MailjetTemplates.WELCOME_COACH_COMPANY_ADMIN,
        variables: {
          firstName: user.firstName,
          siteLinkAlertRecruit: `${process.env.FRONT_URL}/backoffice/dashboard`,
          siteLinkInvit: `${process.env.FRONT_URL}/backoffice/companies/${user.company.id}/collaborators`,
          companyGoal: user.company.goal || '',
          companyName: user.company.name,
          zone: user.zone || ZoneName.HZ,
        },
      });
    }

    // Send welcome message for referers
    if (user.role === UserRoles.REFERER) {
      return this.queuesService.addToWorkQueue(Jobs.SEND_MAIL, {
        toEmail: user.email,
        replyTo: staffContactMainEmail,
        templateId: MailjetTemplates.WELCOME_REFERER,
        variables: {
          ..._.omitBy(user, _.isNil),
          zone: user.zone || ZoneName.HZ,
        },
      });
    }

    // Send welcome message for candidates and coaches
    if (user.role === UserRoles.CANDIDATE || user.role === UserRoles.COACH) {
      return this.queuesService.addToWorkQueue(Jobs.SEND_MAIL, {
        toEmail: user.email,
        replyTo: staffContactMainEmail,
        templateId: MailjetTemplates.WELCOME_CANDIDATE_COACH,
        variables: {
          ctaUrl: `${process.env.FRONT_URL}/backoffice/dashboard`,
          firstName: user.firstName,
          ..._.omitBy(user, _.isNil),
          zone: user.zone || ZoneName.HZ,
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

  async sendUserReportedMail(
    reportAbuseUserProfileDto: ReportAbuseUserProfileDto,
    reportedUser: User,
    reporterUser: User
  ) {
    if (!reportedUser.staffContact) {
      throw new NotFoundException(
        `No staff contact found for zone ${reportedUser.zone}`
      );
    }
    await this.queuesService.addToWorkQueue(Jobs.SEND_MAIL, {
      toEmail: reportedUser.staffContact.email,
      templateId: MailjetTemplates.USER_REPORTED_ADMIN,
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
      toEmail: 'contact@entourage-pro.fr',
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
            // Sender
            senderId: message.authorId,
            senderFirstName: message.author.firstName,
            senderLastName: message.author.lastName,
            senderRole: message.author.role,

            // Addressee
            addresseeFirstName: addressee.firstName,
            addresseeLastName: addressee.lastName,
            addresseeRole: addressee.role,
            addresseeId: addressee.id,

            // Message
            message: message.content,
            conversationUrl,

            // General
            zone: addressee.zone,
            role: addressee.role,
          },
        });
      })
    );
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

    const staffContactMainEmail =
      Zones[candidate.zone]?.staffContact?.main?.email;
    await this.queuesService.addToWorkQueue(Jobs.SEND_MAIL, {
      toEmail: {
        to: candidate.referer.email,
        bcc: staffContactMainEmail,
      },
      replyTo: staffContactMainEmail,
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
    const staffContactMainEmail =
      Zones[referer.zone]?.staffContact?.main?.email;
    await this.queuesService.addToWorkQueue(Jobs.SEND_MAIL, {
      toEmail: staffContactMainEmail,
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

  async sendCompanyInvitation({
    sender,
    email,
    invitationWithCompany,
  }: {
    sender: Pick<User, 'id' | 'firstName' | 'lastName' | 'zone'>;
    email: string;
    invitationWithCompany: CompanyInvitation;
  }) {
    return this.queuesService.addToWorkQueue(Jobs.SEND_MAIL, {
      toEmail: email,
      templateId: MailjetTemplates.COMPANY_COLLABORATORS_INVITATION,
      variables: {
        companyName: invitationWithCompany.company.name,
        senderFirstName: sender.firstName,
        senderLastName: sender.lastName,
        registerUrl: `${
          process.env.FRONT_URL
        }/inscription?companyName=${encodeURIComponent(
          invitationWithCompany.company.name
        )}&flow=coach&invitationId=${invitationWithCompany.id}`,
        zone: sender.zone, // We don't have zone of the collaborators, so we use the sender's zone by default
      },
    });
  }

  async sendEmailCollaboratorInvitationUsed(
    companyAdmins: User[],
    createdUser: User
  ) {
    const promises = companyAdmins.map((admin) => {
      return this.queuesService.addToWorkQueue(Jobs.SEND_MAIL, {
        toEmail: admin.email,
        templateId: MailjetTemplates.COMPANY_INVITATION_USED,
        variables: {
          createdUserFirstName: createdUser.firstName,
          createdUserLastName: createdUser.lastName,
          adminFirstName: admin.firstName,
          loginUrl: `${process.env.FRONT_URL}/login`,
          zone: admin.zone,
        },
      });
    });
    return Promise.all(promises);
  }

  async sendAllElearningUnitsCompletedMail(user: User) {
    await this.queuesService.addToWorkQueue(Jobs.SEND_MAIL, {
      toEmail: process.env.MAILJET_CONTACT_EMAIL,
      templateId: MailjetTemplates.ELEARNING_ALL_UNITS_COMPLETED,
      variables: {
        firstName: user.firstName,
        role: getRoleString(user),
        zone: user.zone,
      },
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
