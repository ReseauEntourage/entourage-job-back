import { getQueueToken } from '@nestjs/bull';
import { CACHE_MANAGER, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { CacheMocks, QueueMocks, SalesforceMocks } from '../mocks.types';
import { LoggedUser } from 'src/auth/auth.types';
import { SalesforceService } from 'src/external-services/salesforce/salesforce.service';
import { MessagesController } from 'src/messages/messages.controller';
import { Queues } from 'src/queues/queues.types';
import { User } from 'src/users/models';
import { UserRoles } from 'src/users/users.types';
import { APIResponse } from 'src/utils/types';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import { UserFactory } from 'tests/users/user.factory';
import { UsersHelper } from 'tests/users/users.helper';
import { ExternalMessageFactory } from './external-message.factory';
import { InternalMessageFactory } from './internal-message.factory';
import { MessagesHelper } from './messages.helper';

describe('Messages', () => {
  let app: INestApplication;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let server: any;

  let databaseHelper: DatabaseHelper;
  let externalMessageFactory: ExternalMessageFactory;
  let internalMessageFactory: InternalMessageFactory;
  let messagesHelper: MessagesHelper;
  let userFactory: UserFactory;
  let usersHelper: UsersHelper;

  const routeExternalMessage = '/message/external';
  const routeInternalMessage = '/message/internal';

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
    messagesHelper = moduleFixture.get<MessagesHelper>(MessagesHelper);
    externalMessageFactory = moduleFixture.get<ExternalMessageFactory>(
      ExternalMessageFactory
    );
    internalMessageFactory = moduleFixture.get<InternalMessageFactory>(
      InternalMessageFactory
    );
  });

  afterAll(async () => {
    await databaseHelper.resetTestDB();
    await app.close();
    server.close();
  });

  beforeEach(async () => {
    await databaseHelper.resetTestDB();
  });

  describe('CRUD Message', () => {
    describe('C - Create 1 External Message', () => {
      describe('/ - Create external message', () => {
        let candidate: User;
        let coach: User;
        let admin: User;

        beforeEach(async () => {
          admin = await userFactory.create({
            role: UserRoles.ADMIN,
          });
          candidate = await userFactory.create({
            role: UserRoles.CANDIDATE,
          });
          coach = await userFactory.create({
            role: UserRoles.COACH,
          });
        });

        it('Should return 201 when valid message and message is for candidate', async () => {
          const message = await externalMessageFactory.create(
            { UserId: candidate.id },
            false
          );

          const messageToCreate = await messagesHelper.mapExternalMessageProps(
            message
          );

          const response: APIResponse<
            MessagesController['createExternalMessage']
          > = await request(server)
            .post(`${routeExternalMessage}`)
            .send(messageToCreate);
          expect(response.status).toBe(201);
          expect(response.body).toEqual(expect.objectContaining(message));
        });
        it('Should return 200 when message with missing optional fields and message is for candidate', async () => {
          const message = await externalMessageFactory.create(
            { UserId: candidate.id },
            false
          );

          const { senderPhone, type, optInNewsletter, ...messageToCreate } =
            await messagesHelper.mapExternalMessageProps(message);

          const response: APIResponse<
            MessagesController['createExternalMessage']
          > = await request(server)
            .post(`${routeExternalMessage}`)
            .send(messageToCreate);
          expect(response.status).toBe(201);
          expect(response.body).toEqual(
            expect.objectContaining({
              ...message,
              senderPhone: null,
              type: null,
              optInNewsletter: false,
            })
          );
        });
        it('Should return 400 when message has missing fields', async () => {
          const message = await externalMessageFactory.create(
            { UserId: candidate.id },
            false
          );

          const { senderFirstName, senderLastName, ...messageToCreate } =
            await messagesHelper.mapExternalMessageProps(message);

          const response: APIResponse<
            MessagesController['createExternalMessage']
          > = await request(server)
            .post(`${routeExternalMessage}`)
            .send(messageToCreate);
          expect(response.status).toBe(400);
        });
        it('Should return 400 when message has invalid phone number', async () => {
          const message = await externalMessageFactory.create(
            { UserId: candidate.id },
            false
          );

          const messageToCreate = await messagesHelper.mapExternalMessageProps(
            message
          );

          const response: APIResponse<
            MessagesController['createExternalMessage']
          > = await request(server)
            .post(`${routeExternalMessage}`)
            .send({ ...messageToCreate, senderPhone: '1234' });
          expect(response.status).toBe(400);
        });
        it('Should return 400 when message is for coach', async () => {
          const message = await externalMessageFactory.create(
            { UserId: coach.id },
            false
          );

          const messageToCreate = await messagesHelper.mapExternalMessageProps(
            message
          );

          const response: APIResponse<
            MessagesController['createExternalMessage']
          > = await request(server)
            .post(`${routeExternalMessage}`)
            .send(messageToCreate);
          expect(response.status).toBe(400);
        });
        it('Should return 400 when message is for admin', async () => {
          const message = await externalMessageFactory.create(
            { UserId: admin.id },
            false
          );

          const messageToCreate = await messagesHelper.mapExternalMessageProps(
            message
          );

          const response: APIResponse<
            MessagesController['createExternalMessage']
          > = await request(server)
            .post(`${routeExternalMessage}`)
            .send(messageToCreate);
          expect(response.status).toBe(400);
        });
      });
    });
    describe('R - Read 1 Internal Message', () => {
      describe('/ - Create internal message', () => {
        let senderUser: LoggedUser;
        let addresseeUser: User;
        beforeEach(async () => {
          senderUser = await usersHelper.createLoggedInUser({});
          addresseeUser = await userFactory.create();
        });

        it('Should return 201 when valid message', async () => {
          const message = await internalMessageFactory.create(
            {
              senderUserId: senderUser.user.id,
              addresseeUserId: addresseeUser.id,
            },
            false
          );

          const messageToCreate = await messagesHelper.mapInternalMessageProps(
            message
          );

          const response: APIResponse<
            MessagesController['createInternalMessage']
          > = await request(server)
            .post(`${routeInternalMessage}`)
            .set('authorization', `Token ${senderUser.token}`)
            .send(messageToCreate);
          expect(response.status).toBe(201);
          expect(response.body).toEqual(expect.objectContaining(message));
        });

        it('Should return 400 when message has missing fields', async () => {
          const message = await internalMessageFactory.create(
            {
              senderUserId: senderUser.user.id,
              addresseeUserId: addresseeUser.id,
            },
            false
          );

          const {
            subject,
            message: messageContent,
            ...messageToCreate
          } = await messagesHelper.mapInternalMessageProps(message);

          const response: APIResponse<
            MessagesController['createExternalMessage']
          > = await request(server)
            .post(`${routeInternalMessage}`)
            .set('authorization', `Token ${senderUser.token}`)
            .send(messageToCreate);
          expect(response.status).toBe(400);
        });

        it('Should return 401 if user not loggedin', async () => {
          const message = await internalMessageFactory.create(
            {
              senderUserId: senderUser.user.id,
              addresseeUserId: addresseeUser.id,
            },
            false
          );

          const messageToCreate = await messagesHelper.mapInternalMessageProps(
            message
          );

          const response: APIResponse<
            MessagesController['createInternalMessage']
          > = await request(server)
            .post(`${routeInternalMessage}`)
            .send(messageToCreate);
          expect(response.status).toBe(401);
        });
      });
    });
  });
});
