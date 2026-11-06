import { randomBytes } from 'crypto';
import { Server } from 'http';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import {
  LEGACY_USER_ROUTE_RULES,
  legacyUserRoutesMiddleware,
  rewriteLegacyUserPath,
} from 'src/legacy-user-routes/legacy-user-routes.middleware';
import { QueuesService } from 'src/queues/producers/queues.service';
import { UserRoles } from 'src/users/users.types';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import { LoggedInUser, UsersHelper } from 'tests/users/users.helper';

// Generated at runtime (no hardcoded credential, which secret scanners flag).
const buildRandomPassword = () => `Aa1!${randomBytes(8).toString('hex')}`;

describe('Users API routes convention (EN-8409)', () => {
  let app: INestApplication;
  let server: Server;
  let databaseHelper: DatabaseHelper;
  let usersHelper: UsersHelper;

  const queuesService = {
    addToWorkQueue: jest.fn(),
    addToEmbeddingQueue: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [CustomTestingModule],
    })
      .overrideProvider(QueuesService)
      .useValue(queuesService)
      .compile();
    app = moduleFixture.createNestApplication();
    // Same registration as main.ts: before the Nest router.
    app.use(legacyUserRoutesMiddleware);
    await app.init();
    server = app.getHttpServer();

    databaseHelper = moduleFixture.get(DatabaseHelper);
    usersHelper = moduleFixture.get(UsersHelper);
  });

  afterAll(async () => {
    await databaseHelper.resetTestDB();
    await app.close();
    server.close();
  });

  beforeEach(async () => {
    await databaseHelper.resetTestDB();
    queuesService.addToWorkQueue.mockResolvedValue({ id: '1' });
    queuesService.addToEmbeddingQueue.mockResolvedValue({ id: '1' });
  });

  const auth = (user: LoggedInUser) => ({
    authorization: `Bearer ${user.token}`,
  });

  describe('static /users/... routes are not captured by GET /users/:id', () => {
    it('serves GET /users/public-cvs', async () => {
      const response = await request(server).get('/users/public-cvs');

      expect(response.status).toBe(200);
    });

    it('serves GET /users/social-situations', async () => {
      const candidate = await usersHelper.createLoggedInUser({
        role: UserRoles.CANDIDATE,
      });

      const response = await request(server)
        .get('/users/social-situations')
        .set(auth(candidate));

      // The social situation handler answers 404 for a user without one;
      // `GET /users/:id` would answer 400 for this non-id segment.
      expect(response.status).toBe(404);
    });

    it('serves GET /users/profiles', async () => {
      const admin = await usersHelper.createLoggedInUser({
        role: UserRoles.ADMIN,
      });

      const response = await request(server)
        .get(`/users/profiles?limit=5&offset=0&role=${UserRoles.CANDIDATE}`)
        .set(auth(admin));

      expect(response.status).toBe(200);
      expect(response.body).not.toHaveProperty('email');
    });

    it('serves GET /users/members', async () => {
      const admin = await usersHelper.createLoggedInUser({
        role: UserRoles.ADMIN,
      });

      const response = await request(server)
        .get(`/users/members?limit=10&offset=0&role=${UserRoles.COACH}`)
        .set(auth(admin));

      expect(response.status).toBe(200);
    });

    it('does not serve a removed user id as a static route', async () => {
      const admin = await usersHelper.createLoggedInUser({
        role: UserRoles.ADMIN,
      });

      const response = await request(server)
        .get('/users/not-a-uuid-or-email')
        .set(auth(admin));

      expect(response.status).toBe(400);
    });
  });

  describe('legacy /user/... routes keep answering', () => {
    it('rewrites every documented legacy path', () => {
      const cases: Array<[string, string]> = [
        ['/user', '/users'],
        ['/user/registration', '/users/registration'],
        [
          '/user/registration/compatible-profiles',
          '/users/registration/compatible-profiles',
        ],
        ['/user/refering', '/users/referrals'],
        ['/user/members', '/users/members'],
        ['/user/me', '/users/me'],
        ['/user/changePwd', '/users/me/password'],
        ['/user/company', '/users/me/company'],
        ['/user/abc', '/users/abc'],
        ['/user/profile', '/users/profiles'],
        ['/user/profile/abc', '/users/abc/profile'],
        ['/user/profile/abc/report', '/users/abc/profile/report'],
        ['/user/profile/abc/share-text', '/users/abc/profile/share-text'],
        ['/user/profile/abc/shares', '/users/abc/profile/shares'],
        ['/user/profile/completion', '/current/profile/completion'],
        ['/user/profile/recommendations', '/current/profile/recommendations'],
        [
          '/user/profile/recommendations-ai/abc',
          '/users/abc/profile/recommendations-ai',
        ],
        ['/user/profile/refered', '/current/profile/referred-profiles'],
        ['/user/profile/upload-image', '/users/me/profile/image'],
        ['/user/shares/sent', '/current/shares/sent'],
      ];

      cases.forEach(([legacy, expected]) => {
        expect(rewriteLegacyUserPath(legacy)).toBe(expected);
      });
      expect(cases.length).toBeGreaterThan(LEGACY_USER_ROUTE_RULES.length);
    });

    it('does not touch non legacy paths', () => {
      ['/users', '/users/abc', '/current', '/userinfo', '/auth/login'].forEach(
        (path) => {
          expect(rewriteLegacyUserPath(path)).toBeNull();
        }
      );
    });

    it('answers GET /user/profile/recommendations like the new route', async () => {
      const candidate = await usersHelper.createLoggedInUser({
        role: UserRoles.CANDIDATE,
      });

      const legacy = await request(server)
        .get('/user/profile/recommendations')
        .set(auth(candidate));
      const current = await request(server)
        .get('/current/profile/recommendations')
        .set(auth(candidate));

      expect(legacy.status).toBe(current.status);
      expect(legacy.body).toEqual(current.body);
    });

    it('answers GET /user/:id with the query string preserved', async () => {
      const admin = await usersHelper.createLoggedInUser({
        role: UserRoles.ADMIN,
      });

      const legacy = await request(server)
        .get(`/user/${admin.user.id}`)
        .set(auth(admin));
      const current = await request(server)
        .get(`/users/${admin.user.id}`)
        .set(auth(admin));

      expect(legacy.status).toBe(200);
      expect(legacy.body).toEqual(current.body);

      const members = await request(server)
        .get(`/user/members?limit=10&offset=0&role=${UserRoles.COACH}`)
        .set(auth(admin));

      expect(members.status).toBe(200);
    });

    it('answers PUT /user/changePwd like PUT /users/me/password', async () => {
      const candidate = await usersHelper.createLoggedInUser({
        role: UserRoles.CANDIDATE,
      });
      const body = {
        oldPassword: buildRandomPassword(),
        newPassword: buildRandomPassword(),
      };

      const legacy = await request(server)
        .put('/user/changePwd')
        .set(auth(candidate))
        .send(body);
      const current = await request(server)
        .put('/users/me/password')
        .set(auth(candidate))
        .send(body);

      expect(legacy.status).toBe(current.status);
      expect(legacy.status).not.toBe(404);
    });
  });
});
