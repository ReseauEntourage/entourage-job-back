import { NotFoundException } from '@nestjs/common';
import { MailjetTemplates } from 'src/external-services/mailjet/mailjet.types';
import { HelpGroupNotificationEmailKinds } from 'src/help-groups/help-groups.types';
import { MailsService } from 'src/mails/mails.service';
import { Jobs } from 'src/queues/queues.types';
import { MatchingReason } from 'src/user-profile-recommendations/user-profile-recommendation.types';
import { User } from 'src/users/models';
import { UserRole, UserRoles } from 'src/users/users.types';
import { ZoneName } from 'src/utils/types/zones.types';

const FRONT_URL = 'https://front.example.org';

const STAFF_CONTACT = {
  email: 'staff@entourage.social',
  firstName: 'Staff',
} as unknown as User['staffContact'];

const buildUser = (props: Partial<User> = {}): User =>
  ({
    id: 'user-1',
    email: 'user@example.org',
    firstName: 'Jean',
    lastName: 'Dupont',
    role: UserRoles.CANDIDATE,
    zone: ZoneName.IDF,
    staffContact: STAFF_CONTACT,
    ...props,
  }) as User;

describe('MailsService (mail templates)', () => {
  const savedEnv: Record<string, string | undefined> = {};
  const ENV_KEYS = [
    'FRONT_URL',
    'AWSS3_URL',
    'AWSS3_IMAGE_DIRECTORY',
    'MAILJET_CONTACT_EMAIL',
    'TOOLBOX_CANDIDATE_URL',
    'TOOLBOX_COACH_URL',
  ];

  beforeAll(() => {
    ENV_KEYS.forEach((key) => {
      savedEnv[key] = process.env[key];
    });
    process.env.FRONT_URL = FRONT_URL;
    process.env.AWSS3_URL = 'https://s3.example.org/';
    process.env.AWSS3_IMAGE_DIRECTORY = 'images/';
    process.env.MAILJET_CONTACT_EMAIL = 'contact@example.org';
    process.env.TOOLBOX_CANDIDATE_URL = 'https://toolbox.example.org/candidate';
    process.env.TOOLBOX_COACH_URL = 'https://toolbox.example.org/coach';
  });

  afterAll(() => {
    ENV_KEYS.forEach((key) => {
      if (savedEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = savedEnv[key];
      }
    });
  });

  const build = () => {
    const queuesService = {
      addToWorkQueue: jest.fn().mockResolvedValue({ id: 'job-1' }),
    };
    const mailsService = new MailsService(queuesService as never);
    return { mailsService, queuesService };
  };

  const lastMail = (queuesService: { addToWorkQueue: jest.Mock }) => {
    const [job, mail] = queuesService.addToWorkQueue.mock.lastCall;
    expect(job).toBe(Jobs.SEND_MAIL);
    return mail;
  };

  /**
   * Mails sent to a single user with a template and a few well known
   * variables: they all go through the work queue as a SEND_MAIL job.
   */
  describe('simple user mails', () => {
    type Case = {
      call: (service: MailsService, user: User) => Promise<unknown>;
      name: string;
      replyTo?: boolean;
      template: number | string;
      variables: (user: User) => Record<string, unknown>;
    };

    const CASES: Case[] = [
      {
        name: 'sendPasswordResetLinkMail',
        template: MailjetTemplates.PASSWORD_RESET,
        replyTo: true,
        call: (s, u) => s.sendPasswordResetLinkMail(u, 'reset-token'),
        variables: (u) => ({
          id: u.id,
          firstName: 'Jean',
          role: 'Candidat',
          token: 'reset-token',
        }),
      },
      {
        name: 'sendNewAccountMail',
        template: MailjetTemplates.ACCOUNT_CREATED,
        replyTo: true,
        call: (s, u) => s.sendNewAccountMail(u, 'account-token'),
        variables: () => ({ token: 'account-token', role: 'Candidat' }),
      },
      {
        name: 'sendVerificationMail',
        template: MailjetTemplates.USER_EMAIL_VERIFICATION,
        replyTo: true,
        call: (s, u) => s.sendVerificationMail(u, 'verify-token', '123456'),
        variables: (u) => ({
          token: 'verify-token',
          otpCode: '123456',
          toEmail: u.email,
        }),
      },
      {
        name: 'sendOnboardingBAOMail',
        template: MailjetTemplates.ONBOARDING_J1_BAO,
        call: (s, u) => s.sendOnboardingBAOMail(u),
        variables: () => ({ role: 'Candidat' }),
      },
      {
        name: 'sendUserDeletionEmail',
        template: MailjetTemplates.USER_ACCOUNT_DELETED,
        call: (s, u) => s.sendUserDeletionEmail(u),
        variables: () => ({ role: 'Candidat' }),
      },
      {
        name: 'sendAllElearningUnitsCompletedMail',
        template: MailjetTemplates.ELEARNING_ALL_UNITS_COMPLETED,
        call: (s, u) => s.sendAllElearningUnitsCompletedMail(u),
        variables: () => ({ role: 'Candidat', firstName: 'Jean' }),
      },
      {
        name: 'sendReminderToCompleteOnboarding',
        template: MailjetTemplates.ONBOARDING_REMINDER,
        call: (s, u) => s.sendReminderToCompleteOnboarding(u),
        variables: () => ({ ctaUrl: `${FRONT_URL}/backoffice/dashboard` }),
      },
      {
        name: 'sendReminderToCompleteProfile',
        template: MailjetTemplates.NOT_COMPLETED_PROFILE_REMINDER,
        call: (s, u) => s.sendReminderToCompleteProfile(u),
        variables: () => ({ role: 'Candidat' }),
      },
      {
        name: 'sendAutoSetUnavailableMail',
        template: MailjetTemplates.AUTO_SET_UNAVAILABLE,
        call: (s, u) => s.sendAutoSetUnavailableMail(u),
        variables: () => ({
          ctaUrl: `${FRONT_URL}/backoffice/parametres?reactivate=true`,
        }),
      },
      {
        name: 'sendChurnUsersFeedbackMail',
        template: MailjetTemplates.MAILER_CHURN_USERS_FEEDBACK,
        replyTo: true,
        call: (s, u) => s.sendChurnUsersFeedbackMail(u),
        variables: () => ({ siteLink: `${FRONT_URL}/backoffice/dashboard` }),
      },
      {
        name: 'sendWarnAccountDeletionMail',
        template: MailjetTemplates.MAILER_WARN_ACCOUNT_DELETION,
        replyTo: true,
        call: (s, u) => s.sendWarnAccountDeletionMail(u),
        variables: () => ({ role: 'Candidat' }),
      },
      {
        name: 'sendInactiveRefererMail',
        template: MailjetTemplates.MAILER_INACTIVE_REFERERS,
        replyTo: true,
        call: (s, u) => s.sendInactiveRefererMail(u),
        variables: () => ({ siteLink: FRONT_URL }),
      },
      {
        name: 'sendCommittedUsersFeedbackMail',
        template: MailjetTemplates.MAILER_COMMITTED_USERS_FEEDBACK,
        replyTo: true,
        call: (s, u) => s.sendCommittedUsersFeedbackMail(u),
        variables: (u) => ({ userId: u.id, email: u.email }),
      },
      {
        name: 'sendUnavailableUserMail',
        template: MailjetTemplates.MAILER_UNAVAILABLE_USER,
        replyTo: true,
        call: (s, u) => s.sendUnavailableUserMail(u, 4),
        variables: () => ({
          count: 4,
          profileUrl: `${FRONT_URL}/backoffice/dashboard`,
        }),
      },
      {
        name: 'sendCompanyNoAlertsReminderMail',
        template: MailjetTemplates.MAILER_COMPANY_NO_ALERTS_REMINDER,
        replyTo: true,
        call: (s, u) => s.sendCompanyNoAlertsReminderMail(u),
        variables: () => ({
          dashboardLink: `${FRONT_URL}/backoffice/dashboard`,
        }),
      },
      {
        name: 'sendRemindCompanyInvitationMail',
        template: MailjetTemplates.MAILER_REMIND_COMPANY_INVITATION,
        replyTo: true,
        call: (s, u) => s.sendRemindCompanyInvitationMail(u),
        variables: () => ({
          linkUrl: `${FRONT_URL}/backoffice/companies/parametres`,
        }),
      },
      {
        name: 'sendCompanyInvitationPendingMail',
        template: MailjetTemplates.MAILER_INACTIVE_COLLABORATORS,
        replyTo: true,
        call: (s, u) =>
          s.sendCompanyInvitationPendingMail(u, 'invited@example.org', 'c-1'),
        variables: () => ({
          invitationEmail: 'invited@example.org',
          companyId: 'c-1',
          companyAdminFirstName: 'Jean',
        }),
      },
      {
        name: 'sendNotCompletedCompanyMail',
        template: MailjetTemplates.MAILER_NOT_COMPLETED_COMPANY,
        replyTo: true,
        call: (s, u) => s.sendNotCompletedCompanyMail(u, 'ACME'),
        variables: () => ({ companyName: 'ACME' }),
      },
      {
        name: 'sendCompanyCollabFollowMail',
        template: MailjetTemplates.MAILER_FOLLOW_COLLAB_COMPANY,
        replyTo: true,
        call: (s, u) => s.sendCompanyCollabFollowMail(u, 'c-1', 'ACME'),
        variables: () => ({ companyId: 'c-1', companyName: 'ACME' }),
      },
      {
        name: 'sendReferedNotActivatedMail',
        template: MailjetTemplates.MAILER_INACTIVE_REFERED_CANDIDATE,
        replyTo: true,
        call: (s, u) =>
          s.sendReferedNotActivatedMail(u, {
            candidateEmail: 'cand@example.org',
            candidateFirstName: 'Cand',
            candidateLastName: 'Idate',
          }),
        variables: (u) => ({
          email: 'cand@example.org',
          firstName: 'Cand',
          lastName: 'Idate',
          refererEmail: u.email,
          role: 'Prescripteur',
        }),
      },
      {
        name: 'sendUnverifiedAccountRelaunchMail',
        template: MailjetTemplates.UNVERIFIED_ACCOUNT_RELAUNCH,
        replyTo: true,
        call: (s, u) =>
          s.sendUnverifiedAccountRelaunchMail(u, 'https://cta.example.org', 3),
        variables: () => ({
          ctaUrl: 'https://cta.example.org',
          nbRecommendation: 3,
        }),
      },
    ];

    it.each(CASES)(
      '$name queues a $template mail to the user',
      async ({ call, template, variables, replyTo }) => {
        const { mailsService, queuesService } = build();
        const user = buildUser();

        await call(mailsService, user);

        const mail = lastMail(queuesService);
        expect(mail.toEmail).toBe(user.email);
        expect(mail.templateId).toBe(template);
        expect(mail.variables).toEqual(
          expect.objectContaining(variables(user))
        );
        if (replyTo) {
          expect(mail.replyTo).toBe(STAFF_CONTACT.email);
        }
      }
    );

    it('tolerates a user without first name where a default is provided', async () => {
      const { mailsService, queuesService } = build();

      await mailsService.sendChurnUsersFeedbackMail(
        buildUser({ firstName: undefined })
      );

      expect(lastMail(queuesService).variables.firstName).toBe('');
    });

    it('sends the mails of a coach with the Coach role label', async () => {
      const { mailsService, queuesService } = build();

      await mailsService.sendOnboardingBAOMail(
        buildUser({ role: UserRoles.COACH })
      );

      expect(lastMail(queuesService).variables.role).toBe('Coach');
    });
  });

  describe('sendWelcomeMail', () => {
    it('sends the company admin welcome mail to the admin coach of a company', async () => {
      const { mailsService, queuesService } = build();
      const user = buildUser({
        role: UserRoles.COACH,
        company: {
          id: 'company-1',
          name: 'ACME',
          goal: 'Hire',
          companyUser: { isAdmin: true },
        },
      } as unknown as Partial<User>);

      await mailsService.sendWelcomeMail(user);

      const mail = lastMail(queuesService);
      expect(mail.templateId).toBe(
        MailjetTemplates.WELCOME_COACH_COMPANY_ADMIN
      );
      expect(mail.variables).toEqual(
        expect.objectContaining({
          companyName: 'ACME',
          companyGoal: 'Hire',
          siteLinkInvit: `${FRONT_URL}/backoffice/companies/company-1/collaborators`,
        })
      );
    });

    it('sends the regular welcome mail to a coach who is not company admin', async () => {
      const { mailsService, queuesService } = build();
      const user = buildUser({
        role: UserRoles.COACH,
        company: { companyUser: { isAdmin: false } },
      } as unknown as Partial<User>);

      await mailsService.sendWelcomeMail(user);

      expect(lastMail(queuesService).templateId).toBe(
        MailjetTemplates.WELCOME_CANDIDATE_COACH
      );
    });

    it('sends the referer welcome mail to a referer', async () => {
      const { mailsService, queuesService } = build();

      await mailsService.sendWelcomeMail(
        buildUser({ role: UserRoles.REFERER })
      );

      expect(lastMail(queuesService).templateId).toBe(
        MailjetTemplates.WELCOME_REFERER
      );
    });

    it('sends the candidate and coach welcome mail to a candidate', async () => {
      const { mailsService, queuesService } = build();

      await mailsService.sendWelcomeMail(buildUser());

      const mail = lastMail(queuesService);
      expect(mail.templateId).toBe(MailjetTemplates.WELCOME_CANDIDATE_COACH);
      expect(mail.variables.ctaUrl).toBe(`${FRONT_URL}/backoffice/dashboard`);
    });

    it('sends no welcome mail to an admin', async () => {
      const { mailsService, queuesService } = build();

      await mailsService.sendWelcomeMail(buildUser({ role: UserRoles.ADMIN }));

      expect(queuesService.addToWorkQueue).not.toHaveBeenCalled();
    });
  });

  describe('sendOnboardingContactAdviceMail', () => {
    it('sends the candidate subject and toolbox to a candidate', async () => {
      const { mailsService, queuesService } = build();

      await mailsService.sendOnboardingContactAdviceMail(buildUser());

      const mail = lastMail(queuesService);
      expect(mail.templateId).toBe(
        MailjetTemplates.ONBOARDING_J4_CONTACT_ADVICE
      );
      expect(mail.variables.subject).toContain('coup de main');
      expect(mail.variables.toolboxUrl).toBe(
        'https://toolbox.example.org/candidate'
      );
    });

    it('sends the coach subject and toolbox to a coach', async () => {
      const { mailsService, queuesService } = build();

      await mailsService.sendOnboardingContactAdviceMail(
        buildUser({ role: UserRoles.COACH })
      );

      const mail = lastMail(queuesService);
      expect(mail.variables.subject).toContain('super coach');
      expect(mail.variables.toolboxUrl).toBe(
        'https://toolbox.example.org/coach'
      );
    });
  });

  describe('sendContactUsMail', () => {
    it('forwards the form to the contact mailbox, translating how the sender heard about the service and omitting empty fields', async () => {
      const { mailsService, queuesService } = build();

      await mailsService.sendContactUsMail({
        email: 'visitor@example.org',
        firstName: 'Vi',
        lastName: 'Sitor',
        message: 'Hello',
        heardAbout: 'company',
        phone: undefined,
      } as never);

      const mail = lastMail(queuesService);
      expect(mail.toEmail).toBe('contact@example.org');
      expect(mail.templateId).toBe(MailjetTemplates.CONTACT_FORM);
      expect(mail.variables).toEqual(
        expect.objectContaining({
          email: 'visitor@example.org',
          message: 'Hello',
          heardAbout: expect.any(String),
        })
      );
      expect(mail.variables).not.toHaveProperty('phone');
      expect(mail.variables.heardAbout).toBe('Mon entreprise');
    });

    it('leaves the heard about field out when the sender did not give it', async () => {
      const { mailsService, queuesService } = build();

      await mailsService.sendContactUsMail({
        email: 'visitor@example.org',
        message: 'Hello',
      } as never);

      expect(lastMail(queuesService).variables).not.toHaveProperty(
        'heardAbout'
      );
    });
  });

  describe('sendNewMessageNotifMail', () => {
    it('queues one mail per addressee with its own autologin link to the conversation', async () => {
      const { mailsService, queuesService } = build();
      const message = {
        authorId: 'author-1',
        content: 'Hello!',
        author: { firstName: 'Au', lastName: 'Thor', role: UserRoles.COACH },
      };
      const addressees = [
        buildUser({ id: 'a1', email: 'a1@example.org' }),
        buildUser({ id: 'a2', email: 'a2@example.org' }),
      ];

      await mailsService.sendNewMessageNotifMail(message as never, addressees, {
        a1: 'tok 1',
        a2: 'tok-2',
      });

      expect(queuesService.addToWorkQueue).toHaveBeenCalledTimes(2);
      const mails = queuesService.addToWorkQueue.mock.calls.map(
        ([, mail]) => mail
      );
      expect(mails[0].toEmail).toBe('a1@example.org');
      expect(mails[0].templateId).toBe(MailjetTemplates.MESSAGING_MESSAGE);
      expect(mails[0].variables).toEqual(
        expect.objectContaining({
          senderId: 'author-1',
          senderFirstName: 'Au',
          message: 'Hello!',
          conversationUrl: `${FRONT_URL}/backoffice/messaging?userId=author-1&autologinToken=tok%201`,
        })
      );
      expect(mails[1].variables.conversationUrl).toContain('tok-2');
    });
  });

  describe('checkin mails', () => {
    it.each([
      [
        'sendCheckinInvitationMail' as const,
        MailjetTemplates.MAILER_CONVERSATION_CHECKIN_INVITATION,
      ],
      [
        'sendCheckinRelanceMail' as const,
        MailjetTemplates.MAILER_CONVERSATION_CHECKIN_RELANCE,
      ],
    ])(
      '%s links to the checkin screen of the conversation',
      async (method, template) => {
        const { mailsService, queuesService } = build();
        const other = buildUser({
          id: 'other',
          firstName: 'Other',
          role: UserRoles.COACH,
        });

        await mailsService[method](buildUser(), other, 'conv-1', 'tok/1');

        const mail = lastMail(queuesService);
        expect(mail.templateId).toBe(template);
        expect(mail.variables).toEqual(
          expect.objectContaining({
            otherParticipantFirstName: 'Other',
            otherParticipantRole: UserRoles.COACH,
            checkinUrl: `${FRONT_URL}/backoffice/checkin/conv-1?autologinToken=tok%2F1`,
          })
        );
      }
    );

    it('sendCheckinNoteMail links to the conversation with the other participant', async () => {
      const { mailsService, queuesService } = build();
      const other = buildUser({ id: 'other', firstName: 'Other' });

      await mailsService.sendCheckinNoteMail(
        buildUser(),
        other,
        'A note',
        'tok'
      );

      const mail = lastMail(queuesService);
      expect(mail.templateId).toBe(
        MailjetTemplates.MAILER_CONVERSATION_CHECKIN_NOTE
      );
      expect(mail.variables).toEqual(
        expect.objectContaining({
          message: 'A note',
          conversationUrl: `${FRONT_URL}/backoffice/messaging?userId=other&autologinToken=tok`,
        })
      );
    });
  });

  describe('help group mails', () => {
    const baseEmail = {
      actorFirstName: 'Alice',
      discussionAuthorFirstName: 'Bob',
      discussionTitle: 'How to write a CV?',
      groupName: 'Job search',
      excerpt: 'An excerpt',
      discussionUrl: 'https://front.example.org/discussion',
      settingsUrl: 'https://front.example.org/settings',
    };

    it.each([
      [
        HelpGroupNotificationEmailKinds.REPLY_TO_AUTHOR,
        'Alice vous a répondu dans « Job search »',
      ],
      [
        HelpGroupNotificationEmailKinds.REPLY_TO_PARTICIPANT,
        'Alice a répondu dans une discussion où vous avez participé',
      ],
      [
        HelpGroupNotificationEmailKinds.REACTION,
        'Alice a réagi à votre message',
      ],
    ])('builds the subject of a %s notification', async (kind, subject) => {
      const { mailsService, queuesService } = build();

      await mailsService.sendHelpGroupNotification(buildUser(), {
        ...baseEmail,
        kind,
      } as never);

      const mail = lastMail(queuesService);
      expect(mail.templateId).toBe(MailjetTemplates.HELP_GROUP_NOTIFICATION);
      expect(mail.subject).toBe(subject);
      expect(mail.variables.subject).toBe(subject);
      expect(mail.variables.reason).toEqual(expect.any(String));
      // The Mailjet template tests the reaction target against ""
      expect(mail.variables.reactionTarget).toBe('');
    });

    it('sends the daily digest leaving out null values, which Mailjet rejects', async () => {
      const { mailsService, queuesService } = build();

      await mailsService.sendHelpGroupsDailyDigest(buildUser(), {
        subject: '2 nouvelles discussions',
        groupsUrl: undefined,
        groups: [
          {
            name: 'Job search',
            discussions: [{ title: 'Hello', excerpt: null }],
          },
        ],
      } as never);

      const mail = lastMail(queuesService);
      expect(mail.templateId).toBe(
        MailjetTemplates.HELP_GROUPS_DAILY_DISCUSSIONS
      );
      expect(mail.variables.groups[0].discussions[0]).toEqual({
        title: 'Hello',
      });
      expect(mail.variables).not.toHaveProperty('groupsUrl');
    });

    it('adds the groups link to the daily digest when there is one', async () => {
      const { mailsService, queuesService } = build();

      await mailsService.sendHelpGroupsDailyDigest(buildUser(), {
        subject: 'Digest',
        groupsUrl: 'https://front.example.org/groups',
        groups: [],
      } as never);

      expect(lastMail(queuesService).variables.groupsUrl).toBe(
        'https://front.example.org/groups'
      );
    });
  });

  describe('referer and company mails', () => {
    it('sends the finalize account mail to a candidate referred by an organization member', async () => {
      const { mailsService, queuesService } = build();
      const referer = buildUser({
        id: 'ref-1',
        firstName: 'Ref',
        lastName: 'Erer',
        role: UserRoles.REFERER,
        organization: { name: 'Org' },
      } as unknown as Partial<User>);
      const candidate = buildUser({ id: 'cand-1', email: 'cand@example.org' });

      await mailsService.sendReferedCandidateFinalizeAccountMail(
        referer,
        candidate,
        'tok'
      );

      const mail = lastMail(queuesService);
      expect(mail.toEmail).toBe('cand@example.org');
      expect(mail.templateId).toBe(
        MailjetTemplates.REFERED_CANDIDATE_FINALIZE_ACCOUNT
      );
      expect(mail.variables).toEqual(
        expect.objectContaining({
          organizationName: 'Org',
          refererFirstName: 'Ref',
          finalizeAccountUrl: `${FRONT_URL}/finaliser-compte?token=tok`,
        })
      );
    });

    it('tells the referer that the candidate verified the account, with the staff contact in copy', async () => {
      const { mailsService, queuesService } = build();
      const candidate = buildUser({
        referer: buildUser({ id: 'ref-1', email: 'ref@example.org' }),
      } as unknown as Partial<User>);

      await mailsService.sendRefererCandidateHasVerifiedAccountMail(candidate);

      const mail = lastMail(queuesService);
      expect(mail.toEmail).toEqual({
        to: 'ref@example.org',
        bcc: STAFF_CONTACT.email,
      });
      expect(mail.templateId).toBe(
        MailjetTemplates.REFERER_CANDIDATE_HAS_FINALIZED_ACCOUNT
      );
      expect(mail.variables.loginUrl).toBe(`${FRONT_URL}/login`);
    });

    it('fails when the candidate has no referer', async () => {
      const { mailsService, queuesService } = build();

      await expect(
        mailsService.sendRefererCandidateHasVerifiedAccountMail(
          buildUser({ referer: null } as unknown as Partial<User>)
        )
      ).rejects.toThrow(NotFoundException);
      expect(queuesService.addToWorkQueue).not.toHaveBeenCalled();
    });

    it('notifies the staff contact of a new referer', async () => {
      const { mailsService, queuesService } = build();

      await mailsService.sendAdminNewRefererNotificationMail(
        buildUser({ id: 'ref-1', role: UserRoles.REFERER })
      );

      const mail = lastMail(queuesService);
      expect(mail.toEmail).toBe(STAFF_CONTACT.email);
      expect(mail.templateId).toBe(
        MailjetTemplates.ADMIN_NEW_REFERER_NOTIFICATION
      );
      expect(mail.variables.refererProfileUrl).toBe(
        `${FRONT_URL}/backoffice/admin/membres/ref-1`
      );
    });

    it('invites a collaborator to join the company with an encoded registration link', async () => {
      const { mailsService, queuesService } = build();

      await mailsService.sendCompanyInvitation({
        sender: buildUser({ firstName: 'Sender' }),
        email: 'invited@example.org',
        invitationWithCompany: {
          id: 'inv-1',
          company: { name: 'ACME & Co' },
        } as never,
      });

      const mail = lastMail(queuesService);
      expect(mail.toEmail).toBe('invited@example.org');
      expect(mail.templateId).toBe(
        MailjetTemplates.COMPANY_COLLABORATORS_INVITATION
      );
      expect(mail.variables.registerUrl).toBe(
        `${FRONT_URL}/inscription?companyName=ACME%20%26%20Co&flow=coach&invitationId=inv-1`
      );
    });

    it('tells every company admin that an invitation was used', async () => {
      const { mailsService, queuesService } = build();
      const admins = [
        buildUser({ id: 'ad1', email: 'ad1@example.org' }),
        buildUser({ id: 'ad2', email: 'ad2@example.org' }),
      ];

      await mailsService.sendEmailCollaboratorInvitationUsed(
        admins,
        buildUser({ firstName: 'New', lastName: 'Collab' })
      );

      expect(queuesService.addToWorkQueue).toHaveBeenCalledTimes(2);
      const mails = queuesService.addToWorkQueue.mock.calls.map(
        ([, mail]) => mail
      );
      expect(mails.map((m) => m.toEmail)).toEqual([
        'ad1@example.org',
        'ad2@example.org',
      ]);
      expect(mails[0].templateId).toBe(
        MailjetTemplates.COMPANY_INVITATION_USED
      );
      expect(mails[0].variables.createdUserFirstName).toBe('New');
    });

    it('sends a recruitment alert with a link to the alert, even without staff contact', async () => {
      const { mailsService, queuesService } = build();

      await mailsService.sendRecruitmentAlertMail({
        alertId: 'alert-1',
        alertName: 'Cooks',
        companyAdminEmail: 'admin@example.org',
        firstName: 'Ad',
        newCandidatesCount: 4,
        staffContact: undefined,
        zone: ZoneName.IDF,
      });

      const mail = lastMail(queuesService);
      expect(mail.toEmail).toBe('admin@example.org');
      expect(mail.replyTo).toBeUndefined();
      expect(mail.templateId).toBe(MailjetTemplates.MAILER_RECRUITMENT_ALERT);
      expect(mail.variables).toEqual(
        expect.objectContaining({
          newCandidatesCount: 4,
          alertLink: `${FRONT_URL}/backoffice/alerte-candidats/alert-1`,
        })
      );
    });
  });

  describe('conversation mails', () => {
    it('lists the other participants first names in the follow-up mail', async () => {
      const { mailsService, queuesService } = build();
      const user = buildUser({ id: 'me' });

      await mailsService.sendFollowUpMailForMutuallyRepliedConversation(user, {
        id: 'conv-1',
        participants: [
          { id: 'me', firstName: 'Jean' },
          { id: 'o1', firstName: 'Alice' },
          { id: 'o2', firstName: 'Bob' },
        ],
      } as never);

      const mail = lastMail(queuesService);
      expect(mail.templateId).toBe(
        MailjetTemplates.FOLLOW_UP_MUTUALLY_REPLIED_CONVERSATION
      );
      expect(mail.variables.participantsFirstNames).toBe('Alice, Bob');
    });

    it('sends the LinkedIn share mail to the coach with a link to the candidate profile', async () => {
      const { mailsService, queuesService } = build();

      await mailsService.sendLinkedInShareProfileMail(
        buildUser({ role: UserRoles.COACH, email: 'coach@example.org' }),
        buildUser({ id: 'cand-1', firstName: 'Cand' })
      );

      const mail = lastMail(queuesService);
      expect(mail.toEmail).toBe('coach@example.org');
      expect(mail.templateId).toBe(
        MailjetTemplates.MAILER_LINKEDIN_SHARE_PROFILE
      );
      expect(mail.variables).toEqual(
        expect.objectContaining({
          interlocutorFirstName: 'Cand',
          ctaUrl: `${FRONT_URL}/backoffice/profile/cand-1?openLinkedInSharer=true`,
        })
      );
    });

    it('addresses the unavailability notification to the message author', async () => {
      const { mailsService, queuesService } = build();
      const unavailable = buildUser({
        id: 'away',
        firstName: 'Away',
        role: UserRoles.COACH,
      });
      const author = buildUser({
        id: 'author',
        email: 'author@example.org',
        firstName: 'Author',
      });

      await mailsService.sendUnavailableSenderNotificationMail(
        unavailable,
        author
      );

      const mail = lastMail(queuesService);
      expect(mail.toEmail).toBe('author@example.org');
      expect(mail.templateId).toBe(
        MailjetTemplates.MAILER_UNAVAILABLE_SENDER_NOTIFICATION
      );
      expect(mail.variables).toEqual(
        expect.objectContaining({
          senderFirstName: 'Author',
          senderRole: 'Candidat',
          addresseeFirstName: 'Away',
          addresseeRole: 'Coach',
          siteLink: FRONT_URL,
        })
      );
    });

    it.each([
      [UserRoles.CANDIDATE, 4, '2 conversation(s) attend(ent) votre réponse'],
      [
        UserRoles.CANDIDATE,
        10,
        'Toujours 2 conversation(s) en attente… On vous',
      ],
      [UserRoles.COACH, 4, 'Vous avez 2 conversation(s) en attente'],
      [UserRoles.COACH, 20, "Et si vous y répondiez aujourd'hui"],
      [UserRoles.REFERER, 10, 'Vous avez 2 conversation(s) en attente'],
    ] as [UserRole, number, string][])(
      'picks the unanswered conversations subject of a %s at J+%s',
      async (role, days, expectedSubject) => {
        const { mailsService, queuesService } = build();

        await mailsService.sendUnansweredConversationsMail(
          buildUser({ role }),
          2,
          days
        );

        const mail = lastMail(queuesService);
        expect(mail.subject).toContain(expectedSubject);
        expect(mail.templateId).toBe(
          MailjetTemplates.MAILER_UNANSWERED_CONVERSATIONS
        );
        expect(mail.variables).toEqual(
          expect.objectContaining({
            days,
            count: 2,
            answerUrl: `${FRONT_URL}/backoffice/messaging`,
          })
        );
      }
    );

    it('refuses to build a role label for an unknown role', async () => {
      const { mailsService } = build();

      await expect(
        mailsService.sendOnboardingBAOMail(
          buildUser({ role: 'Ghost' as UserRole })
        )
      ).rejects.toThrow('Unknown role');
    });
  });

  describe('elearning reminder', () => {
    it('names the opposite role in lower case', async () => {
      const { mailsService, queuesService } = build();

      await mailsService.sendElearningCompletionReminderMail(
        buildUser({ role: UserRoles.COACH }),
        UserRoles.CANDIDATE
      );

      expect(lastMail(queuesService).variables.oppositeRole).toBe('candidat');
    });
  });

  describe('recommendation mails', () => {
    const recommendation = (
      id: string,
      overrides: Record<string, unknown> = {},
      reason: MatchingReason = MatchingReason.PROFILE
    ) => ({
      id: `reco-${id}`,
      reason,
      publicProfile: {
        id,
        firstName: `First${id}`,
        zone: ZoneName.IDF,
        department: 'Paris (75)',
        role: UserRoles.COACH,
        currentJob: 'Cook',
        hasPicture: true,
        sectorOccupations: [
          {
            businessSector: { name: 'Restauration' },
            occupation: { name: 'Cuisinier' },
          },
          { businessSector: { name: 'Transport' } },
        ],
        ...overrides,
      },
    });

    it('formats up to three recommended profiles for a candidate', async () => {
      const { mailsService, queuesService } = build();

      await mailsService.sendRecommendationsMail(buildUser(), [
        recommendation('p1'),
        recommendation('p2', { hasPicture: false }, MatchingReason.NEEDS),
        recommendation('p3', {}, MatchingReason.ACTIVITY),
      ] as never);

      const mail = lastMail(queuesService);
      expect(mail.templateId).toBe(
        MailjetTemplates.MAILER_USER_RECOMMENDATIONS
      );
      expect(mail.subject).toContain('3 coachs');
      expect(mail.variables.nbReco).toBe(3);
      expect(mail.variables.reco1).toEqual({
        imageUrl: 'https://s3.example.org/images/p1.profile.jpg',
        firstName: 'Firstp1',
        zone: expect.any(String),
        department: 'Paris (75)',
        workTitle: 'Cook',
        businessSector1: 'Restauration',
        businessSector2: 'Transport',
        businessSector3: '',
        profileUrl: `${FRONT_URL}/backoffice/profile/p1`,
        reason: 'Son profil correspond à ce que vous recherchez',
      });
      expect(mail.variables.reco2.imageUrl).toBe(
        'https://s3.example.org/images/profile-placeholder.png'
      );
      expect(mail.variables.reco2.reason).toBe(
        'Ses besoins correspondent aux vôtres'
      );
      expect(mail.variables.reco3.reason).toBe('Très actif en ce moment');
    });

    it('words the reasons and the subject for a coach', async () => {
      const { mailsService, queuesService } = build();

      await mailsService.sendRecommendationsMail(
        buildUser({ role: UserRoles.COACH }),
        [
          recommendation(
            'p1',
            { role: UserRoles.CANDIDATE },
            MatchingReason.PROFILE
          ),
          recommendation(
            'p2',
            { role: UserRoles.CANDIDATE },
            MatchingReason.NEEDS
          ),
          recommendation(
            'p3',
            { role: UserRoles.CANDIDATE },
            MatchingReason.LOCATION_COMPATIBILITY
          ),
        ] as never
      );

      const mail = lastMail(queuesService);
      expect(mail.subject).toContain('Ces candidats ont besoin');
      expect(mail.variables.reco1.reason).toBe(
        'Son profil correspond à ce que vous proposez'
      );
      expect(mail.variables.reco2.reason).toBe(
        'Ses besoins correspondent à ce que vous proposez'
      );
      expect(mail.variables.reco3.reason).toBe('Dans votre zone géographique');
      // A candidate profile shows its wished occupation as work title
      expect(mail.variables.reco1.workTitle).toBe('Cuisinier');
    });

    it('falls back on an open-minded work title for a candidate without wished occupation', async () => {
      const { mailsService, queuesService } = build();

      await mailsService.sendRecommendationsMail(
        buildUser({ role: UserRoles.COACH }),
        [
          recommendation('p1', {
            role: UserRoles.CANDIDATE,
            sectorOccupations: [],
          }),
        ] as never
      );

      expect(lastMail(queuesService).variables.reco1.workTitle).toBe(
        'Je suis ouvert à toutes les opportunités'
      );
    });

    it('fills the missing recommendations with null', async () => {
      const { mailsService, queuesService } = build();

      await mailsService.sendOnboardingCompletedMail(buildUser(), [
        recommendation('p1'),
      ] as never);

      const mail = lastMail(queuesService);
      expect(mail.templateId).toBe(MailjetTemplates.ONBOARDING_COMPLETED);
      expect(mail.variables.nbReco).toBe(1);
      expect(mail.variables.reco2).toBeNull();
      expect(mail.variables.reco3).toBeNull();
    });

    it('handles a missing recommendation list', async () => {
      const { mailsService, queuesService } = build();

      await mailsService.sendRecommendationsMail(
        buildUser(),
        undefined as never
      );

      expect(lastMail(queuesService).variables.nbReco).toBe(0);
    });

    it('lists the addressees first names in the no response to first message mail', async () => {
      const { mailsService, queuesService } = build();

      await mailsService.sendMailForNoResponseToFirstMessage(
        buildUser({ role: UserRoles.CANDIDATE }),
        'Alice, Bob',
        [recommendation('p1')] as never
      );

      const mail = lastMail(queuesService);
      expect(mail.templateId).toBe(
        MailjetTemplates.NO_RESPONSE_TO_FIRST_MESSAGE
      );
      expect(mail.variables).toEqual(
        expect.objectContaining({
          addresseesFirstNames: 'Alice, Bob',
          role: 'Candidat',
          nbReco: 1,
        })
      );
    });
  });

  describe('Super Engagé achievement mails', () => {
    const achievementUser = {
      email: 'coach@example.org',
      firstName: 'Coach',
      staffContact: STAFF_CONTACT,
      zone: ZoneName.IDF,
    };

    it('sends the badge mail with a LinkedIn certification link to the certificate', async () => {
      const { mailsService, queuesService } = build();

      await mailsService.sendSuperEngagedAchievementMail(
        achievementUser,
        { conversationCount: 5, responseRate: 90 },
        new Date('2030-01-15T12:00:00Z'),
        'achievement-1'
      );

      const mail = lastMail(queuesService);
      expect(mail.templateId).toBe(MailjetTemplates.SUPER_ENGAGED_ACHIEVEMENT);
      expect(mail.variables.conversationCount).toBe(5);
      expect(mail.variables.responseRate).toBe(90);
      const ctaUrl = new URL(mail.variables.ctaUrl);
      expect(ctaUrl.origin + ctaUrl.pathname).toBe(
        'https://www.linkedin.com/profile/add'
      );
      expect(ctaUrl.searchParams.get('certUrl')).toBe(
        `${FRONT_URL}/coach-certification/achievement-1`
      );
      expect(ctaUrl.searchParams.get('startTask')).toBe('CERTIFICATION_NAME');
    });

    it('tells whether the goal is already reached in the reminder mail', async () => {
      const { mailsService, queuesService } = build();

      await mailsService.sendSuperEngagedAchievementReminderMail(
        achievementUser,
        { conversationCount: 1, responseRate: 40, goalAchieved: false },
        new Date('2030-01-15T12:00:00Z')
      );

      const mail = lastMail(queuesService);
      expect(mail.templateId).toBe(
        MailjetTemplates.SUPER_ENGAGED_ACHIEVEMENT_REMINDER
      );
      expect(mail.variables.goalAchieved).toBe('false');
    });

    it('sends the expiration mail with the stats', async () => {
      const { mailsService, queuesService } = build();

      await mailsService.sendSuperEngagedAchievementExpiredMail(
        achievementUser,
        { conversationCount: 1, responseRate: 40 }
      );

      const mail = lastMail(queuesService);
      expect(mail.templateId).toBe(
        MailjetTemplates.SUPER_ENGAGED_ACHIEVEMENT_EXPIRED
      );
      expect(mail.variables.responseRate).toBe(40);
    });
  });
});
