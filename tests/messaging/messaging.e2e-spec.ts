import { getQueueToken } from '@nestjs/bull';
import { CACHE_MANAGER, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { UsersHelper } from '../users/users.helper';
import { LoggedUser } from 'src/auth/auth.types';
import { SlackService } from 'src/external-services/slack/slack.service';
import { MessagingController } from 'src/messaging/messaging.controller';
import { Queues } from 'src/queues/queues.types';
import { User } from 'src/users/models';
import { UserRoles } from 'src/users/users.types';
import { APIResponse } from 'src/utils/types';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import { CacheMocks, QueueMocks, SlackMocks } from 'tests/mocks.types';
import { UserFactory } from 'tests/users/user.factory';
import { ConversationFactory } from './conversation.factory';
import { MessagingHelper } from './messaging.helper';

// Configuration
const NB_CONVERSATIONS = 3;

describe('MESSAGING', () => {
  let app: INestApplication;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let server: any;

  let databaseHelper: DatabaseHelper;
  let messagingHelper: MessagingHelper;
  let usersHelper: UsersHelper;
  let conversationFactory: ConversationFactory;
  let userFactory: UserFactory;
  let loggedInCandidate: LoggedUser;
  let loggedInOtherCandidate: LoggedUser;
  let coachs: User[];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [CustomTestingModule],
    })
      .overrideProvider(getQueueToken(Queues.WORK))
      .useValue(QueueMocks)
      .overrideProvider(CACHE_MANAGER)
      .useValue(CacheMocks)
      .overrideProvider(SlackService)
      .useValue(SlackMocks)
      .compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    server = app.getHttpServer();

    databaseHelper = moduleFixture.get<DatabaseHelper>(DatabaseHelper);
    usersHelper = moduleFixture.get<UsersHelper>(UsersHelper);
    messagingHelper = moduleFixture.get<MessagingHelper>(MessagingHelper);
    conversationFactory =
      moduleFixture.get<ConversationFactory>(ConversationFactory);
    userFactory = moduleFixture.get<UserFactory>(UserFactory);
  });

  afterAll(async () => {
    await app.close();
    server.close();
  });

  beforeEach(async () => {
    // Create the logged in candidate
    loggedInCandidate = await usersHelper.createLoggedInUser({
      role: UserRoles.CANDIDATE,
    });

    loggedInOtherCandidate = await usersHelper.createLoggedInUser({
      role: UserRoles.CANDIDATE,
    });

    // Create the coach used for the conversations
    coachs = await databaseHelper.createEntities(userFactory, NB_CONVERSATIONS);
  });

  afterEach(async () => {
    await databaseHelper.resetTestDB();
  });

  /**
   * CRUD Messages
   */
  describe('CRUD Messages', () => {
    describe('C - Create Messages - /messaging/messages', () => {
      it('should not create a conversation if a conversation between coach and candidate already exists', async () => {
        // Create the conversation
        const conversation = await conversationFactory.create();

        await messagingHelper.associationParticipantsToConversation(
          conversation.id,
          [loggedInCandidate.user.id, coachs[0].id]
        );
        const nbConversationBefore = await messagingHelper.countConversation();

        const response: APIResponse<MessagingController['postMessage']> =
          await request(server)
            .post(`/messaging/messages`)
            .send({
              content: 'Super message',
              conversationId: conversation.id,
            })
            .set('authorization', `Bearer ${loggedInCandidate.token}`);
        const nbConversation = await messagingHelper.countConversation();
        expect(response.status).toBe(201);
        expect(nbConversation).toBe(nbConversationBefore);
        expect(nbConversation).toBe(1);
      });

      it('should create a message in the conversation', async () => {
        // Create the conversation
        let conversation = await conversationFactory.create();

        await messagingHelper.associationParticipantsToConversation(
          conversation.id,
          [loggedInCandidate.user.id, coachs[0].id]
        );

        const response: APIResponse<MessagingController['postMessage']> =
          await request(server)
            .post(`/messaging/messages`)
            .send({
              content: 'Super message',
              conversationId: conversation.id,
            })
            .set('authorization', `Bearer ${loggedInCandidate.token}`);

        conversation = await messagingHelper.findConversation(conversation.id);
        expect(response.status).toBe(201);
        expect(conversation.messages.length).toBe(1);
      });

      it('should return 401 if the user is not a participant of the conversation', async () => {
        // Create the conversation
        const conversation = await conversationFactory.create();

        await messagingHelper.associationParticipantsToConversation(
          conversation.id,
          [loggedInOtherCandidate.user.id, coachs[0].id]
        );

        const response: APIResponse<MessagingController['postMessage']> =
          await request(server)
            .post(`/messaging/messages`)
            .send({
              content: 'Super message',
              conversationId: conversation.id,
            })
            .set('authorization', `Bearer ${loggedInCandidate.token}`);

        expect(response.status).toBe(401);
      });

      it('should return 400 if neither the participantIds nor the conversationId is provided', async () => {
        const response: APIResponse<MessagingController['postMessage']> =
          await request(server)
            .post(`/messaging/messages`)
            .send({
              content: 'Super message',
            })
            .set('authorization', `Bearer ${loggedInCandidate.token}`);
        expect(response.status).toBe(400);
      });

      it('should return 400 when the message is empty', async () => {
        // Create the conversation
        const conversation = await conversationFactory.create();

        await messagingHelper.associationParticipantsToConversation(
          conversation.id,
          [loggedInCandidate.user.id, coachs[0].id]
        );

        const response: APIResponse<MessagingController['postMessage']> =
          await request(server)
            .post(`/messaging/messages`)
            .send({
              conversationId: conversation.id,
              content: '',
            })
            .set('authorization', `Bearer ${loggedInCandidate.token}`);
        expect(response.status).toBe(400);
      });

      it('shoud return 201 when a message is sent by a coach', async () => {
        // Create the conversation
        const conversation = await conversationFactory.create();
        const loggedInCoach = await usersHelper.createLoggedInUser({
          role: UserRoles.COACH,
        });

        await messagingHelper.associationParticipantsToConversation(
          conversation.id,
          [loggedInCandidate.user.id, loggedInCoach.user.id]
        );

        const response: APIResponse<MessagingController['postMessage']> =
          await request(server)
            .post(`/messaging/messages`)
            .send({
              content: 'Super message',
              conversationId: conversation.id,
            })
            .set('authorization', `Bearer ${loggedInCoach.token}`);
        expect(response.status).toBe(201);
      });
    });
  });

  /**
   * CRUD Conversations
   */
  describe('CRUD Conversations', () => {
    describe('C - Create conversations - /messaging/messages', () => {
      it('should create a conversation if no conversation between coach and candidate doesn t exists', async () => {
        const response: APIResponse<MessagingController['postMessage']> =
          await request(server)
            .post(`/messaging/messages`)
            .send({
              content: 'Super message',
              participantIds: [coachs[0].id],
            })
            .set('authorization', `Bearer ${loggedInCandidate.token}`);
        const nbConversation = await messagingHelper.countConversation();
        expect(response.status).toBe(201);
        expect(nbConversation).toBe(1);
      });
    });

    describe('R - Read conversations - /messaging/conversations/?query=', () => {
      beforeEach(async () => {
        // Create the conversations
        const conversations = await databaseHelper.createEntities(
          conversationFactory,
          NB_CONVERSATIONS
        );
        // And link the conversations to the coachs and the logged in candidate
        const linkPromises = conversations.map((conversation, idx) =>
          messagingHelper.associationParticipantsToConversation(
            conversation.id,
            [loggedInCandidate.user.id, coachs[idx].id]
          )
        );
        await Promise.all(linkPromises);

        // Add messages to the conversations
        const messagePromises = conversations.map((conversation) =>
          messagingHelper.addMessagesToConversation(
            2,
            conversation.id,
            loggedInCandidate.user.id
          )
        );

        await Promise.all(messagePromises);
      });

      it('should return all results when no query provided', async () => {
        const response: APIResponse<MessagingController['getConversations']> =
          await request(server)
            .get(`/messaging/conversations`)
            .set('authorization', `Bearer ${loggedInCandidate.token}`);

        expect(response.status).toBe(200);
        expect(response.body.length).toBe(NB_CONVERSATIONS);
      });

      it('should return only the conversations matching the query (by the firstname)', async () => {
        const response: APIResponse<MessagingController['getConversations']> =
          await request(server)
            .get(`/messaging/conversations?query=${coachs[0].firstName}`)
            .set('authorization', `Bearer ${loggedInCandidate.token}`);

        expect(response.status).toBe(200);
        expect(response.body.length).toBe(1);
      });

      it('should return only the conversations matching the query (by the lastname)', async () => {
        const response: APIResponse<MessagingController['getConversations']> =
          await request(server)
            .get(`/messaging/conversations?query=${coachs[0].lastName}`)
            .set('authorization', `Bearer ${loggedInCandidate.token}`);

        expect(response.status).toBe(200);
        expect(response.body.length).toBe(1);
      });

      it('should return an empty array if no conversation match the query', async () => {
        const response: APIResponse<MessagingController['getConversations']> =
          await request(server)
            .get(`/messaging/conversations?query=abracadabra`)
            .set('authorization', `Bearer ${loggedInCandidate.token}`);

        expect(response.status).toBe(200);
        expect(response.body.length).toBe(0);
      });

      it('should return 401 if no token provided', async () => {
        const response = await request(server).get(`/messaging/conversations`);

        expect(response.status).toBe(401);
      });

      it('should not return conversation from other users', async () => {
        const response: APIResponse<MessagingController['getConversations']> =
          await request(server)
            .get(`/messaging/conversations`)
            .set('authorization', `Bearer ${loggedInOtherCandidate.token}`);

        expect(response.status).toBe(200);
        expect(response.body.length).toBe(0);
      });

      it('should return 401 if the user is not logged in', async () => {
        const response = await request(server).get(`/messaging/conversations`);

        expect(response.status).toBe(401);
      });
    });

    describe('R - Read conversation - /messaging/conversations/:id', () => {
      it('should return the conversation (conversation without message)', async () => {
        const conversation = await conversationFactory.create();

        await messagingHelper.associationParticipantsToConversation(
          conversation.id,
          [loggedInCandidate.user.id, coachs[0].id]
        );

        const response: APIResponse<MessagingController['getConversation']> =
          await request(server)
            .get(`/messaging/conversations/${conversation.id}`)
            .set('authorization', `Bearer ${loggedInCandidate.token}`);

        expect(response.status).toBe(200);
        expect(response.body.id).toBe(conversation.id);
        expect(response.body.messages.length).toBe(0);
      });

      it('should return the conversation (conversation with messages)', async () => {
        const conversation = await conversationFactory.create();

        await messagingHelper.associationParticipantsToConversation(
          conversation.id,
          [loggedInCandidate.user.id, coachs[0].id]
        );

        await messagingHelper.addMessagesToConversation(
          2,
          conversation.id,
          loggedInCandidate.user.id
        );

        const response: APIResponse<MessagingController['getConversation']> =
          await request(server)
            .get(`/messaging/conversations/${conversation.id}`)
            .set('authorization', `Bearer ${loggedInCandidate.token}`);

        expect(response.status).toBe(200);
        expect(response.body.id).toBe(conversation.id);
        expect(response.body.messages.length).toBe(2);
      });

      it('should return the conversation only with the messages in the conversation', async () => {
        const conversation = await conversationFactory.create();
        const secondConversation = await conversationFactory.create();

        await messagingHelper.associationParticipantsToConversation(
          conversation.id,
          [loggedInCandidate.user.id, coachs[0].id]
        );
        await messagingHelper.associationParticipantsToConversation(
          secondConversation.id,
          [loggedInCandidate.user.id, coachs[1].id]
        );

        await messagingHelper.addMessagesToConversation(
          2,
          conversation.id,
          loggedInCandidate.user.id
        );
        await messagingHelper.addMessagesToConversation(
          5,
          secondConversation.id,
          coachs[1].id
        );

        const response: APIResponse<MessagingController['getConversation']> =
          await request(server)
            .get(`/messaging/conversations/${conversation.id}`)
            .set('authorization', `Bearer ${loggedInCandidate.token}`);

        expect(response.status).toBe(200);
        expect(response.body.id).toBe(conversation.id);
        expect(response.body.messages.length).toBe(2);
      });

      it('should return 401 if the user is not a participant of the conversation', async () => {
        const conversation = await conversationFactory.create();

        await messagingHelper.associationParticipantsToConversation(
          conversation.id,
          [loggedInOtherCandidate.user.id, coachs[0].id]
        );

        const response: APIResponse<MessagingController['getConversation']> =
          await request(server)
            .get(`/messaging/conversations/${conversation.id}`)
            .set('authorization', `Bearer ${loggedInCandidate.token}`);

        expect(response.status).toBe(401);
      });

      it('should return 401 if the user is not logged in', async () => {
        const conversation = await conversationFactory.create();

        await messagingHelper.associationParticipantsToConversation(
          conversation.id,
          [loggedInCandidate.user.id, coachs[0].id]
        );

        const response = await request(server).get(
          `/messaging/conversations/${conversation.id}`
        );

        expect(response.status).toBe(401);
      });
    });
  });

  /**
   * CRUD - Report
   */
  describe('CRUD - Report', () => {
    it('should report a conversation', async () => {
      const conversation = await conversationFactory.create();

      await messagingHelper.associationParticipantsToConversation(
        conversation.id,
        [loggedInCandidate.user.id, coachs[0].id]
      );

      const response: APIResponse<MessagingController['reportMessageAbuse']> =
        await request(server)
          .post(`/messaging/conversations/${conversation.id}/report`)
          .set('authorization', `Bearer ${loggedInCandidate.token}`)
          .send({
            reason: 'SPAM',
            comment: 'Cette personne fait du spam',
          });

      expect(response.status).toBe(201);
    });

    it('should return 401 if the user is not a participant of the conversation', async () => {
      const conversation = await conversationFactory.create();

      await messagingHelper.associationParticipantsToConversation(
        conversation.id,
        [loggedInOtherCandidate.user.id, coachs[0].id]
      );

      const response: APIResponse<MessagingController['reportMessageAbuse']> =
        await request(server)
          .post(`/messaging/conversations/${conversation.id}/report`)
          .set('authorization', `Bearer ${loggedInCandidate.token}`)
          .send({
            reason: 'SPAM',
            comment: 'Cette personne fait du spam',
          });

      expect(response.status).toBe(401);
    });

    it('should return 400 if the comment is not provided', async () => {
      const conversation = await conversationFactory.create();

      await messagingHelper.associationParticipantsToConversation(
        conversation.id,
        [loggedInCandidate.user.id, coachs[0].id]
      );

      const response: APIResponse<MessagingController['reportMessageAbuse']> =
        await request(server)
          .post(`/messaging/conversations/${conversation.id}/report`)
          .set('authorization', `Bearer ${loggedInCandidate.token}`)
          .send({
            reason: 'SPAM',
          });

      expect(response.status).toBe(400);
    });
  });
});
