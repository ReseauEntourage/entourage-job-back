import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/sequelize';
import { Test, TestingModule } from '@nestjs/testing';
import { Sequelize } from 'sequelize-typescript';
import { CompanyInvitation } from 'src/companies/models/company-invitation.model';
import { QueuesService } from 'src/queues/producers/queues.service';
import { User } from 'src/users/models';
import { UsersService } from 'src/users/users.service';
import { OnboardingStatus, UserRoles } from 'src/users/users.types';
import { CompaniesHelper } from 'tests/companies/companies.helper';
import { CompanyFactory } from 'tests/companies/company.factory';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import { ConversationFactory } from 'tests/messaging/conversation.factory';
import { MessagingHelper } from 'tests/messaging/messaging.helper';
import { RecruitementAlertFactory } from 'tests/recruitement-alerts/recruitement-alert.factory';
import { UserFactory } from 'tests/users/user.factory';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

/** Local noon of the day that was `days` days ago: stays inside a daily window. */
const noonDaysAgo = (days: number) => {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  return new Date(date.getTime() - days * DAY_IN_MS);
};

/** The middle of the [days + 1, days[ days-ago window used by the SQL queries. */
const midWindow = (days: number) =>
  new Date(Date.now() - days * DAY_IN_MS - DAY_IN_MS / 2);

