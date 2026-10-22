import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/sequelize';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { LoggedInUser, UsersHelper } from '../users/users.helper';
import { ExternalDatabasesService } from 'src/external-databases/external-databases.service';
import { QueuesService } from 'src/queues/producers/queues.service';
import { UserSocialSituation } from 'src/user-social-situations/models';
import { UserRoles } from 'src/users/users.types';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import { QueuesServiceMock } from 'tests/queues/queues.service.mock';

describe('UserSocialSituations', () => {
  let app: INestApplication;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let server: any;
  let databaseHelper: DatabaseHelper;
  let usersHelper: UsersHelper;
  let socialSituationModel: typeof UserSocialSituation;
  let externalDatabasesService: ExternalDatabasesService;

  let candidate: LoggedInUser;
  let otherCandidate: LoggedInUser;
  let coach: LoggedInUser;
  let referer: LoggedInUser;
  let admin: LoggedInUser;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [CustomTestingModule],
    })
      .overrideProvider(QueuesService)
      .useClass(QueuesServiceMock)
      .compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    server = app.getHttpServer();
    databaseHelper = moduleFixture.get(DatabaseHelper);
    usersHelper = moduleFixture.get(UsersHelper);
    socialSituationModel = app.get(getModelToken(UserSocialSituation));
    externalDatabasesService = app.get(ExternalDatabasesService);
  });

  afterAll(async () => {
    await databaseHelper.resetTestDB();
    await app.close();
    server.close();
  });

  beforeEach(async () => {
    candidate = await usersHelper.createLoggedInUser({
      role: UserRoles.CANDIDATE,
    });
    otherCandidate = await usersHelper.createLoggedInUser({
      role: UserRoles.CANDIDATE,
    });
    coach = await usersHelper.createLoggedInUser({ role: UserRoles.COACH });
    referer = await usersHelper.createLoggedInUser({ role: UserRoles.REFERER });
    admin = await usersHelper.createLoggedInUser({ role: UserRoles.ADMIN });
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await databaseHelper.resetTestDB();
  });

  describe('GET /users/social-situations', () => {
    it('returns 401 for an anonymous user', async () => {
      const response = await request(server).get('/users/social-situations');
      expect(response.status).toBe(401);
    });

    it('returns 404 when the current user has no social situation yet', async () => {
      await socialSituationModel.destroy({
        where: { userId: coach.user.id },
      });

      const response = await request(server)
        .get('/users/social-situations')
        .set('authorization', `Bearer ${coach.token}`);

      expect(response.status).toBe(404);
    });

    it('returns the social situation of the current user only', async () => {
      await socialSituationModel.upsert({
        userId: candidate.user.id,
        hasCompletedSurvey: true,
      });

      const response = await request(server)
        .get('/users/social-situations')
        .set('authorization', `Bearer ${candidate.token}`);

      expect(response.status).toBe(200);
      expect(response.body.userId).toBe(candidate.user.id);
      expect(response.body.hasCompletedSurvey).toBe(true);
    });
  });

  describe('PUT /users/social-situations/:userId', () => {
    it('returns 401 for an anonymous user', async () => {
      const response = await request(server)
        .put(`/users/social-situations/${candidate.user.id}`)
        .send({ hasCompletedSurvey: true });
      expect(response.status).toBe(401);
    });

    it.each([
      ['coach', () => coach],
      ['referer', () => referer],
      ['admin', () => admin],
    ])('returns 403 for a %s', async (_role, user) => {
      const response = await request(server)
        .put(`/users/social-situations/${user().user.id}`)
        .set('authorization', `Bearer ${user().token}`)
        .send({ hasCompletedSurvey: true });

      expect(response.status).toBe(403);
    });

    it('returns 403 for a candidate updating the situation of another user', async () => {
      const response = await request(server)
        .put(`/users/social-situations/${otherCandidate.user.id}`)
        .set('authorization', `Bearer ${candidate.token}`)
        .send({ hasCompletedSurvey: true });

      expect(response.status).toBe(403);
    });

    it('creates the social situation of a candidate without one', async () => {
      await socialSituationModel.destroy({
        where: { userId: candidate.user.id },
      });
      const externalSpy = jest.spyOn(
        externalDatabasesService,
        'updateExternalDBUserSocialSituation'
      );

      const response = await request(server)
        .put(`/users/social-situations/${candidate.user.id}`)
        .set('authorization', `Bearer ${candidate.token}`)
        .send({ hasCompletedSurvey: true });

      expect(response.status).toBe(200);
      expect(response.body.hasCompletedSurvey).toBe(true);
      expect(externalSpy).not.toHaveBeenCalled();
      expect(
        await socialSituationModel.count({
          where: { userId: candidate.user.id },
        })
      ).toBe(1);
    });

    it('updates the existing situation and forwards the answers to the external database', async () => {
      const externalSpy = jest.spyOn(
        externalDatabasesService,
        'updateExternalDBUserSocialSituation'
      );

      const response = await request(server)
        .put(`/users/social-situations/${candidate.user.id}`)
        .set('authorization', `Bearer ${candidate.token}`)
        .send({ hasCompletedSurvey: true, nationality: 'french' });

      expect(response.status).toBe(200);
      expect(externalSpy).toHaveBeenCalledWith(candidate.user.id, {
        nationality: 'french',
      });
      const stored = await socialSituationModel.findByPk(candidate.user.id);
      expect(stored.hasCompletedSurvey).toBe(true);
    });

    it('returns 400 for an unknown property or a malformed id', async () => {
      const unknownProperty = await request(server)
        .put(`/users/social-situations/${candidate.user.id}`)
        .set('authorization', `Bearer ${candidate.token}`)
        .send({ isAdmin: true });
      expect(unknownProperty.status).toBe(400);

      const wrongType = await request(server)
        .put(`/users/social-situations/${candidate.user.id}`)
        .set('authorization', `Bearer ${candidate.token}`)
        .send({ hasCompletedSurvey: 'yes' });
      expect(wrongType.status).toBe(400);
    });
  });
});
