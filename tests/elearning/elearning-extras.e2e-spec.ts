import { randomUUID } from 'crypto';
import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/sequelize';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';
import { UniqueConstraintError } from 'sequelize';
import request from 'supertest';
import { ElearningService } from 'src/elearning/elearning.service';
import { ElearningCompletion } from 'src/elearning/models/elearning-completion.model';
import { MailsService } from 'src/mails/mails.service';
import { QueuesService } from 'src/queues/producers/queues.service';
import { UserRoles } from 'src/users/users.types';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import { MailsServiceMock } from 'tests/mails/mails.service.mock';
import { QueuesServiceMock } from 'tests/queues/queues.service.mock';
import { LoggedInUser, UsersHelper } from 'tests/users/users.helper';
import { ElearningUnitFactory } from './elearning-unit.factory';

// Complements tests/elearning/elearning.e2e-spec.ts: role matrix, completion race, mail
// failures and the completion helpers of ElearningService.
describe('Elearning - extras', () => {
  let app: INestApplication;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let server: any;
  let databaseHelper: DatabaseHelper;
  let usersHelper: UsersHelper;
  let elearningUnitFactory: ElearningUnitFactory;
  let throttlerStorage: ThrottlerStorageService;
  let elearningService: ElearningService;
  let completionModel: typeof ElearningCompletion;

  const route = '/elearning';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [CustomTestingModule],
    })
      .overrideProvider(MailsService)
      .useClass(MailsServiceMock)
      .overrideProvider(QueuesService)
      .useClass(QueuesServiceMock)
      .compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    server = app.getHttpServer();
    databaseHelper = moduleFixture.get(DatabaseHelper);
    usersHelper = moduleFixture.get(UsersHelper);
    elearningUnitFactory = moduleFixture.get(ElearningUnitFactory);
    throttlerStorage = moduleFixture.get(ThrottlerStorage);
    elearningService = app.get(ElearningService);
    completionModel = app.get(getModelToken(ElearningCompletion));
  });

  afterAll(async () => {
    await databaseHelper.resetTestDB();
    await app.close();
    server.close();
  });

  beforeEach(async () => {
    await databaseHelper.resetTestDB();
    // Also cancel the pending expiry timers: once the storage is cleared, a stale timer would
    // fire on a missing entry and crash a later test
    throttlerStorage.storage.clear();
    const { timeoutIds } = throttlerStorage as unknown as {
      timeoutIds: Map<string, NodeJS.Timeout[]>;
    };
    timeoutIds.forEach((ids) => ids.forEach(clearTimeout));
    timeoutIds.clear();
  });

  afterEach(() => jest.restoreAllMocks());

  const complete = (user: LoggedInUser, unitId: string) =>
    request(server)
      .post(`${route}/units/${unitId}/completions`)
      .set('authorization', `Bearer ${user.token}`);

  describe('Role checks', () => {
    it.each([UserRoles.REFERER, UserRoles.ADMIN])(
      'returns 403 to a %s completing a unit that is assigned to candidates and coaches only',
      async (role) => {
        const user = await usersHelper.createLoggedInUser({ role });
        const unit = await elearningUnitFactory.create(
          { order: 1 },
          { roles: [UserRoles.CANDIDATE, UserRoles.COACH] }
        );

        const response = await complete(user, unit.id);

        expect(response.status).toBe(403);
        expect(await completionModel.count()).toBe(0);
      }
    );

    it.each([
      [UserRoles.CANDIDATE, UserRoles.COACH],
      [UserRoles.COACH, UserRoles.CANDIDATE],
    ])(
      'returns 403 to a %s completing a unit reserved to a %s',
      async (role, otherRole) => {
        const user = await usersHelper.createLoggedInUser({ role });
        const unit = await elearningUnitFactory.create(
          { order: 1 },
          { roles: [otherRole] }
        );

        expect((await complete(user, unit.id)).status).toBe(403);
      }
    );

    it('lets a coach complete a unit assigned to coaches', async () => {
      const user = await usersHelper.createLoggedInUser({
        role: UserRoles.COACH,
        elearningCompletedAt: null,
      });
      const unit = await elearningUnitFactory.create(
        { order: 1 },
        { roles: [UserRoles.COACH] }
      );

      const response = await complete(user, unit.id);

      expect(response.status).toBe(201);
      const identity = await request(server)
        .get('/current')
        .set('authorization', `Bearer ${user.token}`);
      expect(identity.body.elearningCompletedAt).not.toBeNull();
    });

    it.each([
      UserRoles.CANDIDATE,
      UserRoles.COACH,
      UserRoles.REFERER,
      UserRoles.ADMIN,
    ])('lets a %s list the units', async (role) => {
      const user = await usersHelper.createLoggedInUser({ role });
      await elearningUnitFactory.create({ order: 1 });

      const response = await request(server)
        .get(`${route}/units`)
        .set('authorization', `Bearer ${user.token}`);

      expect(response.status).toBe(200);
    });

    it('returns 400 for a non numeric limit', async () => {
      const user = await usersHelper.createLoggedInUser({
        role: UserRoles.CANDIDATE,
      });

      const response = await request(server)
        .get(`${route}/units`)
        .query({ limit: 'many' })
        .set('authorization', `Bearer ${user.token}`);

      expect(response.status).toBe(400);
    });
  });

  describe('Completion edge cases', () => {
    it('returns the row inserted by a concurrent request when the unique constraint rejects the insert', async () => {
      const user = await usersHelper.createLoggedInUser({
        role: UserRoles.CANDIDATE,
      });
      const unit = await elearningUnitFactory.create(
        { order: 1 },
        { roles: [UserRoles.CANDIDATE] }
      );
      const first = await complete(user, unit.id);
      // The duplicate check passes (race), then the unique constraint rejects the insert
      jest.spyOn(completionModel, 'findOne').mockResolvedValueOnce(null);

      const second = await complete(user, unit.id);

      expect(second.status).toBe(201);
      expect(second.body.id).toBe(first.body.id);
      expect(await completionModel.count()).toBe(1);
    });

    it('does not hide an unexpected database error', async () => {
      const user = await usersHelper.createLoggedInUser({
        role: UserRoles.CANDIDATE,
      });
      const unit = await elearningUnitFactory.create(
        { order: 1 },
        { roles: [UserRoles.CANDIDATE] }
      );
      jest
        .spyOn(completionModel, 'create')
        .mockRejectedValueOnce(new Error('connection lost'));

      const response = await complete(user, unit.id);

      expect(response.status).toBe(500);
    });

    it('recognises a unique constraint error by its name', async () => {
      const user = await usersHelper.createLoggedInUser({
        role: UserRoles.CANDIDATE,
      });
      const unit = await elearningUnitFactory.create(
        { order: 1 },
        { roles: [UserRoles.CANDIDATE] }
      );
      const first = await complete(user, unit.id);
      const findOne = jest.spyOn(completionModel, 'findOne');
      findOne.mockResolvedValueOnce(null);
      jest
        .spyOn(completionModel, 'create')
        .mockRejectedValueOnce(new UniqueConstraintError({}));

      const second = await complete(user, unit.id);

      expect(second.status).toBe(201);
      expect(second.body.id).toBe(first.body.id);
    });

    it('still validates the completion when the congratulation mail fails', async () => {
      const user = await usersHelper.createLoggedInUser({
        role: UserRoles.CANDIDATE,
        elearningCompletedAt: null,
      });
      const unit = await elearningUnitFactory.create(
        { order: 1 },
        { roles: [UserRoles.CANDIDATE] }
      );
      jest
        .spyOn(MailsServiceMock.prototype, 'sendAllElearningUnitsCompletedMail')
        .mockRejectedValue(new Error('mailjet down'));

      const response = await complete(user, unit.id);

      expect(response.status).toBe(201);
      const identity = await request(server)
        .get('/current')
        .set('authorization', `Bearer ${user.token}`);
      expect(identity.body.elearningCompletedAt).not.toBeNull();
    });

    it('does not reset elearningCompletedAt of a user who completed everything before', async () => {
      const completedAt = new Date('2024-01-01T00:00:00.000Z');
      const user = await usersHelper.createLoggedInUser({
        role: UserRoles.CANDIDATE,
        elearningCompletedAt: completedAt,
      });
      const unit = await elearningUnitFactory.create(
        { order: 1 },
        { roles: [UserRoles.CANDIDATE] }
      );

      expect((await complete(user, unit.id)).status).toBe(201);

      const identity = await request(server)
        .get('/current')
        .set('authorization', `Bearer ${user.token}`);
      expect(new Date(identity.body.elearningCompletedAt).toISOString()).toBe(
        completedAt.toISOString()
      );
    });

    it('survives the completion of a user deleted in the meantime', async () => {
      const user = await usersHelper.createLoggedInUser({
        role: UserRoles.CANDIDATE,
      });
      const unit = await elearningUnitFactory.create(
        { order: 1 },
        { roles: [UserRoles.CANDIDATE] }
      );
      jest
        .spyOn(elearningService.usersService, 'findOne')
        .mockResolvedValueOnce(null);

      const response = await complete(user, unit.id);

      expect(response.status).toBe(201);
    });
  });

  describe('ElearningService helpers', () => {
    it('hasCompletedAllUnits is false without any unit', async () => {
      expect(
        await elearningService.hasCompletedAllUnits(
          randomUUID(),
          UserRoles.CANDIDATE
        )
      ).toBe(false);
    });

    it('lists the units a user has not completed yet', async () => {
      const user = await usersHelper.createLoggedInUser({
        role: UserRoles.CANDIDATE,
      });
      const done = await elearningUnitFactory.create(
        { order: 1 },
        { roles: [UserRoles.CANDIDATE] }
      );
      const todo = await elearningUnitFactory.create(
        { order: 2 },
        { roles: [UserRoles.CANDIDATE] }
      );
      await complete(user, done.id);

      const remaining = await elearningService.allUnitsNotCompletedByUser(
        user.user as never
      );

      expect(remaining.map(({ id }) => id)).toEqual([todo.id]);
      expect(
        await elearningService.hasCompletedAllUnits(
          user.user.id,
          UserRoles.CANDIDATE
        )
      ).toBe(false);
    });
  });
});