describe('UsersService - queries behind the cron tasks', () => {
  let app: INestApplication;
  let databaseHelper: DatabaseHelper;
  let userFactory: UserFactory;
  let usersService: UsersService;
  let companyFactory: CompanyFactory;
  let companiesHelper: CompaniesHelper;
  let alertFactory: RecruitementAlertFactory;
  let conversationFactory: ConversationFactory;
  let messagingHelper: MessagingHelper;
  let invitationModel: typeof CompanyInvitation;
  let sequelize: Sequelize;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [CustomTestingModule],
    })
      .overrideProvider(QueuesService)
      .useValue({
        addToWorkQueue: jest.fn().mockResolvedValue({ id: '1' }),
        addToEmbeddingQueue: jest.fn().mockResolvedValue({ id: '1' }),
      })
      .compile();
    app = moduleFixture.createNestApplication();
    await app.init();

    databaseHelper = moduleFixture.get(DatabaseHelper);
    userFactory = moduleFixture.get(UserFactory);
    usersService = moduleFixture.get(UsersService);
    companyFactory = moduleFixture.get(CompanyFactory);
    companiesHelper = moduleFixture.get(CompaniesHelper);
    alertFactory = moduleFixture.get(RecruitementAlertFactory);
    conversationFactory = moduleFixture.get(ConversationFactory);
    messagingHelper = moduleFixture.get(MessagingHelper);
    invitationModel = moduleFixture.get(getModelToken(CompanyInvitation));
    sequelize = moduleFixture.get(Sequelize);
  });

  afterAll(async () => {
    await databaseHelper.resetTestDB();
    await app.close();
  });

  beforeEach(async () => {
    await databaseHelper.resetTestDB();
  });

  const ids = (rows: { id: string }[]) => rows.map((r) => r.id).sort();
  const sorted = (...users: { id: string }[]) => ids(users);

  /** A conversation between `participants` whose messages are given in order. */
  const converse = async (
    participants: User[],
    messages: { at: Date; author: User }[],
    seenAt?: { at: Date; user: User }
  ) => {
    const conversation = await conversationFactory.create();
    await messagingHelper.associationParticipantsToConversation(
      conversation.id,
      participants.map((p) => p.id)
    );
    for (const { author, at } of messages) {
      await messagingHelper.createMessage(conversation.id, author.id, {
        createdAt: at,
      });
    }
    if (seenAt) {
      const participant = await messagingHelper.findConversationParticipant(
        conversation.id,
        seenAt.user.id
      );
      await participant.update({ seenAt: seenAt.at });
    }
    return conversation;
  };

  describe('getUsersCompletedOnboardingSinceDelay', () => {
    it('returns the candidates and coaches who completed onboarding that day only', async () => {
      const candidate = await userFactory.create({
        role: UserRoles.CANDIDATE,
        onboardingCompletedAt: noonDaysAgo(1),
      });
      const coach = await userFactory.create({
        role: UserRoles.COACH,
        onboardingCompletedAt: noonDaysAgo(1),
      });
      await userFactory.create({
        role: UserRoles.CANDIDATE,
        onboardingCompletedAt: noonDaysAgo(2),
      });
      await userFactory.create({
        role: UserRoles.REFERER,
        onboardingCompletedAt: noonDaysAgo(1),
      });
      await userFactory.create({
        role: UserRoles.CANDIDATE,
        onboardingCompletedAt: noonDaysAgo(1),
        onboardingStatus: OnboardingStatus.IN_PROGRESS,
      });

      const users = await usersService.getUsersCompletedOnboardingSinceDelay(1);

      expect(ids(users)).toEqual(sorted(candidate, coach));
    });
  });

  describe('getUsersEligibleForElearningCompletionReminder', () => {
    it('returns the people who completed onboarding 2 days ago without elearning, except company admins', async () => {
      const eligible = await userFactory.create({
        role: UserRoles.CANDIDATE,
        onboardingCompletedAt: noonDaysAgo(2),
        elearningCompletedAt: null,
      });
      await userFactory.create({
        role: UserRoles.CANDIDATE,
        onboardingCompletedAt: noonDaysAgo(2),
        elearningCompletedAt: new Date(),
      });
      await userFactory.create({
        role: UserRoles.CANDIDATE,
        onboardingCompletedAt: noonDaysAgo(3),
        elearningCompletedAt: null,
      });
      const companyAdmin = await userFactory.create({
        role: UserRoles.COACH,
        onboardingCompletedAt: noonDaysAgo(2),
        elearningCompletedAt: null,
      });
      const company = await companyFactory.create();
      await companiesHelper.linkCompanyToUser({
        userId: companyAdmin.id,
        companyId: company.id,
        isAdmin: true,
      });

      const users =
        await usersService.getUsersEligibleForElearningCompletionReminder(2);

      expect(ids(users)).toEqual(sorted(eligible));
    });

    it('returns nothing when nobody is eligible', async () => {
      await expect(
        usersService.getUsersEligibleForElearningCompletionReminder(2)
      ).resolves.toEqual([]);
    });
  });

  describe('getUsersWithNotCompletedProfile', () => {
    it('returns the users who completed onboarding 5 days ago with an incomplete profile', async () => {
      const noDescription = await userFactory.create(
        {
          role: UserRoles.CANDIDATE,
          onboardingCompletedAt: noonDaysAgo(5),
        },
        { userProfile: { description: null, hasPicture: true } }
      );
      const noPicture = await userFactory.create(
        { role: UserRoles.COACH, onboardingCompletedAt: noonDaysAgo(5) },
        { userProfile: { description: 'Hello', hasPicture: false } }
      );
      await userFactory.create(
        { role: UserRoles.CANDIDATE, onboardingCompletedAt: noonDaysAgo(3) },
        { userProfile: { description: null } }
      );
      await userFactory.create(
        { role: UserRoles.REFERER, onboardingCompletedAt: noonDaysAgo(5) },
        { userProfile: { description: null } }
      );

      const users = await usersService.getUsersWithNotCompletedProfile(5);

      expect(ids(users)).toEqual(sorted(noDescription, noPicture));
    });

    it('returns nothing when everybody is up to the mark', async () => {
      await expect(
        usersService.getUsersWithNotCompletedProfile(5)
      ).resolves.toEqual([]);
    });
  });

  describe('getUserIdsForChurnFeedback', () => {
    it('returns the candidates and coaches whose last connection was 60 days ago', async () => {
      const candidate = await userFactory.create({
        role: UserRoles.CANDIDATE,
        lastConnection: noonDaysAgo(60),
      });
      await userFactory.create({
        role: UserRoles.COACH,
        lastConnection: noonDaysAgo(30),
      });
      await userFactory.create({
        role: UserRoles.ADMIN,
        lastConnection: noonDaysAgo(60),
      });

      const rows = await usersService.getUserIdsForChurnFeedback(60);

      expect(ids(rows)).toEqual(sorted(candidate));
    });
  });

  describe('getUserIdsForWarnAccountDeletion', () => {
    const monthsAgo = (months: number, extraDays = 0) => {
      const date = new Date();
      date.setMonth(date.getMonth() - months);
      return new Date(date.getTime() - extraDays * DAY_IN_MS);
    };

    it('returns the users whose last connection is a month before the deletion threshold', async () => {
      const connected = await userFactory.create({
        role: UserRoles.CANDIDATE,
        lastConnection: monthsAgo(23, 10),
      });
      const neverConnected = await userFactory.create({
        role: UserRoles.COACH,
        lastConnection: null,
        createdAt: monthsAgo(23, 10),
      });
      await userFactory.create({
        role: UserRoles.CANDIDATE,
        lastConnection: monthsAgo(22),
      });
      await userFactory.create({
        role: UserRoles.ADMIN,
        lastConnection: monthsAgo(23, 10),
      });

      const rows = await usersService.getUserIdsForWarnAccountDeletion(23);

      expect(ids(rows)).toEqual(sorted(connected, neverConnected));
    });
  });

  describe('getUserIdsForInactiveReferers', () => {
    it('returns the referers created 15 days ago who referred nobody and are available', async () => {
      const idle = await userFactory.create({
        role: UserRoles.REFERER,
        createdAt: midWindow(15),
      });
      const active = await userFactory.create({
        role: UserRoles.REFERER,
        createdAt: midWindow(15),
      });
      await userFactory.create({
        role: UserRoles.CANDIDATE,
        refererId: active.id,
        createdAt: new Date(),
      });
      await userFactory.create(
        { role: UserRoles.REFERER, createdAt: midWindow(15) },
        { userProfile: { unavailableAt: new Date() } }
      );
      await userFactory.create({
        role: UserRoles.REFERER,
        createdAt: midWindow(5),
      });
      await userFactory.create({
        role: UserRoles.COACH,
        createdAt: midWindow(15),
      });

      const rows = await usersService.getUserIdsForInactiveReferers(15);

      expect(ids(rows)).toEqual(sorted(idle));
    });
  });

  describe('getReferedNotActivatedData', () => {
    it('returns the referred candidates who never connected, with their referer', async () => {
      const referer = await userFactory.create({ role: UserRoles.REFERER });
      const pending = await userFactory.create({
        role: UserRoles.CANDIDATE,
        refererId: referer.id,
        lastConnection: null,
        createdAt: midWindow(15),
      });
      await userFactory.create({
        role: UserRoles.CANDIDATE,
        refererId: referer.id,
        lastConnection: new Date(),
        createdAt: midWindow(15),
      });
      await userFactory.create({
        role: UserRoles.CANDIDATE,
        lastConnection: null,
        createdAt: midWindow(15),
      });

      const rows = await usersService.getReferedNotActivatedData(15);

      expect(rows).toEqual([
        expect.objectContaining({
          refererId: referer.id,
          candidateEmail: pending.email,
          candidateFirstName: pending.firstName,
          candidateLastName: pending.lastName,
        }),
      ]);
    });
  });

  describe('getUserIdsForCommittedFeedback', () => {
    it('returns the users whose very first message was sent 40 days ago', async () => {
      const first = await userFactory.create({ role: UserRoles.CANDIDATE });
      const other = await userFactory.create({ role: UserRoles.COACH });
      const veteran = await userFactory.create({ role: UserRoles.CANDIDATE });
      await converse([first, other], [{ author: first, at: midWindow(40) }]);
      await converse(
        [veteran, other],
        [
          { author: veteran, at: midWindow(100) },
          { author: veteran, at: midWindow(40) },
        ]
      );

      const rows = await usersService.getUserIdsForCommittedFeedback(40);

      expect(ids(rows)).toEqual(sorted(first));
    });
  });

  describe('getUserRowsForUnansweredConversations', () => {
    it('counts the conversations the recipient never answered, 2 days after the first message', async () => {
      const coach = await userFactory.create({ role: UserRoles.COACH });
      const candidate = await userFactory.create({ role: UserRoles.CANDIDATE });
      const otherCandidate = await userFactory.create({
        role: UserRoles.CANDIDATE,
      });
      await converse(
        [coach, candidate],
        [{ author: coach, at: noonDaysAgo(2) }]
      );
      await converse(
        [coach, otherCandidate],
        [{ author: coach, at: noonDaysAgo(2) }]
      );
      // The candidate already answered this one
      const answered = await userFactory.create({ role: UserRoles.CANDIDATE });
      await converse(
        [coach, answered],
        [
          { author: coach, at: noonDaysAgo(2) },
          {
            author: answered,
            at: new Date(noonDaysAgo(2).getTime() + 3600000),
          },
        ]
      );

      const rows = await usersService.getUserRowsForUnansweredConversations(2);

      const counts = new Map(
        rows.map((r) => [r.id, Number(r.unansweredConversationsCount)])
      );
      expect(counts.get(candidate.id)).toBe(1);
      expect(counts.get(otherCandidate.id)).toBe(1);
      // The candidate who answered has nothing waiting for them
      expect(counts.has(answered.id)).toBe(false);
    });

    it('also counts the ongoing conversations whose last message was not read after 2 days', async () => {
      const coach = await userFactory.create({ role: UserRoles.COACH });
      const candidate = await userFactory.create({ role: UserRoles.CANDIDATE });
      await converse(
        [coach, candidate],
        [
          { author: candidate, at: noonDaysAgo(5) },
          { author: coach, at: noonDaysAgo(2) },
        ]
      );

      const rows = await usersService.getUserRowsForUnansweredConversations(2);

      expect(rows.map((r) => r.id)).toEqual([candidate.id]);
    });

    it('does not count an ongoing conversation whose last message was read', async () => {
      const coach = await userFactory.create({ role: UserRoles.COACH });
      const candidate = await userFactory.create({ role: UserRoles.CANDIDATE });
      await converse(
        [coach, candidate],
        [
          { author: candidate, at: noonDaysAgo(5) },
          { author: coach, at: noonDaysAgo(2) },
        ],
        { user: candidate, at: new Date() }
      );

      const rows = await usersService.getUserRowsForUnansweredConversations(2);

      expect(rows).toEqual([]);
    });

    it('ignores the conversations with an admin', async () => {
      const admin = await userFactory.create({ role: UserRoles.ADMIN });
      const candidate = await userFactory.create({ role: UserRoles.CANDIDATE });
      await converse(
        [admin, candidate],
        [{ author: admin, at: noonDaysAgo(2) }]
      );

      const rows = await usersService.getUserRowsForUnansweredConversations(2);

      expect(rows).toEqual([]);
    });
  });

  describe('getUnansweredConversationSmsRows', () => {
    it('returns the candidates with a phone number who did not answer a coach for 3 days', async () => {
      const coach = await userFactory.create({
        role: UserRoles.COACH,
        firstName: 'Coach',
      });
      const reachable = await userFactory.create({ role: UserRoles.CANDIDATE });
      const noPhone = await userFactory.create({
        role: UserRoles.CANDIDATE,
        phone: null,
      });
      const answered = await userFactory.create({ role: UserRoles.CANDIDATE });
      const conversation = await converse(
        [coach, reachable],
        [{ author: coach, at: noonDaysAgo(3) }]
      );
      await converse([coach, noPhone], [{ author: coach, at: noonDaysAgo(3) }]);
      await converse(
        [coach, answered],
        [
          { author: coach, at: noonDaysAgo(3) },
          { author: answered, at: noonDaysAgo(3) },
        ]
      );

      const rows = await usersService.getUnansweredConversationSmsRows(
        UserRoles.CANDIDATE,
        3
      );

      expect(rows).toEqual([
        {
          recipientId: reachable.id,
          recipientPhone: reachable.phone,
          senderFirstName: coach.firstName,
          senderId: coach.id,
          conversationId: conversation.id,
        },
      ]);
    });

    it('targets the coaches when the candidate wrote first', async () => {
      const candidate = await userFactory.create({ role: UserRoles.CANDIDATE });
      const coach = await userFactory.create({ role: UserRoles.COACH });
      await converse(
        [candidate, coach],
        [{ author: candidate, at: noonDaysAgo(3) }]
      );

      const rows = await usersService.getUnansweredConversationSmsRows(
        UserRoles.COACH,
        3
      );

      expect(rows.map((r) => r.recipientId)).toEqual([coach.id]);
      expect(
        await usersService.getUnansweredConversationSmsRows(
          UserRoles.CANDIDATE,
          3
        )
      ).toEqual([]);
    });
  });

  describe('getUsersWithNoResponseToFirstMessage', () => {
    it('returns the authors of a lone message sent 5 days ago with their addressees', async () => {
      const author = await userFactory.create({ role: UserRoles.CANDIDATE });
      const addressee = await userFactory.create({ role: UserRoles.COACH });
      await converse([author, addressee], [{ author, at: noonDaysAgo(5) }]);
      // A conversation with several messages is not a lone message
      const talkative = await userFactory.create({ role: UserRoles.CANDIDATE });
      await converse(
        [talkative, addressee],
        [
          { author: talkative, at: noonDaysAgo(5) },
          { author: addressee, at: noonDaysAgo(5) },
        ]
      );

      const results =
        await usersService.getUsersWithNoResponseToFirstMessage(5);

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe(author.id);
      expect(results[0].user.id).toBe(author.id);
      expect(results[0].addressees.map((a) => a.id)).toEqual([addressee.id]);
      expect(results[0].recommendations).toEqual([]);
    });

    it('returns nothing when no lone message is that old', async () => {
      await expect(
        usersService.getUsersWithNoResponseToFirstMessage(5)
      ).resolves.toEqual([]);
    });
  });

  describe('company admin queries', () => {
    const createCompanyWithAdmin = async (
      companyProps: Record<string, unknown> = {},
      adminProps: Record<string, unknown> = {}
    ) => {
      const company = await companyFactory.create(companyProps);
      const admin = await userFactory.create({
        role: UserRoles.COACH,
        ...adminProps,
      });
      await companiesHelper.linkCompanyToUser({
        userId: admin.id,
        companyId: company.id,
        isAdmin: true,
      });
      return { company, admin };
    };

    it('returns the admins of a recruiting company created 2 days ago without any alert', async () => {
      const { admin } = await createCompanyWithAdmin({
        goal: 'recruit',
        createdAt: midWindow(2),
      });
      const withAlert = await createCompanyWithAdmin({
        goal: 'both',
        createdAt: midWindow(2),
      });
      await alertFactory.create({
        name: 'Alert',
        jobName: 'Cook',
        companyId: withAlert.company.id,
      });
      await createCompanyWithAdmin({
        goal: 'sensibilize',
        createdAt: midWindow(2),
      });
      await createCompanyWithAdmin({ goal: 'recruit', createdAt: new Date() });

      const rows = await usersService.getCompanyAdminIdsForNoAlertsReminder();

      expect(rows).toEqual([{ adminId: admin.id }]);
    });

    it('returns the admins registered 3 days ago whose company has not invited anyone yet', async () => {
      const { admin } = await createCompanyWithAdmin(
        { goal: 'both' },
        { createdAt: midWindow(3) }
      );
      const invited = await createCompanyWithAdmin(
        { goal: 'sensibilize' },
        { createdAt: midWindow(3) }
      );
      await invitationModel.create({
        companyId: invited.company.id,
        authorId: invited.admin.id,
        email: 'invited@example.org',
      });
      await createCompanyWithAdmin(
        { goal: 'recruit' },
        { createdAt: midWindow(3) }
      );

      const rows = await usersService.getCompanyAdminIdsForRemindInvitation(3);

      expect(rows).toEqual([{ adminId: admin.id }]);
    });

    it('returns the invitations still pending after 7 days with the admin who sent them', async () => {
      const { company, admin } = await createCompanyWithAdmin();
      const accepted = await userFactory.create({ role: UserRoles.COACH });
      await invitationModel.create({
        companyId: company.id,
        authorId: admin.id,
        email: 'pending@example.org',
        createdAt: midWindow(7),
      });
      await invitationModel.create({
        companyId: company.id,
        authorId: admin.id,
        email: 'accepted@example.org',
        userId: accepted.id,
        createdAt: midWindow(7),
      });
      await invitationModel.create({
        companyId: company.id,
        authorId: admin.id,
        email: 'recent@example.org',
        createdAt: midWindow(2),
      });

      const rows = await usersService.getCompanyInvitationPendingData(7);

      expect(rows).toEqual([
        {
          adminId: admin.id,
          invitationEmail: 'pending@example.org',
          companyId: company.id,
        },
      ]);
    });

    it('returns the admins registered 4 days ago whose company page is incomplete', async () => {
      const incomplete = await createCompanyWithAdmin(
        { name: 'Incomplete Co' },
        { createdAt: midWindow(4) }
      );
      const complete = await createCompanyWithAdmin(
        {
          name: 'Complete Co',
          description: 'd',
          url: 'https://c.example.org',
          linkedInUrl: 'https://linkedin.example.org/c',
          logoUrl: 'https://c.example.org/logo.png',
        },
        { createdAt: midWindow(4) }
      );
      // `city` has no attribute in the Company model: set it in SQL
      await sequelize.query(
        'UPDATE "Companies" SET city = \'Paris\' WHERE id = :id',
        { replacements: { id: complete.company.id } }
      );

      const rows =
        await usersService.getCompanyAdminDataForNotCompletedCompany(4);

      expect(rows).toEqual([
        { adminId: incomplete.admin.id, companyName: 'Incomplete Co' },
      ]);
    });

    it('returns the admins of a company whose first collaborator wrote to a candidate today', async () => {
      const { company, admin } = await createCompanyWithAdmin({
        name: 'Collab Co',
      });
      const collaborator = await userFactory.create({ role: UserRoles.COACH });
      await companiesHelper.linkCompanyToUser({
        userId: collaborator.id,
        companyId: company.id,
        isAdmin: false,
      });
      const candidate = await userFactory.create({ role: UserRoles.CANDIDATE });
      await converse(
        [collaborator, candidate],
        [{ author: collaborator, at: new Date() }]
      );

      const rows = await usersService.getCompanyAdminDataForCollabFollow();

      expect(rows).toEqual([
        { adminId: admin.id, companyId: company.id, companyName: 'Collab Co' },
      ]);
    });

    it('does not follow a company whose first collaborator message is older', async () => {
      const { company } = await createCompanyWithAdmin();
      const collaborator = await userFactory.create({ role: UserRoles.COACH });
      await companiesHelper.linkCompanyToUser({
        userId: collaborator.id,
        companyId: company.id,
        isAdmin: false,
      });
      const candidate = await userFactory.create({ role: UserRoles.CANDIDATE });
      await converse(
        [collaborator, candidate],
        [{ author: collaborator, at: noonDaysAgo(3) }]
      );

      await expect(
        usersService.getCompanyAdminDataForCollabFollow()
      ).resolves.toEqual([]);
    });
  });

  describe('generatePostOnboardingWelcomeMessage', () => {
    const staffContact = { name: 'Staffie' };

    it('welcomes a candidate on behalf of the staff contact', async () => {
      const message = await usersService.generatePostOnboardingWelcomeMessage({
        role: UserRoles.CANDIDATE,
        firstName: 'Jean',
        staffContact,
      } as never);

      expect(message).toContain('Bonjour Jean,');
      expect(message).toContain('je suis Staffie');
      expect(message).toContain('profils de coachs');
    });

    it('welcomes a coach on behalf of the staff contact', async () => {
      const message = await usersService.generatePostOnboardingWelcomeMessage({
        role: UserRoles.COACH,
        firstName: 'Jeanne',
        staffContact,
      } as never);

      expect(message).toContain('Bonjour Jeanne,');
      expect(message).toContain('en tant que coach');
      expect(message).toContain('profils des candidats');
    });

    it.each([
      [
        'a company admin',
        { role: UserRoles.COACH, company: { companyUser: { isAdmin: true } } },
      ],
      ['a referer', { role: UserRoles.REFERER }],
      ['an admin', { role: UserRoles.ADMIN }],
    ])('sends no welcome message to %s', async (_label, user) => {
      await expect(
        usersService.generatePostOnboardingWelcomeMessage({
          firstName: 'X',
          staffContact,
          ...user,
        } as never)
      ).resolves.toBeNull();
    });
  });

  describe('getUserMirrorRole', () => {
    it.each([
      [UserRoles.CANDIDATE, UserRoles.COACH],
      [UserRoles.COACH, UserRoles.CANDIDATE],
      [UserRoles.REFERER, UserRoles.CANDIDATE],
      [UserRoles.ADMIN, null],
    ])('maps %s to %s', (role, mirror) => {
      expect(usersService.getUserMirrorRole(role)).toBe(mirror);
    });
  });
});
