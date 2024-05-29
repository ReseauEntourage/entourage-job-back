import { getQueueToken } from '@nestjs/bull';
import { CACHE_MANAGER, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { CacheMocks, QueueMocks, SalesforceMocks } from '../mocks.types';
import { LoggedUser } from 'src/auth/auth.types';
import { SalesforceService } from 'src/external-services/salesforce/salesforce.service';
import { Queues } from 'src/queues/queues.types';
import { ReadDocumentsController } from 'src/read-documents/read-documents.controller';
import { User } from 'src/users/models';
import { APIResponse } from 'src/utils/types';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import { UserFactory } from 'tests/users/user.factory';
import { UsersHelper } from 'tests/users/users.helper';

describe('Read Documents', () => {
  let app: INestApplication;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let server: any;

  let databaseHelper: DatabaseHelper;
  let userFactory: UserFactory;
  let usersHelper: UsersHelper;

  const routeReadDocuments = '/readDocuments';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [CustomTestingModule],
    })
      .overrideProvider(getQueueToken(Queues.WORK))
      .useValue(QueueMocks)
      .overrideProvider(CACHE_MANAGER)
      .useValue(CacheMocks)
      .overrideProvider(SalesforceService)
      .useValue(SalesforceMocks)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    server = app.getHttpServer();

    databaseHelper = moduleFixture.get<DatabaseHelper>(DatabaseHelper);
    userFactory = moduleFixture.get<UserFactory>(UserFactory);
    usersHelper = moduleFixture.get<UsersHelper>(UsersHelper);
  });

  afterAll(async () => {
    await databaseHelper.resetTestDB();
    await app.close();
    server.close();
  });

  beforeEach(async () => {
    await databaseHelper.resetTestDB();
  });

  describe('CRUD Read Documents', () => {
    describe('R - Read a document', () => {
      let user: LoggedUser;
      let userBis: User;

      beforeEach(async () => {
        user = await usersHelper.createLoggedInUser({});
        userBis = await userFactory.create();
      });

      it('Should return 201 when right user is logged', async () => {
        const response: APIResponse<
          ReadDocumentsController['createReadDocument']
        > = await request(server)
          .post(`${routeReadDocuments}/read/${user.user.id}`)
          .set('authorization', `Token ${user.token}`)
          .send({
            documentName: 'CharteEthique',
          });
        expect(response.status).toBe(201);
      });

      it('Should return 400 when document name is not valid', async () => {
        const response: APIResponse<
          ReadDocumentsController['createReadDocument']
        > = await request(server)
          .post(`${routeReadDocuments}/read/${user.user.id}`)
          .set('authorization', `Token ${user.token}`)
          .send({
            documentName: 'test',
          });
        expect(response.status).toBe(400);
      });

      it('Should return 403 when wrong user is logged', async () => {
        const response: APIResponse<
          ReadDocumentsController['createReadDocument']
        > = await request(server)
          .post(`${routeReadDocuments}/read/${userBis.id}`)
          .set('authorization', `Token ${user.token}`)
          .send({
            documentName: 'CharteEthique',
          });
        expect(response.status).toBe(403);
      });

      it('Should return 401 if no user logged', async () => {
        const response: APIResponse<
          ReadDocumentsController['createReadDocument']
        > = await request(server)
          .post(`${routeReadDocuments}/read/${userBis.id}`)
          .send({
            documentName: 'CharteEthique',
          });
        expect(response.status).toBe(401);
      });
    });
  });
});
