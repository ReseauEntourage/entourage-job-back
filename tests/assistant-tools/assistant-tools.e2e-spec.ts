import { randomUUID } from 'crypto';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { getModelToken } from '@nestjs/sequelize';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { ASSISTANT_TOOLS_THROTTLE_LIMIT } from 'src/assistant-tools/assistant-tools.controller';
import { SalesforceService } from 'src/external-services/salesforce/salesforce.service';
import { MailsService } from 'src/mails/mails.service';
import { QueuesService } from 'src/queues/producers/queues.service';
import { Session } from 'src/sessions/model/session.model';
import { User } from 'src/users/models';
import { UsersService } from 'src/users/users.service';
import { UserRoles } from 'src/users/users.types';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import { MailsServiceMock } from 'tests/mails/mails.service.mock';
import { SalesforceMocks } from 'tests/mocks.types';
import { QueuesServiceMock } from 'tests/queues/queues.service.mock';
import { UserFactory } from 'tests/users/user.factory';
import { UsersHelper } from 'tests/users/users.helper';

describe('AssistantTools', () => {
  let app: INestApplication;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let server: any;
  let databaseHelper: DatabaseHelper;
  let usersHelper: UsersHelper;
  let userFactory: UserFactory;
  let usersService: UsersService;
  let jwtService: JwtService;
  let userModel: typeof User;
  let sessionModel: typeof Session;

  const route = '/assistant-tools/identity';

  // A negative `expiresIn` yields an already expired, correctly signed token.
  const signToken = (
    payload: { purpose?: string; sub: string },
    expiresIn = 3600
  ) => jwtService.sign(payload, { secret: process.env.JWT_SECRET, expiresIn });

  const getIdentity = (token?: string) => {
    const req = request(server).get(route);
    return token ? req.set('authorization', `Bearer ${token}`) : req;
  };

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
    userFactory = moduleFixture.get(UserFactory);
    usersService = moduleFixture.get(UsersService);
    jwtService = moduleFixture.get(JwtService, { strict: false });
    userModel = moduleFixture.get(getModelToken(User), { strict: false });
    sessionModel = moduleFixture.get(getModelToken(Session), {
      strict: false,
    });
  });

  afterAll(async () => {
    await databaseHelper.resetTestDB();
    await app.close();
    server.close();
  });

  beforeEach(async () => {
    await databaseHelper.resetTestDB();
  });

  describe('GET /assistant-tools/identity', () => {
    it.each([
      UserRoles.CANDIDATE,
      UserRoles.COACH,
      UserRoles.REFERER,
      UserRoles.ADMIN,
    ])('returns the identifier, first name and role of a %s', async (role) => {
      const loggedIn = await usersHelper.createLoggedInUser({
        role,
        firstName: 'Camille',
      });

      const response = await getIdentity(loggedIn.token);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        id: loggedIn.user.id,
        firstName: 'Camille',
        role,
      });
    });

    it('returns exactly the id, firstName and role keys and nothing else', async () => {
      const loggedIn = await usersHelper.createLoggedInUser({
        role: UserRoles.COACH,
      });

      const response = await getIdentity(loggedIn.token);

      expect(response.status).toBe(200);
      expect(Object.keys(response.body).sort()).toEqual([
        'firstName',
        'id',
        'role',
      ]);
      const serialized = JSON.stringify(response.body);
      expect(serialized).not.toContain(loggedIn.user.email);
      expect(serialized).not.toContain(loggedIn.user.lastName);
      expect(serialized).not.toContain(loggedIn.user.phone);
    });

    it('returns an empty first name, without error, when it is not filled in', async () => {
      const loggedIn = await usersHelper.createLoggedInUser({
        role: UserRoles.CANDIDATE,
      });
      // The model validators reject an empty first name: write it around them.
      await userModel.update(
        { firstName: '' },
        { where: { id: loggedIn.user.id }, validate: false, hooks: false }
      );

      const response = await getIdentity(loggedIn.token);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        id: loggedIn.user.id,
        firstName: '',
        role: UserRoles.CANDIDATE,
      });
    });

    it('serves a coach who has not finished the training', async () => {
      const loggedIn = await usersHelper.createLoggedInUser({
        role: UserRoles.COACH,
        elearningCompletedAt: null,
      });

      const response = await getIdentity(loggedIn.token);

      expect(response.status).toBe(200);
    });

    describe('refusals inherited from the global guards', () => {
      it('returns 401 without a token', async () => {
        const response = await getIdentity();

        expect(response.status).toBe(401);
      });

      it('returns 401 for a token that is not signed with the secret', async () => {
        const user = await userFactory.create({ isEmailVerified: true });

        const response = await getIdentity(
          jwtService.sign({ sub: user.id }, { secret: 'not-the-jwt-secret' })
        );

        expect(response.status).toBe(401);
      });

      it('returns 401 for an expired token', async () => {
        const user = await userFactory.create({ isEmailVerified: true });

        const response = await getIdentity(signToken({ sub: user.id }, -60));

        expect(response.status).toBe(401);
      });

      it('returns 401 for a purpose-scoped token (account activation link)', async () => {
        const user = await userFactory.create({ isEmailVerified: true });

        const response = await getIdentity(
          signToken({ sub: user.id, purpose: 'account-activation' })
        );

        expect(response.status).toBe(401);
      });

      it('returns 401 for a deleted user', async () => {
        const loggedIn = await usersHelper.createLoggedInUser();
        await userModel.destroy({ where: { id: loggedIn.user.id } });

        const response = await getIdentity(loggedIn.token);

        expect(response.status).toBe(401);
      });

      it('returns 401 for an unknown user', async () => {
        const response = await getIdentity(signToken({ sub: randomUUID() }));

        expect(response.status).toBe(401);
      });

      it('returns 401 UNVERIFIED_EMAIL for an account with a password and an unverified e-mail', async () => {
        const user = await userFactory.create({ role: UserRoles.CANDIDATE });
        await usersService.update(user.id, { isEmailVerified: false });

        const response = await getIdentity(signToken({ sub: user.id }));

        expect(response.status).toBe(401);
        expect(response.body.message).toBe('UNVERIFIED_EMAIL');
      });

      it('returns 403 PASSWORD_SETUP_REQUIRED for an account without a password', async () => {
        const user = await userFactory.create({ role: UserRoles.CANDIDATE });
        await usersService.update(user.id, {
          isEmailVerified: false,
          password: null,
          salt: null,
        });

        const response = await getIdentity(signToken({ sub: user.id }));

        expect(response.status).toBe(403);
        expect(response.body.message).toBe('PASSWORD_SETUP_REQUIRED');
      });
    });

    describe('no effect on the activity', () => {
      it('leaves the sessions and lastConnection of the user unchanged', async () => {
        const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);
        const loggedIn = await usersHelper.createLoggedInUser({
          lastConnection: weekAgo,
        });
        const before = await usersHelper.findUserRaw(loggedIn.user.id);
        const sessionsBefore = await sessionModel.count({
          where: { userId: loggedIn.user.id },
        });

        const response = await getIdentity(loggedIn.token);
        const after = await usersHelper.findUserRaw(loggedIn.user.id);
        const sessionsAfter = await sessionModel.count({
          where: { userId: loggedIn.user.id },
        });

        expect(response.status).toBe(200);
        expect(new Date(after.lastConnection).getTime()).toBe(
          new Date(before.lastConnection).getTime()
        );
        expect(new Date(after.lastConnection).getTime()).toBe(
          weekAgo.getTime()
        );
        expect(sessionsAfter).toBe(sessionsBefore);
      });
    });

    describe('rate limiting per user', () => {
      it('returns 429 beyond the limit of the group for a user', async () => {
        const loggedIn = await usersHelper.createLoggedInUser();

        for (let i = 0; i < ASSISTANT_TOOLS_THROTTLE_LIMIT; i += 1) {
          const ok = await getIdentity(loggedIn.token);
          expect([i, ok.status]).toEqual([i, 200]);
        }
        const response = await getIdentity(loggedIn.token);

        expect(response.status).toBe(429);
      });

      it('counts two users calling from the same address separately', async () => {
        const first = await usersHelper.createLoggedInUser();
        const second = await usersHelper.createLoggedInUser();

        for (let i = 0; i < ASSISTANT_TOOLS_THROTTLE_LIMIT; i += 1) {
          await getIdentity(first.token);
        }
        const exceeded = await getIdentity(first.token);
        const other = await getIdentity(second.token);

        expect(exceeded.status).toBe(429);
        expect(other.status).toBe(200);
      });
    });
  });
});
