import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/sequelize';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { LoggedInUser, UsersHelper } from '../users/users.helper';
import { SequelizeMeta } from 'src/db/models/sequelize-meta.model';
import { PingModule } from 'src/ping/ping.module';
import { QueuesService } from 'src/queues/producers/queues.service';
import { UserRoles } from 'src/users/users.types';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import { QueuesServiceMock } from 'tests/queues/queues.service.mock';

// PingModule is not part of CustomTestingModule, it is added to the test application here.
describe('Ping', () => {
  let app: INestApplication;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let server: any;
  let databaseHelper: DatabaseHelper;
  let sequelizeMetaModel: typeof SequelizeMeta;
  let loggedInUsers: LoggedInUser[];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [CustomTestingModule, PingModule],
    })
      .overrideProvider(QueuesService)
      .useClass(QueuesServiceMock)
      .compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    server = app.getHttpServer();
    databaseHelper = moduleFixture.get(DatabaseHelper);
    sequelizeMetaModel = app.get(getModelToken(SequelizeMeta));

    const usersHelper = moduleFixture.get(UsersHelper);
    loggedInUsers = [
      await usersHelper.createLoggedInUser({ role: UserRoles.CANDIDATE }),
      await usersHelper.createLoggedInUser({ role: UserRoles.COACH }),
      await usersHelper.createLoggedInUser({ role: UserRoles.REFERER }),
      await usersHelper.createLoggedInUser({ role: UserRoles.ADMIN }),
    ];
  });

  afterAll(async () => {
    await databaseHelper.resetTestDB();
    await app.close();
    server.close();
  });

  afterEach(() => jest.restoreAllMocks());

  describe('GET /ping', () => {
    it('answers pong to an anonymous user', async () => {
      const response = await request(server).get('/ping');

      expect(response.status).toBe(200);
      expect(response.text).toBe('pong');
    });

    it('answers pong to any authenticated role', async () => {
      for (const { token } of loggedInUsers) {
        const response = await request(server)
          .get('/ping')
          .set('authorization', `Bearer ${token}`);
        expect(response.status).toBe(200);
        expect(response.text).toBe('pong');
      }
    });
  });

  describe('GET /ping/db', () => {
    it('answers the name of the last applied migration to an anonymous user', async () => {
      const last = await sequelizeMetaModel.findOne({
        order: [['name', 'DESC']],
      });

      const response = await request(server).get('/ping/db');

      expect(response.status).toBe(200);
      expect(response.text).toBe(last.name);
    });

    it('returns 404 when no migration was applied', async () => {
      jest.spyOn(sequelizeMetaModel, 'findOne').mockResolvedValue(null);

      const response = await request(server).get('/ping/db');

      expect(response.status).toBe(404);
    });
  });
});
