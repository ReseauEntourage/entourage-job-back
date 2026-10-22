import { Server } from 'http';
import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/sequelize';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { S3Mocks } from '../mocks.types';
import { S3Service } from 'src/external-services/aws/s3.service';
import { MailjetTemplates } from 'src/external-services/mailjet/mailjet.types';
import { SlackService } from 'src/external-services/slack/slack.service';
import { slackChannels } from 'src/external-services/slack/slack.types';
import { AchievementTypes } from 'src/gamification/config/achievements.config';
import { GamificationService } from 'src/gamification/gamification.service';
import { generateAchievementSlackConfig } from 'src/gamification/gamification.utils';
import { UserAchievement } from 'src/gamification/models';
import { QueuesService } from 'src/queues/producers/queues.service';
import { Jobs } from 'src/queues/queues.types';
import { UserRoles } from 'src/users/users.types';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import { ConversationFactory } from 'tests/messaging/conversation.factory';
import { MessagingHelper } from 'tests/messaging/messaging.helper';
import { LoggedInUser, UsersHelper } from 'tests/users/users.helper';

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const UNKNOWN_UUID = '3f1c2a52-2b0c-4a0a-9a2e-0f3c9f7a1b11';

describe('Gamification', () => {
  let app: INestApplication;
  let server: Server;
  let databaseHelper: DatabaseHelper;
  let usersHelper: UsersHelper;
  let conversationFactory: ConversationFactory;
  let messagingHelper: MessagingHelper;
  let gamificationService: GamificationService;
  let slackService: SlackService;
  let achievementModel: typeof UserAchievement;

  const queuesService = {
    addToWorkQueue: jest.fn(),
    addToProfileGenerationQueue: jest.fn(),
    addToCronTasksQueue: jest.fn(),
    addToEmbeddingQueue: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [CustomTestingModule],
    })
      .overrideProvider(QueuesService)
      .useValue(queuesService)
      .overrideProvider(S3Service)
      .useValue(S3Mocks)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    server = app.getHttpServer();

    databaseHelper = moduleFixture.get(DatabaseHelper);
    usersHelper = moduleFixture.get(UsersHelper);
    conversationFactory = moduleFixture.get(ConversationFactory);
    messagingHelper = moduleFixture.get(MessagingHelper);
    gamificationService = moduleFixture.get(GamificationService);
    slackService = moduleFixture.get(SlackService);
    achievementModel = moduleFixture.get(getModelToken(UserAchievement));
  });

  afterAll(async () => {
    await databaseHelper.resetTestDB();
    await app.close();
    server.close();
  });

  beforeEach(async () => {
    await databaseHelper.resetTestDB();
    queuesService.addToWorkQueue.mockReset();
    queuesService.addToWorkQueue.mockResolvedValue({ id: 'job-1' });
    jest.spyOn(slackService, 'sendMessage').mockResolvedValue(undefined);
    jest
      .spyOn(slackService, 'sendTechnicalMonitoringMessage')
      .mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  /**
   * A conversation where the other participant wrote first. The coach answers
   * unless `answered` is false.
   */
  const addConversation = async (coachId: string, answered: boolean) => {
    const candidate = await usersHelper.createLoggedInUser({
      role: UserRoles.CANDIDATE,
    });
    const conversation = await conversationFactory.create();
    await messagingHelper.associationParticipantsToConversation(
      conversation.id,
      [coachId, candidate.user.id]
    );
    await messagingHelper.createMessage(conversation.id, candidate.user.id, {
      createdAt: new Date(Date.now() - 2 * DAY_IN_MS),
    });
    if (answered) {
      await messagingHelper.createMessage(conversation.id, coachId, {
        createdAt: new Date(Date.now() - DAY_IN_MS),
      });
    }
  };

  const createEngagedCoach = async () => {
    const coach = await usersHelper.createLoggedInUser({
      role: UserRoles.COACH,
    });
    for (let i = 0; i < 3; i++) {
      await addConversation(coach.user.id, true);
    }
    return coach;
  };

  const createAchievement = (
    userId: string,
    props: Partial<UserAchievement> = {}
  ) =>
    achievementModel.create({
      userId,
      achievementType: AchievementTypes.SUPER_ENGAGED_COACH,
      expireAt: new Date(Date.now() + 100 * DAY_IN_MS),
      active: true,
      ...props,
    });

  const sentMailTemplates = () =>
    queuesService.addToWorkQueue.mock.calls
      .filter(([job]) => job === Jobs.SEND_MAIL)
      .map(([, mail]) => mail.templateId);

  describe('GET /gamification/achievements/:achievementId/public', () => {
    const route = (id: string) => `/gamification/achievements/${id}/public`;

    it('returns the certificate data without authentication', async () => {
      const coach = await usersHelper.createLoggedInUser({
        role: UserRoles.COACH,
        firstName: 'Ada',
        lastName: 'Lovelace',
      });
      const achievement = await createAchievement(coach.user.id);

      const response = await request(server).get(route(achievement.id));

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        firstName: 'Ada',
        lastName: 'Lovelace',
        gender: expect.anything(),
        achievedAt: achievement.createdAt.toISOString(),
        title: 'Super Engagé',
        achievementType: AchievementTypes.SUPER_ENGAGED_COACH,
      });
    });

    it('still returns the certificate of a badge that has expired since', async () => {
      const coach = await usersHelper.createLoggedInUser({
        role: UserRoles.COACH,
      });
      const achievement = await createAchievement(coach.user.id, {
        active: false,
        expireAt: new Date(Date.now() - DAY_IN_MS),
      });

      const response = await request(server).get(route(achievement.id));

      expect(response.status).toBe(200);
    });

    it('returns 404 for an unknown achievement', async () => {
      const response = await request(server).get(route(UNKNOWN_UUID));

      expect(response.status).toBe(404);
    });

    it('returns 400 when the identifier is not a UUID', async () => {
      const response = await request(server).get(route('not-a-uuid'));

      expect(response.status).toBe(400);
    });
  });

  describe('GET /gamification/achievement-progression', () => {
    const route = '/gamification/achievement-progression';

    it('returns the progression of a coach towards the Super Engagé badge', async () => {
      const coach = await usersHelper.createLoggedInUser({
        role: UserRoles.COACH,
      });
      await addConversation(coach.user.id, true);
      await addConversation(coach.user.id, false);

      const response = await request(server)
        .get(route)
        .set('authorization', `Bearer ${coach.token}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual([
        {
          type: AchievementTypes.SUPER_ENGAGED_COACH,
          label: 'Super Engagé',
          hasAchievement: false,
          achievedAt: null,
          expireAt: null,
          statsWindowMonths: 6,
          criteria: [
            expect.objectContaining({
              key: 'conversationCount',
              currentValue: 1,
              threshold: 3,
            }),
            expect.objectContaining({
              key: 'responseRate',
              currentValue: 50,
              threshold: 75,
              isPercentage: true,
            }),
          ],
        },
      ]);
    });

    it('flags the badge as owned with its dates once granted', async () => {
      const coach = await usersHelper.createLoggedInUser({
        role: UserRoles.COACH,
      });
      const achievement = await createAchievement(coach.user.id);

      const response = await request(server)
        .get(route)
        .set('authorization', `Bearer ${coach.token}`);

      expect(response.body[0]).toEqual(
        expect.objectContaining({
          hasAchievement: true,
          achievedAt: achievement.createdAt.toISOString(),
          expireAt: achievement.expireAt.toISOString(),
        })
      );
    });

    it.each([UserRoles.CANDIDATE, UserRoles.REFERER, UserRoles.ADMIN])(
      'returns no progression for a %s since the badge is for coaches only',
      async (role) => {
        const user = await usersHelper.createLoggedInUser({ role });

        const response = await request(server)
          .get(route)
          .set('authorization', `Bearer ${user.token}`);

        expect(response.status).toBe(200);
        expect(response.body).toEqual([]);
      }
    );

    it('refuses an anonymous user', async () => {
      const response = await request(server).get(route);

      expect(response.status).toBe(401);
    });
  });

  describe('POST /gamification/backfill-achievements', () => {
    const route = '/gamification/backfill-achievements';

    it('lets an admin start the backfill and answers immediately', async () => {
      const backfill = jest
        .spyOn(gamificationService, 'backfillAchievements')
        .mockResolvedValue(undefined);
      const admin = await usersHelper.createLoggedInUser({
        role: UserRoles.ADMIN,
      });

      const response = await request(server)
        .post(route)
        .set('authorization', `Bearer ${admin.token}`);

      expect(response.status).toBe(202);
      expect(response.body.message).toContain('Backfill started');
      expect(backfill).toHaveBeenCalledTimes(1);
    });

    it('answers 202 even if the background backfill ends up failing', async () => {
      jest
        .spyOn(gamificationService, 'backfillAchievements')
        .mockRejectedValue(new Error('boom'));
      const admin = await usersHelper.createLoggedInUser({
        role: UserRoles.ADMIN,
      });

      const response = await request(server)
        .post(route)
        .set('authorization', `Bearer ${admin.token}`);

      expect(response.status).toBe(202);
    });

    it.each([UserRoles.CANDIDATE, UserRoles.COACH, UserRoles.REFERER])(
      'refuses a %s',
      async (role) => {
        const backfill = jest.spyOn(
          gamificationService,
          'backfillAchievements'
        );
        const user = await usersHelper.createLoggedInUser({ role });

        const response = await request(server)
          .post(route)
          .set('authorization', `Bearer ${user.token}`);

        expect(response.status).toBe(403);
        expect(backfill).not.toHaveBeenCalled();
      }
    );

    it('refuses an anonymous user', async () => {
      const response = await request(server).post(route);

      expect(response.status).toBe(401);
    });
  });

  describe('checkAndGrantAchievements', () => {
    it('grants the Super Engagé badge to a coach who answers and talks with enough candidates', async () => {
      const coach = await createEngagedCoach();

      const result = await gamificationService.checkAndGrantAchievements(
        coach.user.id
      );

      expect(result.grantedTypes).toEqual([
        AchievementTypes.SUPER_ENGAGED_COACH,
      ]);
      const [achievement] = await gamificationService.getUserActiveAchievements(
        coach.user.id
      );
      expect(achievement.achievementType).toBe(
        AchievementTypes.SUPER_ENGAGED_COACH
      );
      const monthsUntilExpiry =
        (achievement.expireAt.getTime() - Date.now()) / (30 * DAY_IN_MS);
      expect(monthsUntilExpiry).toBeGreaterThan(5.5);
      expect(monthsUntilExpiry).toBeLessThan(6.5);
      expect(sentMailTemplates()).toEqual([
        MailjetTemplates.SUPER_ENGAGED_ACHIEVEMENT,
      ]);
      expect(slackService.sendMessage).toHaveBeenCalledWith(
        slackChannels.PRO_FOLLOW_ACHIEVEMENTS,
        expect.anything(),
        expect.stringContaining('Super Engagé')
      );
    });

    it('does not grant the same badge twice', async () => {
      const coach = await createEngagedCoach();
      await gamificationService.checkAndGrantAchievements(coach.user.id);
      queuesService.addToWorkQueue.mockClear();

      const result = await gamificationService.checkAndGrantAchievements(
        coach.user.id
      );

      expect(result.grantedTypes).toEqual([]);
      expect(await achievementModel.count()).toBe(1);
      expect(queuesService.addToWorkQueue).not.toHaveBeenCalled();
    });

    it('does not grant the badge to a coach with fewer than 3 conversations', async () => {
      const coach = await usersHelper.createLoggedInUser({
        role: UserRoles.COACH,
      });
      await addConversation(coach.user.id, true);
      await addConversation(coach.user.id, true);

      const result = await gamificationService.checkAndGrantAchievements(
        coach.user.id
      );

      expect(result.grantedTypes).toEqual([]);
      expect(await achievementModel.count()).toBe(0);
    });

    it('does not grant the badge to a coach whose response rate is below 75%', async () => {
      const coach = await createEngagedCoach();
      await addConversation(coach.user.id, false);
      await addConversation(coach.user.id, false);

      const result = await gamificationService.checkAndGrantAchievements(
        coach.user.id
      );

      expect(result.grantedTypes).toEqual([]);
    });

    it('never grants the coach badge to a candidate', async () => {
      const candidate = await usersHelper.createLoggedInUser({
        role: UserRoles.CANDIDATE,
      });

      const result = await gamificationService.checkAndGrantAchievements(
        candidate.user.id
      );

      expect(result.grantedTypes).toEqual([]);
    });
  });

  describe('hasActiveAchievement', () => {
    it('only considers the active badges', async () => {
      const coach = await usersHelper.createLoggedInUser({
        role: UserRoles.COACH,
      });
      await createAchievement(coach.user.id, { active: false });

      expect(
        await gamificationService.hasActiveAchievement(
          coach.user.id,
          AchievementTypes.SUPER_ENGAGED_COACH
        )
      ).toBe(false);

      await createAchievement(coach.user.id);

      expect(
        await gamificationService.hasActiveAchievement(
          coach.user.id,
          AchievementTypes.SUPER_ENGAGED_COACH
        )
      ).toBe(true);
    });
  });

  describe('processExpiredAchievements', () => {
    const expiredAt = () => new Date(Date.now() - 2 * DAY_IN_MS);

    it('renews the badge of a coach who is still eligible, from the previous expiration date', async () => {
      const coach = await createEngagedCoach();
      const previousExpireAt = expiredAt();
      const achievement = await createAchievement(coach.user.id, {
        expireAt: previousExpireAt,
      });

      const result = await gamificationService.processExpiredAchievements();

      expect(result).toEqual({
        total: 1,
        renewed: 1,
        expired: 0,
        failures: [],
      });
      await achievement.reload();
      const expectedExpireAt = new Date(previousExpireAt);
      expectedExpireAt.setMonth(expectedExpireAt.getMonth() + 6);
      expect(achievement.active).toBe(true);
      expect(achievement.expireAt.getTime()).toBe(expectedExpireAt.getTime());
      expect(sentMailTemplates()).toEqual([
        MailjetTemplates.SUPER_ENGAGED_ACHIEVEMENT,
      ]);
      expect(slackService.sendMessage).toHaveBeenCalledWith(
        slackChannels.PRO_FOLLOW_ACHIEVEMENTS,
        expect.anything(),
        expect.stringContaining('renouvelé')
      );
    });

    it('deactivates the badge of a coach who is no longer eligible and tells them', async () => {
      const coach = await usersHelper.createLoggedInUser({
        role: UserRoles.COACH,
      });
      const achievement = await createAchievement(coach.user.id, {
        expireAt: expiredAt(),
      });

      const result = await gamificationService.processExpiredAchievements();

      expect(result).toEqual({
        total: 1,
        renewed: 0,
        expired: 1,
        failures: [],
      });
      await achievement.reload();
      expect(achievement.active).toBe(false);
      expect(sentMailTemplates()).toEqual([
        MailjetTemplates.SUPER_ENGAGED_ACHIEVEMENT_EXPIRED,
      ]);
    });

    it('leaves the badges that have not expired yet and the already inactive ones alone', async () => {
      const coach = await usersHelper.createLoggedInUser({
        role: UserRoles.COACH,
      });
      await createAchievement(coach.user.id, {
        expireAt: new Date(Date.now() + 10 * DAY_IN_MS),
      });
      await createAchievement(coach.user.id, {
        expireAt: expiredAt(),
        active: false,
      });

      const result = await gamificationService.processExpiredAchievements();

      expect(result.total).toBe(0);
      expect(queuesService.addToWorkQueue).not.toHaveBeenCalled();
    });

    it('reports the badges it could not process without blocking the other ones', async () => {
      const failingCoach = await createEngagedCoach();
      const okCoach = await usersHelper.createLoggedInUser({
        role: UserRoles.COACH,
      });
      await createAchievement(failingCoach.user.id, {
        expireAt: expiredAt(),
      });
      await createAchievement(okCoach.user.id, { expireAt: expiredAt() });
      // Renewal mails fail; the expiration mail of the other coach goes through
      queuesService.addToWorkQueue.mockImplementation(async (_job, mail) => {
        if (mail.templateId === MailjetTemplates.SUPER_ENGAGED_ACHIEVEMENT) {
          throw new Error('queue down');
        }
        return { id: 'job-1' };
      });

      const result = await gamificationService.processExpiredAchievements();

      expect(result.total).toBe(2);
      expect(result.expired).toBe(1);
      expect(result.renewed).toBe(0);
      expect(result.failures).toEqual([
        {
          itemId: `${AchievementTypes.SUPER_ENGAGED_COACH}:${failingCoach.user.id}`,
          reason: expect.any(Error),
        },
      ]);
    });
  });

  describe('prepareExpirationReminderMails', () => {
    const inDays = (days: number) => new Date(Date.now() + days * DAY_IN_MS);

    it('mails the coaches whose badge expires in 30 days with their progress', async () => {
      const goalReached = await createEngagedCoach();
      const goalMissed = await usersHelper.createLoggedInUser({
        role: UserRoles.COACH,
      });
      await createAchievement(goalReached.user.id, { expireAt: inDays(30) });
      await createAchievement(goalMissed.user.id, { expireAt: inDays(30) });

      const result = await gamificationService.prepareExpirationReminderMails();

      expect(result).toEqual({ total: 2, sent: 2, failures: [] });
      const mails = queuesService.addToWorkQueue.mock.calls.map(
        ([, mail]) => mail
      );
      expect(mails.map((m) => m.templateId)).toEqual([
        MailjetTemplates.SUPER_ENGAGED_ACHIEVEMENT_REMINDER,
        MailjetTemplates.SUPER_ENGAGED_ACHIEVEMENT_REMINDER,
      ]);
      const reachedMail = mails.find(
        (m) => m.toEmail === goalReached.user.email
      );
      const missedMail = mails.find((m) => m.toEmail === goalMissed.user.email);
      expect(reachedMail.variables).toEqual(
        expect.objectContaining({
          conversationCount: 3,
          responseRate: 100,
          goalAchieved: 'true',
        })
      );
      expect(missedMail.variables).toEqual(
        expect.objectContaining({
          conversationCount: 0,
          responseRate: 0,
          goalAchieved: 'false',
        })
      );
    });

    it('ignores the badges expiring on any other day and the inactive ones', async () => {
      // One coach per badge: a user can only hold one active badge of a type
      const coaches = await Promise.all(
        [1, 2, 3].map(() =>
          usersHelper.createLoggedInUser({ role: UserRoles.COACH })
        )
      );
      await createAchievement(coaches[0].user.id, { expireAt: inDays(29) });
      await createAchievement(coaches[1].user.id, { expireAt: inDays(31) });
      await createAchievement(coaches[2].user.id, {
        expireAt: inDays(30),
        active: false,
      });

      const result = await gamificationService.prepareExpirationReminderMails();

      expect(result).toEqual({ total: 0, sent: 0, failures: [] });
      expect(queuesService.addToWorkQueue).not.toHaveBeenCalled();
    });

    it('reports the reminders that could not be sent', async () => {
      const coach = await usersHelper.createLoggedInUser({
        role: UserRoles.COACH,
      });
      await createAchievement(coach.user.id, { expireAt: inDays(30) });
      queuesService.addToWorkQueue.mockRejectedValue(new Error('queue down'));

      const result = await gamificationService.prepareExpirationReminderMails();

      expect(result.sent).toBe(0);
      expect(result.failures).toEqual([
        {
          itemId: `${AchievementTypes.SUPER_ENGAGED_COACH}:${coach.user.id}`,
          reason: expect.any(Error),
        },
      ]);
    });
  });

  describe('backfillAchievements', () => {
    it('grants the badge to the active coaches who deserve it and reports the result on Slack', async () => {
      const engaged = await createEngagedCoach();
      await usersHelper.createLoggedInUser({ role: UserRoles.COACH });
      // A candidate is never part of the backfill
      await usersHelper.createLoggedInUser({ role: UserRoles.CANDIDATE });

      await gamificationService.backfillAchievements();

      expect(
        await gamificationService.hasActiveAchievement(
          engaged.user.id,
          AchievementTypes.SUPER_ENGAGED_COACH
        )
      ).toBe(true);
      expect(await achievementModel.count()).toBe(1);
      expect(slackService.sendTechnicalMonitoringMessage).toHaveBeenCalledWith(
        true,
        expect.stringContaining('Backfill des badges'),
        [
          expect.objectContaining({ content: '2' }),
          expect.objectContaining({
            title: 'Badges attribués',
            content: '1',
          }),
          expect.objectContaining({ title: 'Non éligibles', content: '1' }),
        ],
        expect.stringContaining(engaged.user.email),
        slackChannels.TECH_PRO_MONITORING
      );
    });

    it('ignores the coaches who have not connected for longer than the lookback window', async () => {
      const dormant: LoggedInUser = await usersHelper.createLoggedInUser({
        role: UserRoles.COACH,
        lastConnection: new Date(Date.now() - 400 * DAY_IN_MS),
      });

      await gamificationService.backfillAchievements();

      expect(slackService.sendTechnicalMonitoringMessage).toHaveBeenCalledWith(
        true,
        expect.any(String),
        [
          expect.objectContaining({ content: '0' }),
          expect.anything(),
          expect.anything(),
        ],
        expect.not.stringContaining(dormant.user.email),
        slackChannels.TECH_PRO_MONITORING
      );
    });

    it('flags the Slack report as failed and lists the coaches whose check failed', async () => {
      const engaged = await createEngagedCoach();
      queuesService.addToWorkQueue.mockRejectedValue(new Error('queue down'));

      await gamificationService.backfillAchievements();

      expect(slackService.sendTechnicalMonitoringMessage).toHaveBeenCalledWith(
        false,
        expect.any(String),
        expect.any(Array),
        expect.stringContaining(engaged.user.id),
        slackChannels.TECH_PRO_MONITORING
      );
    });
  });

  describe('generateAchievementSlackConfig', () => {
    const user = {
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.org',
    };
    const expireAt = new Date('2030-06-15T12:00:00Z');

    it('announces a newly granted badge', () => {
      const config = generateAchievementSlackConfig(
        user,
        { label: 'Super Engagé' },
        expireAt,
        'granted'
      );

      expect(config.title).toContain('Nouveau badge décerné');
      expect(config.context).toEqual(
        expect.arrayContaining([
          { title: 'Pour', content: 'Ada Lovelace — ada@example.org' },
          { title: 'Badge', content: 'Super Engagé' },
        ])
      );
      expect(JSON.stringify(config.msgParts)).toContain("vient d'obtenir");
    });

    it('announces a renewed badge', () => {
      const config = generateAchievementSlackConfig(
        user,
        { label: 'Super Engagé' },
        expireAt,
        'renewed'
      );

      expect(config.title).toContain('Badge renouvelé');
      expect(JSON.stringify(config.msgParts)).toContain('a conservé');
    });
  });
});
