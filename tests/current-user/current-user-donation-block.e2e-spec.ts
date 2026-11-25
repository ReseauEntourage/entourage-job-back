import { INestApplication, Logger } from '@nestjs/common';
import { getModelToken } from '@nestjs/sequelize';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { CompanyUserRole } from 'src/companies/company-user.utils';
import { SalesforceService } from 'src/external-services/salesforce/salesforce.service';
import { MailsService } from 'src/mails/mails.service';
import { ConversationType } from 'src/messaging/models/conversation.model';
import { QueuesService } from 'src/queues/producers/queues.service';
import { User } from 'src/users/models';
import { OnboardingStatus, UserRoles } from 'src/users/users.types';
import { CompaniesHelper } from 'tests/companies/companies.helper';
import { CompanyFactory } from 'tests/companies/company.factory';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import { MailsServiceMock } from 'tests/mails/mails.service.mock';
import { ConversationFactory } from 'tests/messaging/conversation.factory';
import { MessagingHelper } from 'tests/messaging/messaging.helper';
import { SalesforceMocks } from 'tests/mocks.types';
import { QueuesServiceMock } from 'tests/queues/queues.service.mock';
import { LoggedInUser, UsersHelper } from 'tests/users/users.helper';

// Dashboard donation block: visibility rules and permanent dismissal
// (capability `home-donation-block`).
describe('CurrentUser - donation block', () => {
  let app: INestApplication;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let server: any;
  let databaseHelper: DatabaseHelper;
  let usersHelper: UsersHelper;
  let messagingHelper: MessagingHelper;
  let conversationFactory: ConversationFactory;
  let companiesHelper: CompaniesHelper;
  let companyFactory: CompanyFactory;
  let userModel: typeof User;

  const route = '/current/donation-block';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [CustomTestingModule],
    })
      .overrideProvider(QueuesService)
      .useValue(QueuesServiceMock)
      .overrideProvider(MailsService)
      .useClass(MailsServiceMock)
      .overrideProvider(SalesforceService)
      .useValue(SalesforceMocks)
      .compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    server = app.getHttpServer();
    databaseHelper = moduleFixture.get(DatabaseHelper);
    usersHelper = moduleFixture.get(UsersHelper);
    messagingHelper = moduleFixture.get(MessagingHelper);
    conversationFactory = moduleFixture.get(ConversationFactory);
    companiesHelper = moduleFixture.get(CompaniesHelper);
    companyFactory = moduleFixture.get(CompanyFactory);
    userModel = app.get(getModelToken(User));
  });

  afterAll(async () => {
    await databaseHelper.resetTestDB();
    await app.close();
    server.close();
  });

  beforeEach(async () => {
    await databaseHelper.resetTestDB();
  });

  const getVisible = async (user: LoggedInUser) => {
    const response = await request(server)
      .get(route)
      .set('authorization', `Bearer ${user.token}`);
    expect(response.status).toBe(200);
    return response.body.visible;
  };

  const createConversation = async (
    participants: LoggedInUser[],
    type: ConversationType = ConversationType.DIRECT
  ) => {
    const conversation = await conversationFactory.create({ type });
    await messagingHelper.associationParticipantsToConversation(
      conversation.id,
      participants.map(({ user }) => user.id)
    );
    return conversation;
  };

  const createUser = (role: (typeof UserRoles)[keyof typeof UserRoles]) =>
    usersHelper.createLoggedInUser({ role });

  it('refuses anonymous users', async () => {
    const response = await request(server).get(route);
    expect(response.status).toBe(401);
    const dismiss = await request(server).post(`${route}/dismiss`);
    expect(dismiss.status).toBe(401);
  });

  describe('coach', () => {
    it('sees the block after a mutual direct exchange with a candidate', async () => {
      const coach = await createUser(UserRoles.COACH);
      const candidate = await createUser(UserRoles.CANDIDATE);
      const conversation = await createConversation([coach, candidate]);
      await messagingHelper.createMessage(conversation.id, candidate.user.id);
      await messagingHelper.createMessage(conversation.id, coach.user.id);

      expect(await getVisible(coach)).toBe(true);
    });

    it('does not see the block when only the coach wrote', async () => {
      const coach = await createUser(UserRoles.COACH);
      const candidate = await createUser(UserRoles.CANDIDATE);
      const conversation = await createConversation([coach, candidate]);
      await messagingHelper.createMessage(conversation.id, coach.user.id);

      expect(await getVisible(coach)).toBe(false);
    });

    it('does not see the block without any conversation', async () => {
      expect(await getVisible(await createUser(UserRoles.COACH))).toBe(false);
    });

    it('does not count a group conversation', async () => {
      const coach = await createUser(UserRoles.COACH);
      const candidate = await createUser(UserRoles.CANDIDATE);
      const conversation = await createConversation(
        [coach, candidate],
        ConversationType.GROUP
      );
      await messagingHelper.createMessage(conversation.id, candidate.user.id);
      await messagingHelper.createMessage(conversation.id, coach.user.id);

      expect(await getVisible(coach)).toBe(false);
    });

    it('does not count a conversation with an admin', async () => {
      const coach = await createUser(UserRoles.COACH);
      const candidate = await createUser(UserRoles.CANDIDATE);
      const admin = await createUser(UserRoles.ADMIN);
      const conversation = await createConversation([coach, candidate, admin]);
      await messagingHelper.createMessage(conversation.id, candidate.user.id);
      await messagingHelper.createMessage(conversation.id, coach.user.id);

      expect(await getVisible(coach)).toBe(false);
    });

    it('does not see the block while the onboarding is not completed', async () => {
      const coach = await usersHelper.createLoggedInUser({
        role: UserRoles.COACH,
        onboardingStatus: OnboardingStatus.IN_PROGRESS,
      });
      const candidate = await createUser(UserRoles.CANDIDATE);
      const conversation = await createConversation([coach, candidate]);
      await messagingHelper.createMessage(conversation.id, candidate.user.id);
      await messagingHelper.createMessage(conversation.id, coach.user.id);

      expect(await getVisible(coach)).toBe(false);
    });
  });

  describe('candidate', () => {
    it.each([
      ['the coach wrote first', true],
      ['the coach replied', false],
    ])('sees the block when %s', async (_label, coachWritesFirst) => {
      const candidate = await createUser(UserRoles.CANDIDATE);
      const coach = await createUser(UserRoles.COACH);
      const conversation = await createConversation([candidate, coach]);
      if (coachWritesFirst) {
        await messagingHelper.createMessage(conversation.id, coach.user.id);
      } else {
        await messagingHelper.createMessage(conversation.id, candidate.user.id);
        await messagingHelper.createMessage(conversation.id, coach.user.id);
      }

      expect(await getVisible(candidate)).toBe(true);
    });

    it('does not see the block when only the candidate wrote', async () => {
      const candidate = await createUser(UserRoles.CANDIDATE);
      const coach = await createUser(UserRoles.COACH);
      const conversation = await createConversation([candidate, coach]);
      await messagingHelper.createMessage(conversation.id, candidate.user.id);

      expect(await getVisible(candidate)).toBe(false);
    });

    it('does not count a message from a non-coach or from a group', async () => {
      const candidate = await createUser(UserRoles.CANDIDATE);
      const otherCandidate = await createUser(UserRoles.CANDIDATE);
      const coach = await createUser(UserRoles.COACH);
      const withCandidate = await createConversation([
        candidate,
        otherCandidate,
      ]);
      await messagingHelper.createMessage(
        withCandidate.id,
        otherCandidate.user.id
      );
      const group = await createConversation(
        [candidate, coach],
        ConversationType.GROUP
      );
      await messagingHelper.createMessage(group.id, coach.user.id);

      expect(await getVisible(candidate)).toBe(false);
    });

    it('does not count a conversation with an admin', async () => {
      const candidate = await createUser(UserRoles.CANDIDATE);
      const coach = await createUser(UserRoles.COACH);
      const admin = await createUser(UserRoles.ADMIN);
      const conversation = await createConversation([candidate, coach, admin]);
      await messagingHelper.createMessage(conversation.id, coach.user.id);

      expect(await getVisible(candidate)).toBe(false);
    });

    it('does not see the block while the onboarding is not completed', async () => {
      const candidate = await usersHelper.createLoggedInUser({
        role: UserRoles.CANDIDATE,
        onboardingStatus: OnboardingStatus.NOT_STARTED,
      });
      const coach = await createUser(UserRoles.COACH);
      const conversation = await createConversation([candidate, coach]);
      await messagingHelper.createMessage(conversation.id, coach.user.id);

      expect(await getVisible(candidate)).toBe(false);
    });
  });

  describe('referer, company admin and platform admin', () => {
    it('shows the block to a referer without any condition', async () => {
      expect(await getVisible(await createUser(UserRoles.REFERER))).toBe(true);
    });

    it('shows the block to a coach who administers a company, without any exchange', async () => {
      const coach = await createUser(UserRoles.COACH);
      const company = await companyFactory.create({});
      await companiesHelper.linkCompanyToUser({
        userId: coach.user.id,
        companyId: company.id,
        role: CompanyUserRole.EXECUTIVE,
        isAdmin: true,
      });

      expect(await getVisible(coach)).toBe(true);
    });

    it('does not show the block to a coach who is only a company member', async () => {
      const coach = await createUser(UserRoles.COACH);
      const company = await companyFactory.create({});
      await companiesHelper.linkCompanyToUser({
        userId: coach.user.id,
        companyId: company.id,
        role: CompanyUserRole.EMPLOYEE,
        isAdmin: false,
      });

      expect(await getVisible(coach)).toBe(false);
    });

    it('never shows the block to the platform admin', async () => {
      expect(await getVisible(await createUser(UserRoles.ADMIN))).toBe(false);
    });
  });

  describe('POST /current/donation-block/dismiss', () => {
    it('hides the block for good and is idempotent', async () => {
      const referer = await createUser(UserRoles.REFERER);
      expect(await getVisible(referer)).toBe(true);

      const first = await request(server)
        .post(`${route}/dismiss`)
        .set('authorization', `Bearer ${referer.token}`);
      expect(first.status).toBe(204);
      const { donationBlockDismissedAt } = await userModel.findByPk(
        referer.user.id
      );
      expect(donationBlockDismissedAt).toBeInstanceOf(Date);
      expect(await getVisible(referer)).toBe(false);

      const second = await request(server)
        .post(`${route}/dismiss`)
        .set('authorization', `Bearer ${referer.token}`);
      expect(second.status).toBe(204);
      const after = await userModel.findByPk(referer.user.id);
      expect(after.donationBlockDismissedAt).toEqual(donationBlockDismissedAt);
    });

    it('hides the block even when the exchange conditions are met', async () => {
      const coach = await createUser(UserRoles.COACH);
      const candidate = await createUser(UserRoles.CANDIDATE);
      const conversation = await createConversation([coach, candidate]);
      await messagingHelper.createMessage(conversation.id, candidate.user.id);
      await messagingHelper.createMessage(conversation.id, coach.user.id);
      expect(await getVisible(coach)).toBe(true);

      await request(server)
        .post(`${route}/dismiss`)
        .set('authorization', `Bearer ${coach.token}`)
        .expect(204);

      expect(await getVisible(coach)).toBe(false);
    });

    it('only affects the account that dismissed the block', async () => {
      const referer = await createUser(UserRoles.REFERER);
      const otherReferer = await createUser(UserRoles.REFERER);

      await request(server)
        .post(`${route}/dismiss`)
        .set('authorization', `Bearer ${referer.token}`)
        .expect(204);

      expect(await getVisible(otherReferer)).toBe(true);
    });

    it('logs the dismissal with the role only, once', async () => {
      const referer = await createUser(UserRoles.REFERER);
      const logSpy = jest.spyOn(Logger.prototype, 'log');

      for (let i = 0; i < 2; i++) {
        await request(server)
          .post(`${route}/dismiss`)
          .set('authorization', `Bearer ${referer.token}`)
          .expect(204);
      }

      const dismissalLogs = logSpy.mock.calls
        .map(([message]) => String(message))
        .filter((message) => message.includes('donation_block_dismissed'));
      expect(dismissalLogs).toEqual([
        `donation_block_dismissed role=${UserRoles.REFERER}`,
      ]);
      expect(dismissalLogs[0]).not.toContain(referer.user.id);
      logSpy.mockRestore();
    });
  });
});
