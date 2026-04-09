import { Injectable, Logger, NotFoundException } from '@nestjs/common';
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
import { RecommendationDto } from 'src/user-profiles/recommendations/dto/recommendations.dto';
import { MatchingReason } from 'src/user-profiles/recommendations/user-profile-recommendation.types';
import { User } from 'src/users/models';
import { UserRole, UserRoles } from 'src/users/users.types';
import { findConstantFromValue } from 'src/utils/misc/findConstantFromValue';
import { ZoneName } from 'src/utils/types/zones.types';

@Injectable()
export class MailsService {
  private readonly logger = new Logger(MailsService.name);
  constructor(private queuesService: QueuesService) {}

  async sendPasswordResetLinkMail(user: User, token: string) {
    return this.queuesService.addToWorkQueue(Jobs.SEND_MAIL, {
      toEmail: user.email,
      replyTo: user.staffContact.email,
      templateId: MailjetTemplates.PASSWORD_RESET,
      variables: {
        id: user.id,
        firstName: user.firstName,
        role: getRoleString(user),
        zone: user.zone || ZoneName.HZ,
        staffContact: user.staffContact,
        token,
      },
    });
  }

  async sendNewAccountMail(user: User, token: string) {
    const staffContactEmail = user.staffContact.email;
    this.logger.log(
      `Sending new account mail to user with email ${user.email}`
    );

    return this.queuesService.addToWorkQueue(Jobs.SEND_MAIL, {
      toEmail: user.email,
      replyTo: staffContactEmail,
      templateId: MailjetTemplates.ACCOUNT_CREATED,
      variables: {
        id: user.id,
        firstName: user.firstName,
        role: getRoleString(user),
        zone: user.zone || ZoneName.HZ,
        staffContact: user.staffContact,
        token,
      },
    });
  }

  async sendWelcomeMail(user: User) {
    // Send welcome message for company admins
    if (user.role === UserRoles.COACH && user.company?.companyUser?.isAdmin) {
      this.logger.log(
        `Sending welcome mail to company admin with email ${user.email}`
      );
      return this.queuesService.addToWorkQueue(Jobs.SEND_MAIL, {
        toEmail: user.email,
        replyTo: user.staffContact.email,
        templateId: MailjetTemplates.WELCOME_COACH_COMPANY_ADMIN,
        variables: {
          firstName: user.firstName,
          siteLinkAlertRecruit: `${process.env.FRONT_URL}/backoffice/dashboard`,
          siteLinkInvit: `${process.env.FRONT_URL}/backoffice/companies/${user.company.id}/collaborators`,
          companyGoal: user.company.goal || '',
          companyName: user.company.name,
          zone: user.zone || ZoneName.HZ,
          staffContact: user.staffContact,
        },
      });
    }

    // Send welcome message for referers
    if (user.role === UserRoles.REFERER) {
      this.logger.log(
        `Sending welcome mail to referer with email ${user.email}`
      );
      return this.queuesService.addToWorkQueue(Jobs.SEND_MAIL, {
        toEmail: user.email,
        replyTo: user.staffContact.email,
        templateId: MailjetTemplates.WELCOME_REFERER,
        variables: {
          id: user.id,
          firstName: user.firstName,
          role: user.role,
          zone: user.zone || ZoneName.HZ,
          staffContact: user.staffContact,
        },
      });
    }

    // Send welcome message for candidates and coaches
    if (user.role === UserRoles.CANDIDATE || user.role === UserRoles.COACH) {
      this.logger.log(
        `Sending welcome mail to user with email ${user.email} and role ${user.role}`
      );
      return this.queuesService.addToWorkQueue(Jobs.SEND_MAIL, {
        toEmail: user.email,
        replyTo: user.staffContact.email,
        templateId: MailjetTemplates.WELCOME_CANDIDATE_COACH,
        variables: {
          ctaUrl: `${process.env.FRONT_URL}/backoffice/dashboard`,
          id: user.id,
          firstName: user.firstName,
          role: user.role,
          zone: user.zone || ZoneName.HZ,
          staffContact: user.staffContact,
        },
      });
    }
  }

