import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { CurrentUserController } from 'src/current-user/current-user.controller';
import { MailsService } from 'src/mails/mails.service';
import { QueuesService } from 'src/queues/producers/queues.service';
import { UserRoles } from 'src/users/users.types';
import { APIResponse } from 'src/utils/types';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import { MailsServiceMock } from 'tests/mails/mails.service.mock';
import { QueuesServiceMock } from 'tests/queues/queues.service.mock';
import { UserFactory } from 'tests/users/user.factory';
import { UsersHelper } from 'tests/users/users.helper';

describe('CurrentUser', () => {
  let app: INestApplication;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let server: any;

  let databaseHelper: DatabaseHelper;
  let userFactory: UserFactory;
  let usersHelper: UsersHelper;

  const route = '/current';

  const invalidToken =
    // eslint-disable-next-line max-len
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImxheW5lX2JhaHJpbmdlckBob3RtYWlsLmNvbSIsImlkIjoiMWM0NzI0MzEtZTg4NS00MGVhLWI0MWEtMjA1M2RlODJhZDJlIiwiZmlyc3ROYW1lIjoiT2N0YXZpYSIsImxhc3ROYW1lIjoiWXVuZHQiLCJwaG9uZSI6IjI2Mi0wMzItOTY2NCB4NzY5NCIsImdlbmRlciI6MCwicm9sZSI6IkNhbmRpZGF0IiwiZXhwIjoxNjAzNDM3OTE4LCJjYW5kaWRhdElkIjpudWxsLCJjb2FjaElkIjpudWxsLCJpYXQiOjE1OTgyNTM5MTh9.TrUmF20O7TJR2NwqjyyJJvEoBjs59Q3ClqX6PEHUsOw';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [CustomTestingModule],
    })
      .overrideProvider(QueuesService)
      .useValue(QueuesServiceMock)
      .overrideProvider(MailsService)
      .useClass(MailsServiceMock)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    server = app.getHttpServer();

    databaseHelper = moduleFixture.get<DatabaseHelper>(DatabaseHelper);
    usersHelper = moduleFixture.get<UsersHelper>(UsersHelper);
    userFactory = moduleFixture.get<UserFactory>(UserFactory);
  });

  afterAll(async () => {
    await databaseHelper.resetTestDB();
    await app.close();
    server.close();
  });

  beforeEach(async () => {
    await databaseHelper.resetTestDB();
  });

  describe('GET /current — Identity', () => {
    it('Should return 200 with identity fields only (no userProfile nesting)', async () => {
      const loggedInUser = await usersHelper.createLoggedInUser({
        role: UserRoles.CANDIDATE,
      });
      const response: APIResponse<CurrentUserController['getIdentity']> =
        await request(server)
          .get(route)
          .set('authorization', `Bearer ${loggedInUser.token}`);
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: loggedInUser.user.id,
        firstName: loggedInUser.user.firstName,
        lastName: loggedInUser.user.lastName,
        email: loggedInUser.user.email,
        role: loggedInUser.user.role,
      });
      expect(response.body).not.toHaveProperty('userProfile');
      expect(response.body).not.toHaveProperty('company');
      expect(response.body).not.toHaveProperty('achievements');
    });

    it('Should return 401, if invalid token', async () => {
      const response: APIResponse<CurrentUserController['getIdentity']> =
        await request(server)
          .get(route)
          .set('authorization', `Bearer ${invalidToken}`);
      expect(response.status).toBe(401);
    });

    it('Should return 401, if deleted user', async () => {
      const loggedInUser = await usersHelper.createLoggedInUser({
        role: UserRoles.CANDIDATE,
      });
      await userFactory.delete(loggedInUser.user.id);
      const response: APIResponse<CurrentUserController['getIdentity']> =
        await request(server)
          .get(route)
          .set('authorization', `Bearer ${loggedInUser.token}`);
      expect(response.status).toBe(401);
    });
  });

  describe('GET /current/profile', () => {
    it('Should return 200 with basic profile fields only', async () => {
      const loggedInUser = await usersHelper.createLoggedInUser({
        role: UserRoles.CANDIDATE,
      });
      const response: APIResponse<CurrentUserController['getProfile']> =
        await request(server)
          .get(`${route}/profile`)
          .set('authorization', `Bearer ${loggedInUser.token}`);
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: expect.any(String),
        hasPicture: expect.any(Boolean),
        hasExternalCv: expect.any(Boolean),
        isAvailable: expect.any(Boolean),
      });
      expect(response.body).not.toHaveProperty('experiences');
      expect(response.body).not.toHaveProperty('formations');
    });

    it('Should return 401, if invalid token', async () => {
      const response = await request(server)
        .get(`${route}/profile`)
        .set('authorization', `Bearer ${invalidToken}`);
      expect(response.status).toBe(401);
    });
  });

  describe('GET /current/profile/complete', () => {
    it('Should return 200 with complete profile including hasExtractedCvData', async () => {
      const loggedInUser = await usersHelper.createLoggedInUser({
        role: UserRoles.CANDIDATE,
      });
      const response: APIResponse<CurrentUserController['getProfileComplete']> =
        await request(server)
          .get(`${route}/profile/complete`)
          .set('authorization', `Bearer ${loggedInUser.token}`);
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: expect.any(String),
        hasPicture: expect.any(Boolean),
        hasExtractedCvData: expect.any(Boolean),
      });
      expect(response.body.experiences).toBeDefined();
      expect(response.body.formations).toBeDefined();
    });

    it('Should return 401, if invalid token', async () => {
      const response = await request(server)
        .get(`${route}/profile/complete`)
        .set('authorization', `Bearer ${invalidToken}`);
      expect(response.status).toBe(401);
    });
  });

  describe('GET /current/company', () => {
    it('Should return 200 with null for a user without company', async () => {
      const loggedInUser = await usersHelper.createLoggedInUser({
        role: UserRoles.CANDIDATE,
      });
      const response: APIResponse<CurrentUserController['getCompany']> =
        await request(server)
          .get(`${route}/company`)
          .set('authorization', `Bearer ${loggedInUser.token}`);
      expect(response.status).toBe(200);
      expect(response.body).toBeNull();
    });

    it('Should return 401, if invalid token', async () => {
      const response = await request(server)
        .get(`${route}/company`)
        .set('authorization', `Bearer ${invalidToken}`);
      expect(response.status).toBe(401);
    });
  });

  describe('GET /current/organization', () => {
    it('Should return 200 with null for a user without organization', async () => {
      const loggedInUser = await usersHelper.createLoggedInUser({
        role: UserRoles.CANDIDATE,
      });
      const response: APIResponse<CurrentUserController['getOrganization']> =
        await request(server)
          .get(`${route}/organization`)
          .set('authorization', `Bearer ${loggedInUser.token}`);
      expect(response.status).toBe(200);
      expect(response.body).toBeNull();
    });

    it('Should return 401, if invalid token', async () => {
      const response = await request(server)
        .get(`${route}/organization`)
        .set('authorization', `Bearer ${invalidToken}`);
      expect(response.status).toBe(401);
    });
  });

  describe('GET /current/stats', () => {
    it('Should return 200 with stats for a candidate with no conversations', async () => {
      const loggedInUser = await usersHelper.createLoggedInUser({
        role: UserRoles.CANDIDATE,
      });
      const response: APIResponse<CurrentUserController['getStats']> =
        await request(server)
          .get(`${route}/stats`)
          .set('authorization', `Bearer ${loggedInUser.token}`);
      expect(response.status).toBe(200);
      expect(response.body).toEqual(
        expect.objectContaining({
          averageDelayResponse: null,
          responseRate: null,
          totalConversationWithMirrorRoleCount: 0,
        })
      );
    });

    it('Should return 200 with stats for a coach with no conversations', async () => {
      const loggedInUser = await usersHelper.createLoggedInUser({
        role: UserRoles.COACH,
      });
      const response: APIResponse<CurrentUserController['getStats']> =
        await request(server)
          .get(`${route}/stats`)
          .set('authorization', `Bearer ${loggedInUser.token}`);
      expect(response.status).toBe(200);
      expect(response.body).toEqual(
        expect.objectContaining({
          averageDelayResponse: null,
          responseRate: null,
          totalConversationWithMirrorRoleCount: 0,
        })
      );
    });

    it('Should return 401, if invalid token', async () => {
      const response = await request(server)
        .get(`${route}/stats`)
        .set('authorization', `Bearer ${invalidToken}`);
      expect(response.status).toBe(401);
    });
  });

  describe('GET /current/whatsapp-zone', () => {
    it('Should return 200 with name, url, qr fields', async () => {
      const loggedInUser = await usersHelper.createLoggedInUser({
        role: UserRoles.CANDIDATE,
      });
      const response: APIResponse<CurrentUserController['getWhatsappZone']> =
        await request(server)
          .get(`${route}/whatsapp-zone`)
          .set('authorization', `Bearer ${loggedInUser.token}`);
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        name: expect.anything(),
        url: expect.anything(),
        qr: expect.anything(),
      });
    });

    it('Should return 401, if invalid token', async () => {
      const response = await request(server)
        .get(`${route}/whatsapp-zone`)
        .set('authorization', `Bearer ${invalidToken}`);
      expect(response.status).toBe(401);
    });
  });

  describe('GET /current/referred-users', () => {
    it('Should return 200 with empty array for a candidate', async () => {
      const loggedInUser = await usersHelper.createLoggedInUser({
        role: UserRoles.CANDIDATE,
      });
      const response: APIResponse<CurrentUserController['getReferredUsers']> =
        await request(server)
          .get(`${route}/referred-users`)
          .set('authorization', `Bearer ${loggedInUser.token}`);
      expect(response.status).toBe(200);
      expect(response.body.referredCandidates).toEqual([]);
    });

    it('Should return 401, if invalid token', async () => {
      const response = await request(server)
        .get(`${route}/referred-users`)
        .set('authorization', `Bearer ${invalidToken}`);
      expect(response.status).toBe(401);
    });
  });

  describe('GET /current/referrer', () => {
    it('Should return 200 with null referer when no referrer', async () => {
      const loggedInUser = await usersHelper.createLoggedInUser({
        role: UserRoles.CANDIDATE,
      });
      const response: APIResponse<CurrentUserController['getReferrer']> =
        await request(server)
          .get(`${route}/referrer`)
          .set('authorization', `Bearer ${loggedInUser.token}`);
      expect(response.status).toBe(200);
      expect(response.body.referer).toBeNull();
    });

    it('Should return 401, if invalid token', async () => {
      const response = await request(server)
        .get(`${route}/referrer`)
        .set('authorization', `Bearer ${invalidToken}`);
      expect(response.status).toBe(401);
    });
  });

  describe('GET /current/achievements', () => {
    it('Should return 200 with achievements array', async () => {
      const loggedInUser = await usersHelper.createLoggedInUser({
        role: UserRoles.CANDIDATE,
      });
      const response: APIResponse<CurrentUserController['getAchievements']> =
        await request(server)
          .get(`${route}/achievements`)
          .set('authorization', `Bearer ${loggedInUser.token}`);
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.achievements)).toBe(true);
    });

    it('Should return 401, if invalid token', async () => {
      const response = await request(server)
        .get(`${route}/achievements`)
        .set('authorization', `Bearer ${invalidToken}`);
      expect(response.status).toBe(401);
    });
  });

  describe('GET /current/read-documents', () => {
    it('Should return 200 with read documents array', async () => {
      const loggedInUser = await usersHelper.createLoggedInUser({
        role: UserRoles.CANDIDATE,
      });
      const response: APIResponse<CurrentUserController['getReadDocuments']> =
        await request(server)
          .get(`${route}/read-documents`)
          .set('authorization', `Bearer ${loggedInUser.token}`);
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.readDocuments)).toBe(true);
    });

    it('Should return 401, if invalid token', async () => {
      const response = await request(server)
        .get(`${route}/read-documents`)
        .set('authorization', `Bearer ${invalidToken}`);
      expect(response.status).toBe(401);
    });
  });
});
