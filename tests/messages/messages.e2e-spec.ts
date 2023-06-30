import { getQueueToken } from '@nestjs/bull';
import { CACHE_MANAGER, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { CacheMocks, QueueMocks, SalesforceMocks } from '../mocks.types';
import { SalesforceService } from 'src/external-services/salesforce/salesforce.service';
import { MessagesController } from 'src/messages/messages.controller';
import { Queues } from 'src/queues/queues.types';
import { User } from 'src/users/models';
import { UserRoles } from 'src/users/users.types';
import { APIResponse } from 'src/utils/types';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import { UserFactory } from 'tests/users/user.factory';
import { MessageFactory } from './message.factory';
import { MessagesHelper } from './messages.helper';

describe('Messages', () => {
  let app: INestApplication;

  let databaseHelper: DatabaseHelper;
  let messageFactory: MessageFactory;
  let messagesHelper: MessagesHelper;
  let userFactory: UserFactory;

  const route = '/message';

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

    databaseHelper = moduleFixture.get<DatabaseHelper>(DatabaseHelper);
    userFactory = moduleFixture.get<UserFactory>(UserFactory);
    messagesHelper = moduleFixture.get<MessagesHelper>(MessagesHelper);
    messageFactory = moduleFixture.get<MessageFactory>(MessageFactory);
  });

  afterAll(async () => {
    await databaseHelper.resetTestDB();
    await app.close();
  });

  beforeEach(async () => {
    await databaseHelper.resetTestDB();
  });

  describe('CRUD Message', () => {
    describe('C - Create 1 Message', () => {
      describe('/ - Create message', () => {
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
          const message = await messageFactory.create(
            { UserId: candidate.id },
            false
          );

          const messageToCreate = await messagesHelper.mapMessageProps(message);

          const response: APIResponse<MessagesController['create']> =
            await request(app.getHttpServer())
              .post(`${route}`)
              .send(messageToCreate);
          expect(response.status).toBe(201);
          expect(response.body).toEqual(expect.objectContaining(message));
        });
        it('Should return 200 when message with missing optional fields and message is for candidate', async () => {
          const message = await messageFactory.create(
            { UserId: candidate.id },
            false
          );

          const { phone, type, ...messageToCreate } =
            await messagesHelper.mapMessageProps(message);

          const response: APIResponse<MessagesController['create']> =
            await request(app.getHttpServer())
              .post(`${route}`)
              .send(messageToCreate);
          expect(response.status).toBe(201);
          expect(response.body).toEqual(
            expect.objectContaining({
              ...message,
              phone: null,
              type: null,
            })
          );
        });
        it('Should return 400 when message has missing fields', async () => {
          const message = await messageFactory.create(
            { UserId: candidate.id },
            false
          );

          const { firstName, lastName, ...messageToCreate } =
            await messagesHelper.mapMessageProps(message);

          const response: APIResponse<MessagesController['create']> =
            await request(app.getHttpServer())
              .post(`${route}`)
              .send(messageToCreate);
          expect(response.status).toBe(400);
        });
        it('Should return 400 when message has invalid phone number', async () => {
          const message = await messageFactory.create(
            { UserId: candidate.id },
            false
          );

          const messageToCreate = await messagesHelper.mapMessageProps(message);

          const response: APIResponse<MessagesController['create']> =
            await request(app.getHttpServer())
              .post(`${route}`)
              .send({ ...messageToCreate, phone: '1234' });
          expect(response.status).toBe(400);
        });
        it('Should return 400 when message is for coach', async () => {
          const message = await messageFactory.create(
            { UserId: coach.id },
            false
          );

          const messageToCreate = await messagesHelper.mapMessageProps(message);

          const response: APIResponse<MessagesController['create']> =
            await request(app.getHttpServer())
              .post(`${route}`)
              .send(messageToCreate);
          expect(response.status).toBe(400);
        });
        it('Should return 400 when message is for admin', async () => {
          const message = await messageFactory.create(
            { UserId: admin.id },
            false
          );

          const messageToCreate = await messagesHelper.mapMessageProps(message);

          const response: APIResponse<MessagesController['create']> =
            await request(app.getHttpServer())
              .post(`${route}`)
              .send(messageToCreate);
          expect(response.status).toBe(400);
        });
      });
    });
  });
});