  async sendVerificationMail(user: User, token: string) {
    this.logger.log(
      `Sending verification mail to user with email ${user.email}`
    );
    return this.queuesService.addToWorkQueue(Jobs.SEND_MAIL, {
      toEmail: user.email,
      replyTo: user.staffContact.email,
      templateId: MailjetTemplates.USER_EMAIL_VERIFICATION,
      variables: {
        firstName: user.firstName,
        toEmail: user.email,
        token,
        zone: user.zone,
        staffContact: user.staffContact,
      },
    });
  }

  async sendOnboardingBAOMail(user: User) {
    this.logger.log(
      `Sending onboarding BAO mail to user with email ${user.email}`
    );
    return this.queuesService.addToWorkQueue(Jobs.SEND_MAIL, {
      toEmail: user.email,
      templateId: MailjetTemplates.ONBOARDING_J1_BAO,
      variables: {
        firstName: user.firstName,
        role: getRoleString(user),
        zone: user.zone,
        staffContact: user.staffContact,
      },
    });
  }

  async sendOnboardingContactAdviceMail(user: User) {
    this.logger.log(
      `Sending onboarding contact advice mail to user with email ${user.email}`
    );
    const roleString = getRoleString(user);
    return this.queuesService.addToWorkQueue(Jobs.SEND_MAIL, {
      toEmail: user.email,
      templateId: MailjetTemplates.ONBOARDING_J4_CONTACT_ADVICE,
      variables: {
        subject:
          roleString === 'Candidat'
            ? 'Et si vous demandiez un coup de main ? ✋'
            : '10 façons de devenir un super coach 💡',
        firstName: user.firstName,
        role: roleString,
        zone: user.zone,
        toolboxUrl:
          roleString === 'Candidat'
            ? process.env.TOOLBOX_CANDIDATE_URL
            : process.env.TOOLBOX_COACH_URL,
        staffContact: user.staffContact,
      },
    });
  }

