import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { CustomTestingModule } from 'test/custom-testing.module';
import { DatabaseHelper } from 'test/database.helper';
import { UserFactory } from 'test/users/user.factory';
import { UserHelper } from 'test/users/user.helper';
import { AuthController } from 'src/auth/auth.controller';
import { getPartialUserForPayload, PayloadUser } from 'src/auth/auth.service';
import { User, UserRoles } from 'src/users/models/user.model';
import { APIResponse } from 'src/utils/types/utils';
import { AuthHelper } from './auth.helper';

describe('Auth', () => {
  let app: INestApplication;

  let databaseHelper: DatabaseHelper;
  let authHelper: AuthHelper;
  let userFactory: UserFactory;
  let userHelper: UserHelper;

  const route = '/auth';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [CustomTestingModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    databaseHelper = moduleFixture.get<DatabaseHelper>(DatabaseHelper);
    authHelper = moduleFixture.get<AuthHelper>(AuthHelper);
    userHelper = moduleFixture.get<UserHelper>(UserHelper);
    userFactory = moduleFixture.get<UserFactory>(UserFactory);
  });

  afterAll(async () => {
    await app.close();
  });

  let candidat: User;
  let candidatResponse: PayloadUser;
  let loggedInCandidat: {
    user: User;
    token: string;
  };
  let unknownUser: User;
  const invalidToken =
    // eslint-disable-next-line max-len
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImxheW5lX2JhaHJpbmdlckBob3RtYWlsLmNvbSIsImlkIjoiMWM0NzI0MzEtZTg4NS00MGVhLWI0MWEtMjA1M2RlODJhZDJlIiwiZmlyc3ROYW1lIjoiT2N0YXZpYSIsImxhc3ROYW1lIjoiWXVuZHQiLCJwaG9uZSI6IjI2Mi0wMzItOTY2NCB4NzY5NCIsImdlbmRlciI6MCwicm9sZSI6IkNhbmRpZGF0IiwiZXhwIjoxNjAzNDM3OTE4LCJjYW5kaWRhdElkIjpudWxsLCJjb2FjaElkIjpudWxsLCJpYXQiOjE1OTgyNTM5MTh9.TrUmF20O7TJR2NwqjyyJJvEoBjs59Q3ClqX6PEHUsOw';

  beforeEach(async () => {
    await databaseHelper.resetTestDB();

    candidat = await userFactory.create({
      role: UserRoles.CANDIDAT,
      password: 'candidat',
    });

    candidatResponse = getPartialUserForPayload(candidat);

    loggedInCandidat = await userHelper.createLoggedInUser({
      role: UserRoles.CANDIDAT,
      password: 'loggedInCandidat',
    });

    unknownUser = await userFactory.create(
      {
        role: UserRoles.CANDIDAT,
        password: 'unknownUser',
      },
      {},
      false
    );
  });

  describe('Login - login/', () => {
    it("Should return 201 and user's info with token, if valid email and password", async () => {
      const response: APIResponse<AuthController['login']> = await request(
        app.getHttpServer()
      )
        .post(`${route}/login`)
        .send({
          email: candidat.email,
          password: 'candidat',
        });
      expect(response.status).toBe(201);
      expect(response.body.user).toMatchObject(candidatResponse);
      expect(response.body.token).toBeTruthy();
    });
    it('Should return 401, if invalid email', async () => {
      const response: APIResponse<AuthController['login']> = await request(
        app.getHttpServer()
      )
        .post(`${route}/login`)
        .send({
          email: 'invalidEmail',
          password: 'candidat',
        });
      expect(response.status).toBe(401);
    });
    it('Should return 401, if invalid password', async () => {
      const response: APIResponse<AuthController['login']> = await request(
        app.getHttpServer()
      )
        .post(`${route}/login`)
        .send({
          email: candidat.email,
          password: 'invalidPassword',
        });
      expect(response.status).toBe(401);
    });
    it('Should return 401, if no email', async () => {
      const response: APIResponse<AuthController['login']> = await request(
        app.getHttpServer()
      )
        .post(`${route}/login`)
        .send({
          password: 'candidat',
        });
      expect(response.status).toBe(401);
    });
    it('Should return 401, if no password', async () => {
      const response: APIResponse<AuthController['login']> = await request(
        app.getHttpServer()
      )
        .post(`${route}/login`)
        .send({
          email: candidat.email,
        });
      expect(response.status).toBe(401);
    });
  });
  describe('Logout - logout/', () => {
    it(`Should logout the user`, async () => {
      const response: APIResponse<AuthController['logout']> = await request(
        app.getHttpServer()
      )
        .post(`${route}/logout`)
        .set('authorization', `Token ${loggedInCandidat.token}`);

      expect(response.status).toBe(302);
    });
  });
  describe('Forgot - forgot/', () => {
    it('Should return 400; if no user email provided', async () => {
      const response: APIResponse<AuthController['forgot']> = await request(
        app.getHttpServer()
      ).post(`${route}/forgot`);
      expect(response.status).toBe(400);
    });
    it('Should return 404; if invalid user email provided', async () => {
      const response: APIResponse<AuthController['forgot']> = await request(
        app.getHttpServer()
      )
        .post(`${route}/forgot`)
        .send({
          email: 'invalid@nowhere.nothing',
        });
      expect(response.status).toBe(404);
    });
    it('Should return 201 and send email, if valid user email provided', async () => {
      const response: APIResponse<AuthController['forgot']> = await request(
        app.getHttpServer()
      )
        .post(`${route}/forgot`)
        .send({
          email: candidat.email,
        });
      expect(response.status).toBe(201);
    });
  });
  describe('reset - reset/:userId/:token', () => {
    describe("Verify password's reset link", () => {
      it('Should return 200, if valid link', async () => {
        const reset = await authHelper.getResetLinkAndUser(
          loggedInCandidat.user
        );
        const response: APIResponse<AuthController['checkReset']> =
          await request(app.getHttpServer()).get(`${route}/${reset.link}`);
        expect(response.status).toBe(200);
      });
      it('Should return 401, if invalid id in link', async () => {
        const reset = await authHelper.getResetLinkAndUser(
          loggedInCandidat.user
        );
        const response: APIResponse<AuthController['checkReset']> =
          await request(app.getHttpServer()).get(
            `${route}/reset/${unknownUser.id}/${reset.token}`
          );
        expect(response.status).toBe(401);
      });
      it('Should return 401, if invalid id in link', async () => {
        await authHelper.getResetLinkAndUser(loggedInCandidat.user);
        const response: APIResponse<AuthController['checkReset']> =
          await request(app.getHttpServer()).get(
            `${route}/reset/${loggedInCandidat.user.id}/${invalidToken}`
          );
        expect(response.status).toBe(401);
      });
    });
    describe('Reset password', () => {
      it('Should return 200 and updated user, if valid link', async () => {
        const reset = await authHelper.getResetLinkAndUser(
          loggedInCandidat.user
        );
        const response: APIResponse<AuthController['resetPassword']> =
          await request(app.getHttpServer())
            .post(`${route}/${reset.link}`)
            .send({
              newPassword: 'newPassword',
              confirmPassword: 'newPassword',
            });
        expect(response.status).toBe(201);
        expect(response.body.id).toBe(loggedInCandidat.user.id);
      });
      it('Should return 400, if not matching passwords', async () => {
        const reset = await authHelper.getResetLinkAndUser(
          loggedInCandidat.user
        );
        const response: APIResponse<AuthController['resetPassword']> =
          await request(app.getHttpServer())
            .post(`${route}/${reset.link}`)
            .send({
              newPassword: 'newPassword',
              confirmPassword: 'Password',
            });

        expect(response.status).toBe(400);
      });
      it('Should return 401, if invalid user id', async () => {
        const reset = await authHelper.getResetLinkAndUser(
          loggedInCandidat.user
        );
        const response: APIResponse<AuthController['resetPassword']> =
          await request(app.getHttpServer())
            .post(`${route}/reset/${unknownUser.id}/${reset.token}`)
            .send({
              newPassword: 'newPassword',
              confirmPassword: 'newPassword',
            });
        expect(response.status).toBe(401);
      });
      it('Should return 401 if invalid user token', async () => {
        await authHelper.getResetLinkAndUser(loggedInCandidat.user);
        const response: APIResponse<AuthController['resetPassword']> =
          await request(app.getHttpServer())
            .post(`${route}/reset/${loggedInCandidat.user.id}/${invalidToken}`)
            .send({
              newPassword: 'newPassword',
              confirmPassword: 'newPassword',
            });
        expect(response.status).toBe(401);
      });
    });
  });
  describe('Current - /current', () => {
    it('Should return a user with token if valid token provided', async () => {
      const response: APIResponse<AuthController['getCurrent']> = await request(
        app.getHttpServer()
      )
        .get(`${route}/current`)
        .set('authorization', `Token ${loggedInCandidat.token}`);
      expect(response.status).toBe(200);
      expect(response.body.id).toBe(loggedInCandidat.user.id);
    });
    it('Should return 401, if invalid token', async () => {
      const response: APIResponse<AuthController['getCurrent']> = await request(
        app.getHttpServer()
      )
        .get(`${route}/current`)
        .set('authorization', `Token ${invalidToken}`);
      expect(response.status).toBe(401);
    });
  });
});
