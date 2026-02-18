import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import * as uuid from 'uuid';
import { MailsService } from 'src/mails/mails.service';
import { QueuesService } from 'src/queues/producers/queues.service';
import { UserRoles } from 'src/users/users.types';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import { MailsServiceMock } from 'tests/mails/mails.service.mock';
import { QueuesServiceMock } from 'tests/queues/queues.service.mock';
import { UsersHelper } from 'tests/users/users.helper';
import { ElearningUnitFactory } from './elearning-unit.factory';

describe('Elearning', () => {
  let app: INestApplication;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let server: any;

  let databaseHelper: DatabaseHelper;
  let usersHelper: UsersHelper;
  let elearningUnitFactory: ElearningUnitFactory;

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

    databaseHelper = moduleFixture.get<DatabaseHelper>(DatabaseHelper);
    usersHelper = moduleFixture.get<UsersHelper>(UsersHelper);
    elearningUnitFactory =
      moduleFixture.get<ElearningUnitFactory>(ElearningUnitFactory);
  });

  afterAll(async () => {
    await databaseHelper.resetTestDB();
    await app.close();

    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  beforeEach(async () => {
    await databaseHelper.resetTestDB();
  });

  describe('GET /units', () => {
    it('Should return 401 when not logged in', async () => {
      const response = await request(server).get(`${route}/units`);
      expect(response.status).toBe(401);
    });

    it('Should return 200 and an empty array when no units exist', async () => {
      const loggedIn = await usersHelper.createLoggedInUser({
        role: UserRoles.CANDIDATE,
      });

      const response = await request(server)
        .get(`${route}/units`)
        .set('authorization', `Bearer ${loggedIn.token}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('Should return 200 and order units by order ASC (with pagination)', async () => {
      const loggedIn = await usersHelper.createLoggedInUser({
        role: UserRoles.CANDIDATE,
      });

      await elearningUnitFactory.create({ order: 2 }, { roles: [] });
      const unit1 = await elearningUnitFactory.create(
        { order: 1 },
        { roles: [] }
      );

      const response = await request(server)
        .get(`${route}/units?limit=1&offset=0`)
        .set('authorization', `Bearer ${loggedIn.token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].id).toBe(unit1.id);
      expect(response.body[0].order).toBe(1);

      const responseOffset = await request(server)
        .get(`${route}/units?limit=1&offset=1`)
        .set('authorization', `Bearer ${loggedIn.token}`);

      expect(responseOffset.status).toBe(200);
      expect(responseOffset.body).toHaveLength(1);
      expect(responseOffset.body[0].order).toBe(2);
    });

    it('Should return 200 and filter units by role', async () => {
      const loggedIn = await usersHelper.createLoggedInUser({
        role: UserRoles.ADMIN,
      });

      const candidateUnit = await elearningUnitFactory.create(
        { order: 1 },
        { roles: [UserRoles.CANDIDATE] }
      );
      await elearningUnitFactory.create(
        { order: 2 },
        { roles: [UserRoles.COACH] }
      );

      const response = await request(server)
        .get(`${route}/units?role=${encodeURIComponent(UserRoles.CANDIDATE)}`)
        .set('authorization', `Bearer ${loggedIn.token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].id).toBe(candidateUnit.id);
      expect(response.body[0].roles).toHaveLength(1);
      expect(response.body[0].roles[0].role).toBe(UserRoles.CANDIDATE);
    });

    it('Should include userCompletions for the logged in user', async () => {
      const loggedIn = await usersHelper.createLoggedInUser({
        role: UserRoles.CANDIDATE,
      });

      const unit = await elearningUnitFactory.create({ order: 1 });

      const createCompletionResponse = await request(server)
        .post(`${route}/units/${unit.id}/completions`)
        .set('authorization', `Bearer ${loggedIn.token}`);

      expect(createCompletionResponse.status).toBe(201);

      const response = await request(server)
        .get(`${route}/units`)
        .set('authorization', `Bearer ${loggedIn.token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].id).toBe(unit.id);
      expect(response.body[0].userCompletions).toHaveLength(1);
      expect(response.body[0].userCompletions[0].userId).toBe(loggedIn.user.id);
      expect(response.body[0].userCompletions[0].validatedAt).toBeTruthy();
    });
  });

  describe('POST /units/:unitId/completions', () => {
    it('Should return 401 when not logged in', async () => {
      const response = await request(server).post(
        `${route}/units/${uuid.v4()}/completions`
      );
      expect(response.status).toBe(401);
    });

    it('Should return 404 when unit does not exist', async () => {
      const loggedIn = await usersHelper.createLoggedInUser({
        role: UserRoles.CANDIDATE,
      });

      const response = await request(server)
        .post(`${route}/units/${uuid.v4()}/completions`)
        .set('authorization', `Bearer ${loggedIn.token}`);

      expect(response.status).toBe(404);
    });

    it('Should return 201 and create a completion', async () => {
      const loggedIn = await usersHelper.createLoggedInUser({
        role: UserRoles.CANDIDATE,
      });

      const unit = await elearningUnitFactory.create({ order: 1 });

      const response = await request(server)
        .post(`${route}/units/${unit.id}/completions`)
        .set('authorization', `Bearer ${loggedIn.token}`);

      expect(response.status).toBe(201);
      expect(response.body.id).toBeTruthy();
      expect(response.body.userId).toBe(loggedIn.user.id);
      expect(response.body.unitId).toBe(unit.id);
      expect(response.body.validatedAt).toBeTruthy();
    });

    it('Should return 409 when completion already exists', async () => {
      const loggedIn = await usersHelper.createLoggedInUser({
        role: UserRoles.CANDIDATE,
      });

      const unit = await elearningUnitFactory.create({ order: 1 });

      const first = await request(server)
        .post(`${route}/units/${unit.id}/completions`)
        .set('authorization', `Bearer ${loggedIn.token}`);
      expect(first.status).toBe(201);

      const second = await request(server)
        .post(`${route}/units/${unit.id}/completions`)
        .set('authorization', `Bearer ${loggedIn.token}`);

      expect(second.status).toBe(409);
    });
  });

  describe('DELETE /units/:unitId/completions', () => {
    it('Should return 401 when not logged in', async () => {
      const response = await request(server).delete(
        `${route}/units/${uuid.v4()}/completions`
      );
      expect(response.status).toBe(401);
    });

    it('Should return 404 when completion does not exist', async () => {
      const loggedIn = await usersHelper.createLoggedInUser({
        role: UserRoles.CANDIDATE,
      });

      const unit = await elearningUnitFactory.create({ order: 1 });

      const response = await request(server)
        .delete(`${route}/units/${unit.id}/completions`)
        .set('authorization', `Bearer ${loggedIn.token}`);

      expect(response.status).toBe(404);
    });

    it('Should return 200 and delete an existing completion', async () => {
      const loggedIn = await usersHelper.createLoggedInUser({
        role: UserRoles.CANDIDATE,
      });

      const unit = await elearningUnitFactory.create({ order: 1 });

      const createResponse = await request(server)
        .post(`${route}/units/${unit.id}/completions`)
        .set('authorization', `Bearer ${loggedIn.token}`);
      expect(createResponse.status).toBe(201);

      const deleteResponse = await request(server)
        .delete(`${route}/units/${unit.id}/completions`)
        .set('authorization', `Bearer ${loggedIn.token}`);

      expect(deleteResponse.status).toBe(200);

      const unitsResponse = await request(server)
        .get(`${route}/units`)
        .set('authorization', `Bearer ${loggedIn.token}`);

      expect(unitsResponse.status).toBe(200);
      expect(unitsResponse.body).toHaveLength(1);
      expect(unitsResponse.body[0].userCompletions).toHaveLength(0);
    });
  });
});