  async sendContactUsMail(contactUsFormDto: ContactUsFormDto) {
    this.logger.log(`Sending contact us mail from ${contactUsFormDto.email}`);
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
    this.logger.log(
      `Sending user reported mail to staff contact with email ${reportedUser.staffContact?.email}`
    );
    if (!reportedUser.staffContact) {
      this.logger.error(`No staff contact found for zone ${reportedUser.zone}`);
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
    this.logger.log(
      `Sending conversation reported mail to staff contact with email ${reporterUser.staffContact?.email}`
    );
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
    this.logger.log(
      `Sending new message notification mail to addressees: ${addressees
        .map((a) => a.email)
        .join(', ')}`
    );
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
            staffContact: addressee.staffContact,
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
    this.logger.log(
      `Sending refered candidate finalize account mail to candidate with email ${candidate.email}`
    );
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
        staffContact: candidate.staffContact,
      },
    });
  }

  async sendRefererCandidateHasVerifiedAccountMail(candidate: User) {
    this.logger.log(
      `Sending referer candidate has verified account mail to referer with email ${candidate.referer?.email}`
    );
    if (candidate.referer === null) {
      throw new NotFoundException();
    }

    const staffContactEmail = candidate.referer.staffContact.email;
    await this.queuesService.addToWorkQueue(Jobs.SEND_MAIL, {
      toEmail: {
        to: candidate.referer.email,
        bcc: staffContactEmail,
      },
      replyTo: staffContactEmail,
      templateId: MailjetTemplates.REFERER_CANDIDATE_HAS_FINALIZED_ACCOUNT,
      variables: {
        candidateFirstName: candidate.firstName,
        candidateLastName: candidate.lastName,
        refererFirstName: candidate.referer.firstName,
        zone: candidate.zone,
        staffContact: candidate.referer.staffContact,
        loginUrl: `${process.env.FRONT_URL}/login`,
      },
    });
  }

  async sendAdminNewRefererNotificationMail(referer: User) {
    const staffContactMainEmail = referer.staffContact.email;
    this.logger.log(
      `Sending admin new referer notification mail to staff contact with email ${staffContactMainEmail}`
    );
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
    this.logger.log(
      `Sending user deletion mail to user with email ${user.email}`
    );
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
    sender: User;
    email: string;
    invitationWithCompany: CompanyInvitation;
  }) {
    this.logger.log(
      `Sending company invitation mail to ${email} from sender with email ${sender.email}`
    );
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
        staffContact: sender.staffContact,
      },
    });
  }

  async sendEmailCollaboratorInvitationUsed(
    companyAdmins: User[],
    createdUser: User
  ) {
    this.logger.log(
      `Sending collaborator invitation used mail to company admins with emails ${companyAdmins
        .map((admin) => admin.email)
        .join(', ')}`
    );
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
          staffContact: admin.staffContact,
        },
      });
    });
    return Promise.all(promises);
  }

  async sendAllElearningUnitsCompletedMail(user: User) {
    this.logger.log(
      `Sending all elearning units completed mail for user with id ${user.id}`
    );
    await this.queuesService.addToWorkQueue(Jobs.SEND_MAIL, {
      toEmail: user.email,
      templateId: MailjetTemplates.ELEARNING_ALL_UNITS_COMPLETED,
      variables: {
        firstName: user.firstName,
        role: getRoleString(user),
        zone: user.zone,
        staffContact: user.staffContact,
      },
    });
    this.logger.log(
      `Sent all elearning units completed mail for user with id ${user.id}`
    );
  }

  async sendReminderToCompleteOnboarding(user: User) {
    this.logger.log(
      `Sending reminder to complete onboarding mail to user with email ${user.email}`
    );
    await this.queuesService.addToWorkQueue(Jobs.SEND_MAIL, {
      toEmail: user.email,
      templateId: MailjetTemplates.ONBOARDING_REMINDER,
      variables: {
        firstName: user.firstName,
        ctaUrl: `${process.env.FRONT_URL}/backoffice/dashboard`,
        role: getRoleString(user),
        zone: user.zone,
        staffContact: user.staffContact,
      },
    });
  }

  async sendOnboardingCompletedMail(
    user: User,
    recommendations: RecommendationDto[]
  ) {
    this.logger.log(
      `Sending onboarding completed mail to user with email ${user.email}`
    );
    const formattedRecommendedProfiles =
      await this.formatRecommendedProfilesFromPublicProfiles(
        user,
        recommendations
      );
    await this.queuesService.addToWorkQueue(Jobs.SEND_MAIL, {
      toEmail: user.email,
      templateId: MailjetTemplates.ONBOARDING_COMPLETED,
      variables: {
        firstName: user.firstName,
        role: getRoleString(user),
        zone: user.zone,
        staffContact: user.staffContact,
        reco1: formattedRecommendedProfiles[0] || '',
        reco2: formattedRecommendedProfiles[1] || '',
        reco3: formattedRecommendedProfiles[2] || '',
        nbReco: formattedRecommendedProfiles.length,
      },
    });
  }

  async sendReminderToCompleteProfile(user: User) {
    this.logger.log(
      `Sending reminder to complete profile mail to user with email ${user.email}`
    );
    await this.queuesService.addToWorkQueue(Jobs.SEND_MAIL, {
      toEmail: user.email,
      templateId: MailjetTemplates.NOT_COMPLETED_PROFILE_REMINDER,
      variables: {
        firstName: user.firstName,
        role: getRoleString(user),
        zone: user.zone,
        staffContact: user.staffContact,
      },
    });
  }

  async sendMailForNoResponseToFirstMessage(
    user: User,
    addresseesFirstNames: string,
    recommendations: RecommendationDto[]
  ) {
    this.logger.log(
      `Sending mail for no response to first message to user with email ${user.email}`
    );

    const formattedRecommendedProfiles =
      await this.formatRecommendedProfilesFromPublicProfiles(
        user,
        recommendations
      );

    await this.queuesService.addToWorkQueue(Jobs.SEND_MAIL, {
      toEmail: user.email,
      templateId: MailjetTemplates.NO_RESPONSE_TO_FIRST_MESSAGE,
      variables: {
        firstName: user.firstName,
        role: getRoleStringFromRole(user.role),
        zone: user.zone,
        staffContact: user.staffContact,
        reco1: formattedRecommendedProfiles[0] || '',
        reco2: formattedRecommendedProfiles[1] || '',
        reco3: formattedRecommendedProfiles[2] || '',
        nbReco: formattedRecommendedProfiles.length,
        addresseesFirstNames,
      },
    });
  }

  async sendRecommendationsMail(
    user: User,
    recommendations: RecommendationDto[]
  ) {
    this.logger.log(
      `Sending recommendations mail to user with email ${user.email}`
    );

    const formattedRecommendedProfiles =
      await this.formatRecommendedProfilesFromPublicProfiles(
        user,
        recommendations
      );

    await this.queuesService.addToWorkQueue(Jobs.SEND_MAIL, {
      toEmail: user.email,
      subject:
        user.role === UserRoles.CANDIDATE
          ? "Besoin d'un coup de pouce ? Voici 3 coachs prêts à vous aider"
          : 'Ces candidats ont besoin de votre coup de pouce pour avancer',
      templateId: MailjetTemplates.MAILER_USER_RECOMMENDATIONS,
      variables: {
        role: user.role,
        zone: user.zone || ZoneName.HZ,
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        reco1: formattedRecommendedProfiles[0] || '',
        reco2: formattedRecommendedProfiles[1] || '',
        reco3: formattedRecommendedProfiles[2] || '',
        nbReco: formattedRecommendedProfiles.length,
      },
    });
  }

  async sendAutoSetUnavailableMail(user: User) {
    this.logger.log(
      `Sending auto set unavailable mail to user with email ${user.email}`
    );
    await this.queuesService.addToWorkQueue(Jobs.SEND_MAIL, {
      toEmail: user.email,
      templateId: MailjetTemplates.AUTO_SET_UNAVAILABLE,
      variables: {
        firstName: user.firstName,
        ctaUrl: `${process.env.FRONT_URL}/backoffice/dashboard`,
        role: getRoleString(user),
        zone: user.zone,
        staffContact: user.staffContact,
      },
    });
  }

  async sendFollowUpMailForMutuallyRepliedConversation(
    user: User,
    conversation: Conversation
  ) {
    this.logger.log(
      `Sending follow-up mail for mutually replied conversation to user with email ${user.email} for conversation with id ${conversation.id}`
    );
    return await this.queuesService.addToWorkQueue(Jobs.SEND_MAIL, {
      toEmail: user.email,
      replyTo: user.staffContact.email,
      templateId: MailjetTemplates.FOLLOW_UP_MUTUALLY_REPLIED_CONVERSATION,
      variables: {
        firstName: user.firstName,
        lastName: user.lastName,
        participantsFirstNames: conversation.participants
          .filter((p) => p.id !== user.id)
          .map((p) => p.firstName)
          .join(', '),
        role: getRoleStringFromRole(user.role),
        zone: user.zone,
        staffContact: user.staffContact,
      },
    });
  }

  private async formatRecommendedProfilesFromPublicProfiles(
    user: User,
    recommendationsDto: RecommendationDto[]
  ) {
    const awsS3Url = process.env.AWSS3_URL || '';
    const awsS3ImageDir = process.env.AWSS3_IMAGE_DIRECTORY || '';
    const imageBasePath = `${awsS3Url}${awsS3ImageDir}`;

    const formatReason = (user: User, reason: MatchingReason): string => {
      if (user.role === UserRoles.CANDIDATE) {
        switch (reason) {
          case MatchingReason.PROFILE:
            return 'Son profil correspond à ce que vous recherchez';
          case MatchingReason.NEEDS:
            return 'Ses besoins correspondent aux vôtres';
          case MatchingReason.ACTIVITY:
            return 'Très actif en ce moment';
          case MatchingReason.LOCATION_COMPATIBILITY:
            return 'Dans votre zone géographique';
          default:
            return '';
        }
      } else {
        switch (reason) {
          case MatchingReason.PROFILE:
            return 'Son profil correspond à ce que vous proposez';
          case MatchingReason.NEEDS:
            return 'Ses besoins correspondent à ce que vous proposez';
          case MatchingReason.ACTIVITY:
            return 'Très actif en ce moment';
          case MatchingReason.LOCATION_COMPATIBILITY:
            return 'Dans votre zone géographique';
          default:
            return '';
        }
      }
    };

    return (recommendationsDto || []).map((recommendation) => {
      const publicProfile = recommendation.publicProfile;
      return {
        imageUrl: publicProfile.hasPicture
          ? `${imageBasePath}${publicProfile.id}.profile.jpg`
          : `${imageBasePath}profile-placeholder.png`,
        firstName: publicProfile?.firstName || '',
        zone: publicProfile?.zone || '',
        department: publicProfile?.department || '',
        workTitle:
          publicProfile.role === UserRoles.CANDIDATE
            ? publicProfile?.sectorOccupations?.[0]?.occupation?.name ||
              'Je suis ouvert à toutes les opportunités'
            : publicProfile?.currentJob || '',
        businessSector1:
          publicProfile?.sectorOccupations?.[0]?.businessSector?.name || '',
        businessSector2:
          publicProfile?.sectorOccupations?.[1]?.businessSector?.name || '',
        businessSector3:
          publicProfile?.sectorOccupations?.[2]?.businessSector?.name || '',
        profileUrl: `${process.env.FRONT_URL}/backoffice/profile/${publicProfile.id}`,
        reason: formatReason(user, recommendation.reason),
      };
    });
  }

  async sendSuperEngagedAchievementMail(
    user: { email: string; firstName: string; zone: ZoneName | null },
    stats: { conversationCount: number; responseRate: number },
    nextEvaluationDate: Date
  ) {
    this.logger.log(
      `Sending super engaged achievement mail to user with email ${user.email}`
    );
    return this.queuesService.addToWorkQueue(Jobs.SEND_MAIL, {
      toEmail: user.email,
      templateId: MailjetTemplates.SUPER_ENGAGED_ACHIEVEMENT,
      variables: {
        FirstName: user.firstName,
        zone: user.zone || ZoneName.HZ,
        siteLink: `${process.env.FRONT_URL}/backoffice/dashboard`,
        nextEvaluationDate: nextEvaluationDate.toLocaleDateString('fr-FR'),
        conversationCount: stats.conversationCount,
        responseRate: stats.responseRate,
      },
    });
  }

  async sendSuperEngagedAchievementReminderMail(
    user: { email: string; firstName: string; zone: ZoneName | null },
    stats: {
      conversationCount: number;
      responseRate: number;
      goalAchieved: boolean;
    },
    expireAt: Date
  ) {
    this.logger.log(
      `Sending super engaged achievement reminder mail to user with email ${user.email}`
    );
    return this.queuesService.addToWorkQueue(Jobs.SEND_MAIL, {
      toEmail: user.email,
      templateId: MailjetTemplates.SUPER_ENGAGED_ACHIEVEMENT_REMINDER,
      variables: {
        FirstName: user.firstName,
        zone: user.zone || ZoneName.HZ,
        siteLink: `${process.env.FRONT_URL}/backoffice/dashboard`,
        expireAt: expireAt.toLocaleDateString('fr-FR'),
        conversationCount: stats.conversationCount,
        responseRate: stats.responseRate,
        goalAchieved: stats.goalAchieved ? 'true' : 'false',
      },
    });
  }

  async sendSuperEngagedAchievementExpiredMail(
    user: { email: string; firstName: string; zone: ZoneName | null },
    stats: { conversationCount: number; responseRate: number }
  ) {
    this.logger.log(
      `Sending super engaged achievement expired mail to user with email ${user.email}`
    );
    return this.queuesService.addToWorkQueue(Jobs.SEND_MAIL, {
      toEmail: user.email,
      templateId: MailjetTemplates.SUPER_ENGAGED_ACHIEVEMENT_EXPIRED,
      variables: {
        FirstName: user.firstName,
        zone: user.zone || ZoneName.HZ,
        siteLink: `${process.env.FRONT_URL}/backoffice/dashboard`,
        conversationCount: stats.conversationCount,
        responseRate: stats.responseRate,
      },
    });
  }
}

const getRoleStringFromRole = (role: UserRole): string => {
  switch (role) {
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

const getRoleString = (user: User): string => {
  return getRoleStringFromRole(user.role);
};
