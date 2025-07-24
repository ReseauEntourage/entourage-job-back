import { getQueueToken } from '@nestjs/bull';
import { CACHE_MANAGER, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AuthController } from 'src/auth/auth.controller';
import { generateCurrentUserDto } from 'src/auth/dto/current-user.dto';
import { Queues } from 'src/queues/queues.types';
import { User } from 'src/users/models';
import { UserRoles } from 'src/users/users.types';
import { APIResponse } from 'src/utils/types';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import { CacheMocks, QueueMocks } from 'tests/mocks.types';
import { UserProfilesHelper } from 'tests/user-profiles/user-profiles.helper';
import { UserFactory } from 'tests/users/user.factory';
import { UsersHelper } from 'tests/users/users.helper';
import { AuthHelper } from './auth.helper';

describe('Auth', () => {
  let app: INestApplication;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let server: any;

  let databaseHelper: DatabaseHelper;
  let authHelper: AuthHelper;
  let userFactory: UserFactory;
  let usersHelper: UsersHelper;
  let userProfilesHelper: UserProfilesHelper;

  const route = '/auth';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [CustomTestingModule],
    })
      .overrideProvider(getQueueToken(Queues.WORK))
      .useValue(QueueMocks)
      .overrideProvider(CACHE_MANAGER)
      .useValue(CacheMocks)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    server = app.getHttpServer();

    databaseHelper = moduleFixture.get<DatabaseHelper>(DatabaseHelper);
    authHelper = moduleFixture.get<AuthHelper>(AuthHelper);
    usersHelper = moduleFixture.get<UsersHelper>(UsersHelper);
    userFactory = moduleFixture.get<UserFactory>(UserFactory);
    userProfilesHelper =
      moduleFixture.get<UserProfilesHelper>(UserProfilesHelper);
  });

  afterAll(async () => {
    await databaseHelper.resetTestDB();
    await app.close();
    server.close();
  });

  beforeEach(async () => {
    await databaseHelper.resetTestDB();
  });

  const invalidToken =
    // eslint-disable-next-line max-len
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImxheW5lX2JhaHJpbmdlckBob3RtYWlsLmNvbSIsImlkIjoiMWM0NzI0MzEtZTg4NS00MGVhLWI0MWEtMjA1M2RlODJhZDJlIiwiZmlyc3ROYW1lIjoiT2N0YXZpYSIsImxhc3ROYW1lIjoiWXVuZHQiLCJwaG9uZSI6IjI2Mi0wMzItOTY2NCB4NzY5NCIsImdlbmRlciI6MCwicm9sZSI6IkNhbmRpZGF0IiwiZXhwIjoxNjAzNDM3OTE4LCJjYW5kaWRhdElkIjpudWxsLCJjb2FjaElkIjpudWxsLCJpYXQiOjE1OTgyNTM5MTh9.TrUmF20O7TJR2NwqjyyJJvEoBjs59Q3ClqX6PEHUsOw';

  describe('/login - Login', () => {
    let candidate: User;
    const password = 'Candidat123!';
    beforeEach(async () => {
      candidate = await userFactory.create({
        role: UserRoles.CANDIDATE,
        password: password,
      });
    });

    it("Should return 201 and user's info with token, if valid email and password", async () => {
      const response: APIResponse<AuthController['login']> = await request(
        server
      )
        .post(`${route}/login`)
        .send({
          email: candidate.email,
          password,
        });
      expect(response.status).toBe(201);
      expect(response.body.user).toStrictEqual({
        ...candidate,
        lastConnection: response.body.user.lastConnection,
        createdAt: response.body.user.createdAt,
      });
      expect(response.body.token).toBeTruthy();
    });
    it('Should return 400, if invalid email', async () => {
      const response: APIResponse<AuthController['login']> = await request(
        server
      )
        .post(`${route}/login`)
        .send({
          email: 'invalidEmail',
          password: 'candidate',
        });
      expect(response.status).toBe(400);
    });
    it('Should return 401, if invalid password', async () => {
      const response: APIResponse<AuthController['login']> = await request(
        server
      )
        .post(`${route}/login`)
        .send({
          email: candidate.email,
          password: 'invalidPassword',
        });
      expect(response.status).toBe(401);
    });
    it('Should return 401, if no email', async () => {
      const response: APIResponse<AuthController['login']> = await request(
        server
      )
        .post(`${route}/login`)
        .send({
          password: 'candidate',
        });
      expect(response.status).toBe(401);
    });
    it('Should return 401, if no password', async () => {
      const response: APIResponse<AuthController['login']> = await request(
        server
      )
        .post(`${route}/login`)
        .send({
          email: candidate.email,
        });
      expect(response.status).toBe(401);
    });
    it('Should return 401, if user is deleted', async () => {
      await userFactory.delete(candidate.id);
      const response: APIResponse<AuthController['login']> = await request(
        app.getHttpServer()
      )
        .post(`${route}/login`)
        .send({
          email: candidate.email,
          password,
        });
      expect(response.status).toBe(401);
    });
  });
  describe('/logout - Logout', () => {
    it(`Should logout the user`, async () => {
      const loggedInCandidat = await usersHelper.createLoggedInUser({
        role: UserRoles.CANDIDATE,
        password: 'loggedInCandidat',
      });

      const response: APIResponse<AuthController['logout']> = await request(
        server
      )
        .post(`${route}/logout`)
        .set('authorization', `Bearer ${loggedInCandidat.token}`);

      expect(response.status).toBe(302);
    });
  });
  describe('/forgot - Forgot', () => {
    it('Should return 400; if no user email provided', async () => {
      const response: APIResponse<AuthController['forgot']> = await request(
        server
      ).post(`${route}/forgot`);
      expect(response.status).toBe(400);
    });
    it('Should return 404; if invalid user email provided', async () => {
      const response: APIResponse<AuthController['forgot']> = await request(
        server
      )
        .post(`${route}/forgot`)
        .send({
          email: 'invalid@nowhere.nothing',
        });
      expect(response.status).toBe(404);
    });
    it('Should return 201 and send email, if valid user email provided', async () => {
      const candidate = await userFactory.create({
        role: UserRoles.CANDIDATE,
      });

      const response: APIResponse<AuthController['forgot']> = await request(
        server
      )
        .post(`${route}/forgot`)
        .send({
          email: candidate.email,
        });
      expect(response.status).toBe(201);
    });
  });
  describe('/reset/:userId/:token - Reset', () => {
    describe("Verify password's reset link", () => {
      let candidate: User;
      beforeEach(async () => {
        candidate = await userFactory.create({
          role: UserRoles.CANDIDATE,
        });
      });

      it('Should return 200, if valid link', async () => {
        const token = await authHelper.getResetToken(candidate.id);
        const response: APIResponse<AuthController['checkReset']> =
          await request(server).get(`${route}/reset/${candidate.id}/${token}`);
        expect(response.status).toBe(200);
      });
      it('Should return 400, if invalid user id', async () => {
        const invalidUserId = '1111-invalid-99999';
        const token = await authHelper.getResetToken(candidate.id);
        const response: APIResponse<AuthController['checkReset']> =
          await request(server).get(`${route}/reset/${invalidUserId}/${token}`);
        expect(response.status).toBe(400);
      });
      it('Should return 401 if invalid user token', async () => {
        await authHelper.getResetToken(candidate.id);
        const response: APIResponse<AuthController['checkReset']> =
          await request(server).get(
            `${route}/reset/${candidate.id}/${invalidToken}`
          );
        expect(response.status).toBe(401);
      });
    });
    describe('Reset password', () => {
      let candidate: User;
      beforeEach(async () => {
        candidate = await userFactory.create({
          role: UserRoles.CANDIDATE,
        });
      });

      it('Should return 200 and updated user, if valid link', async () => {
        const token = await authHelper.getResetToken(candidate.id);
        const response: APIResponse<AuthController['resetPassword']> =
          await request(server)
            .post(`${route}/reset/${candidate.id}/${token}`)
            .send({
              newPassword: 'newPassword123!',
              confirmPassword: 'newPassword123!',
            });
        expect(response.status).toBe(201);
        expect(response.body).toStrictEqual({
          ...candidate,
          candidat: {
            ...candidate.candidat,
            note: null,
          },
          organization: null,
          lastConnection: response.body.lastConnection,
          createdAt: response.body.createdAt,
        });
      });
      it('Should return 400, if not matching passwords', async () => {
        const token = await authHelper.getResetToken(candidate.id);
        const response: APIResponse<AuthController['resetPassword']> =
          await request(server)
            .post(`${route}/reset/${candidate.id}/${token}`)
            .send({
              newPassword: 'newPassword123!',
              confirmPassword: 'Password123!',
            });

        expect(response.status).toBe(400);
      });
      it("Should return 400, if password doesn't contain uppercase and lowercase letters, numbers & special characters password", async () => {
        const token = await authHelper.getResetToken(candidate.id);
        const response: APIResponse<AuthController['resetPassword']> =
          await request(server)
            .post(`${route}/reset/${candidate.id}/${token}`)
            .send({
              newPassword: 'newPassword',
              confirmPassword: 'newPassword',
            });

        expect(response.status).toBe(400);
      });
      it('Should return 400, if invalid user id', async () => {
        const invalidUserId = '1111-invalid-99999';

        const token = await authHelper.getResetToken(candidate.id);
        const response: APIResponse<AuthController['resetPassword']> =
          await request(server)
            .post(`${route}/reset/${invalidUserId}/${token}`)
            .send({
              newPassword: 'newPassword123!',
              confirmPassword: 'newPassword123!',
            });
        expect(response.status).toBe(400);
      });
      it('Should return 401 if invalid user token', async () => {
        await authHelper.getResetToken(candidate.id);
        const response: APIResponse<AuthController['resetPassword']> =
          await request(server)
            .post(`${route}/reset/${candidate.id}/${invalidToken}`)
            .send({
              newPassword: 'newPassword123!',
              confirmPassword: 'newPassword123!',
            });
        expect(response.status).toBe(401);
      });
    });
  });
  describe('/current - Current', () => {
    it('Should return a user with token if valid token provided', async () => {
      const loggedInCandidat = await usersHelper.createLoggedInUser({
        role: UserRoles.CANDIDATE,
        password: 'loggedInCandidat',
      });
      const loggedInCandidatProfile =
        await userProfilesHelper.findOneProfileByUserId(
          loggedInCandidat.user.id,
          false
        );

      const response: APIResponse<AuthController['getCurrent']> = await request(
        server
      )
        .get(`${route}/current`)
        .set('authorization', `Bearer ${loggedInCandidat.token}`);
      expect(response.status).toBe(200);
      expect(response.body).toStrictEqual({
        ...generateCurrentUserDto(
          loggedInCandidat.user,
          loggedInCandidatProfile
        ),
        lastConnection: response.body.lastConnection,
      });
    });
    it('Should return 401, if invalid token', async () => {
      const response: APIResponse<AuthController['getCurrent']> = await request(
        server
      )
        .get(`${route}/current`)
        .set('authorization', `Bearer ${invalidToken}`);
      expect(response.status).toBe(401);
    });
    it('Should return 401, if deleted user', async () => {
      const loggedInCandidat = await usersHelper.createLoggedInUser({
        role: UserRoles.CANDIDATE,
        password: 'loggedInCandidat',
      });
      await userFactory.delete(loggedInCandidat.user.id);
      const response: APIResponse<AuthController['getCurrent']> = await request(
        server
      )
        .get(`${route}/current`)
        .set('authorization', `Bearer ${loggedInCandidat.token}`);
      expect(response.status).toBe(401);
    });
  });
});
