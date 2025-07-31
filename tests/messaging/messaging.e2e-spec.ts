import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { UsersHelper } from '../users/users.helper';
import { LoggedUser } from 'src/auth/auth.types';
import { SlackService } from 'src/external-services/slack/slack.service';
import { MessagingController } from 'src/messaging/messaging.controller';
import { QueuesService } from 'src/queues/producers/queues.service';
import { User } from 'src/users/models';
import { UserRoles } from 'src/users/users.types';
import { APIResponse } from 'src/utils/types';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import { SlackMocks } from 'tests/mocks.types';
import { QueuesServiceMock } from 'tests/queues/queues.service.mock';
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
  let loggedInCoach: LoggedUser;
  let loggedInReferer: LoggedUser;
  let loggedInOtherCandidate: LoggedUser;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [CustomTestingModule],
    })
      .overrideProvider(QueuesService)
      .useClass(QueuesServiceMock)
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
    loggedInCoach = await usersHelper.createLoggedInUser({
      role: UserRoles.COACH,
    });
    loggedInReferer = await usersHelper.createLoggedInUser({
      role: UserRoles.REFERER,
    });

    loggedInOtherCandidate = await usersHelper.createLoggedInUser({
      role: UserRoles.CANDIDATE,
    });
  });

  afterEach(async () => {
    await databaseHelper.resetTestDB();
  });

  /**
   * CRUD Messages
   */
  describe('CRUD Messages', () => {
    describe('C - Create Messages - /messaging/messages', () => {
      it('should return 201 but not create a conversation if a conversation between coach and candidate already exists', async () => {
        // Create the conversation
        const conversation = await conversationFactory.create();

        await messagingHelper.associationParticipantsToConversation(
          conversation.id,
          [loggedInCandidate.user.id, loggedInCoach.user.id]
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

      it('should return 201 but not create a conversation if a conversation between referer and candidate already exists', async () => {
        // Create the conversation
        const conversation = await conversationFactory.create();

        await messagingHelper.associationParticipantsToConversation(
          conversation.id,
          [loggedInCandidate.user.id, loggedInReferer.user.id]
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

      it('should return 201 and create a message in the conversation between candidate and coach (sent by candidate)', async () => {
        // Create the conversation
        let conversation = await conversationFactory.create();

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
            .set('authorization', `Bearer ${loggedInCandidate.token}`);

        conversation = await messagingHelper.findConversation(conversation.id);

        expect(response.status).toBe(201);
        expect(conversation.messages.length).toBe(1);
      });

      it('should return 201 and create a message in the conversation between candidate and coach (sent by coach)', async () => {
        // Create the conversation
        let conversation = await conversationFactory.create();

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

        conversation = await messagingHelper.findConversation(conversation.id);
        expect(response.status).toBe(201);
        expect(conversation.messages.length).toBe(1);
      });

      it('should return 201 and create a message in the conversation between candidate and referer (sent by candidate)', async () => {
        // Create the conversation
        let conversation = await conversationFactory.create();

        await messagingHelper.associationParticipantsToConversation(
          conversation.id,
          [loggedInCandidate.user.id, loggedInReferer.user.id]
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

      it('should return 201 and create a message in the conversation between candidate and referer (sent by referer)', async () => {
        // Create the conversation
        let conversation = await conversationFactory.create();

        await messagingHelper.associationParticipantsToConversation(
          conversation.id,
          [loggedInCandidate.user.id, loggedInReferer.user.id]
        );

        const response: APIResponse<MessagingController['postMessage']> =
          await request(server)
            .post(`/messaging/messages`)
            .send({
              content: 'Super message',
              conversationId: conversation.id,
            })
            .set('authorization', `Bearer ${loggedInReferer.token}`);

        conversation = await messagingHelper.findConversation(conversation.id);
        expect(response.status).toBe(201);
        expect(conversation.messages.length).toBe(1);
      });

      it('should return 201 and create a message in the conversation between coach and referer (sent by coach)', async () => {
        // Create the conversation
        let conversation = await conversationFactory.create();

        await messagingHelper.associationParticipantsToConversation(
          conversation.id,
          [loggedInCoach.user.id, loggedInReferer.user.id]
        );

        const response: APIResponse<MessagingController['postMessage']> =
          await request(server)
            .post(`/messaging/messages`)
            .send({
              content: 'Super message',
              conversationId: conversation.id,
            })
            .set('authorization', `Bearer ${loggedInCoach.token}`);

        conversation = await messagingHelper.findConversation(conversation.id);
        expect(response.status).toBe(201);
        expect(conversation.messages.length).toBe(1);
      });

      it('should return 201 and create a message in the conversation between coach and referer (sent by referer)', async () => {
        // Create the conversation
        let conversation = await conversationFactory.create();

        await messagingHelper.associationParticipantsToConversation(
          conversation.id,
          [loggedInCoach.user.id, loggedInReferer.user.id]
        );

        const response: APIResponse<MessagingController['postMessage']> =
          await request(server)
            .post(`/messaging/messages`)
            .send({
              content: 'Super message',
              conversationId: conversation.id,
            })
            .set('authorization', `Bearer ${loggedInReferer.token}`);

        conversation = await messagingHelper.findConversation(conversation.id);
        expect(response.status).toBe(201);
        expect(conversation.messages.length).toBe(1);
      });

      it('should return 401 if the user is not a participant of the conversation', async () => {
        // Create the conversation
        const conversation = await conversationFactory.create();

        await messagingHelper.associationParticipantsToConversation(
          conversation.id,
          [loggedInOtherCandidate.user.id, loggedInCoach.user.id]
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
          [loggedInCandidate.user.id, loggedInCoach.user.id]
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

      it('should return 429 when create an 8th conversation', async () => {
        // Create the coachs
        const coachs = await databaseHelper.createEntities(userFactory, 7, {
          role: UserRoles.COACH,
        });

        // Create the conversations
        const conversations = await databaseHelper.createEntities(
          conversationFactory,
          7
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

        const response: APIResponse<MessagingController['postMessage']> =
          await request(server)
            .post(`/messaging/messages`)
            .send({
              content: 'Super message',
              participantIds: [loggedInCoach.user.id],
            })
            .set('authorization', `Bearer ${loggedInCandidate.token}`);
        expect(response.status).toBe(429);
      });

      it('should return 201 when create a 7th conversation', async () => {
        // Create the coachs
        const coachs = await databaseHelper.createEntities(userFactory, 6, {
          role: UserRoles.COACH,
        });

        // Create the conversations
        const conversations = await databaseHelper.createEntities(
          conversationFactory,
          6
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

        const response: APIResponse<MessagingController['postMessage']> =
          await request(server)
            .post(`/messaging/messages`)
            .send({
              content: 'Super message',
              participantIds: [loggedInCoach.user.id],
            })
            .set('authorization', `Bearer ${loggedInCandidate.token}`);
        expect(response.status).toBe(201);
      });
    });
  });

  /**
   * CRUD Conversations
   */
  describe('CRUD Conversations', () => {
    describe('C - Create conversations - /messaging/messages', () => {
      it('should return 201 and create a conversation if no conversation between coach and candidate doesn t exists (initiated by Candidate)', async () => {
        const response: APIResponse<MessagingController['postMessage']> =
          await request(server)
            .post(`/messaging/messages`)
            .send({
              content: 'Super message',
              participantIds: [loggedInCoach.user.id],
            })
            .set('authorization', `Bearer ${loggedInCandidate.token}`);
        const nbConversation = await messagingHelper.countConversation();
        expect(response.status).toBe(201);
        expect(nbConversation).toBe(1);
      });

      it('should return 201 and create a conversation if no conversation between coach and candidate doesn t exists (initiated by Coach)', async () => {
        const response: APIResponse<MessagingController['postMessage']> =
          await request(server)
            .post(`/messaging/messages`)
            .send({
              content: 'Super message',
              participantIds: [loggedInCandidate.user.id],
            })
            .set('authorization', `Bearer ${loggedInCoach.token}`);
        const nbConversation = await messagingHelper.countConversation();
        expect(response.status).toBe(201);
        expect(nbConversation).toBe(1);
      });

      it('should return 201 and create a conversation if no conversation between coach and referer doesn t exists (initiated by Referer)', async () => {
        const response: APIResponse<MessagingController['postMessage']> =
          await request(server)
            .post(`/messaging/messages`)
            .send({
              content: 'Super message',
              participantIds: [loggedInCoach.user.id],
            })
            .set('authorization', `Bearer ${loggedInReferer.token}`);
        const nbConversation = await messagingHelper.countConversation();
        expect(response.status).toBe(201);
        expect(nbConversation).toBe(1);
      });

      it('should return 201 and create a conversation if no conversation between coach and referer doesn t exists (initiated by Coach)', async () => {
        const response: APIResponse<MessagingController['postMessage']> =
          await request(server)
            .post(`/messaging/messages`)
            .send({
              content: 'Super message',
              participantIds: [loggedInReferer.user.id],
            })
            .set('authorization', `Bearer ${loggedInCoach.token}`);
        const nbConversation = await messagingHelper.countConversation();
        expect(response.status).toBe(201);
        expect(nbConversation).toBe(1);
      });

      it('should return 201 and create a conversation if no conversation between candidate and referer doesn t exists (initiated by Candidate)', async () => {
        const response: APIResponse<MessagingController['postMessage']> =
          await request(server)
            .post(`/messaging/messages`)
            .send({
              content: 'Super message',
              participantIds: [loggedInCandidate.user.id],
            })
            .set('authorization', `Bearer ${loggedInReferer.token}`);
        const nbConversation = await messagingHelper.countConversation();
        expect(response.status).toBe(201);
        expect(nbConversation).toBe(1);
      });

      it('should return 201 and create a conversation if no conversation between candidate and referer doesn t exists (initiated by Referer)', async () => {
        const response: APIResponse<MessagingController['postMessage']> =
          await request(server)
            .post(`/messaging/messages`)
            .send({
              content: 'Super message',
              participantIds: [loggedInCandidate.user.id],
            })
            .set('authorization', `Bearer ${loggedInReferer.token}`);
        const nbConversation = await messagingHelper.countConversation();
        expect(response.status).toBe(201);
        expect(nbConversation).toBe(1);
      });

      it('should return 201 and create a conversation if no conversation between candidate and referer doesn t exists (initiated by Candidate)', async () => {
        const response: APIResponse<MessagingController['postMessage']> =
          await request(server)
            .post(`/messaging/messages`)
            .send({
              content: 'Super message',
              participantIds: [loggedInReferer.user.id],
            })
            .set('authorization', `Bearer ${loggedInCandidate.token}`);
        const nbConversation = await messagingHelper.countConversation();
        expect(response.status).toBe(201);
        expect(nbConversation).toBe(1);
      });
    });

    describe('R - Read conversations', () => {
      let coachs: User[];
      beforeEach(async () => {
        coachs = await databaseHelper.createEntities(
          userFactory,
          NB_CONVERSATIONS,
          {
            role: UserRoles.COACH,
          }
        );
      });

      describe('R - Read conversations - /messaging/conversations', () => {
        it('should return 401 if no token provided', async () => {
          const response = await request(server).get(
            `/messaging/conversations`
          );
          expect(response.status).toBe(401);
        });

        describe('Contexte : 1 Candidate -> Coach (x NB_CONVERSATIONS)', () => {
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

          it('should return 200 and all conversations when logged as candidate', async () => {
            const response: APIResponse<
              MessagingController['getConversations']
            > = await request(server)
              .get(`/messaging/conversations`)
              .set('authorization', `Bearer ${loggedInCandidate.token}`);

            expect(response.status).toBe(200);
            expect(response.body.length).toBe(NB_CONVERSATIONS);
          });

          it('should not return conversation from other users', async () => {
            const response: APIResponse<
              MessagingController['getConversations']
            > = await request(server)
              .get(`/messaging/conversations`)
              .set('authorization', `Bearer ${loggedInOtherCandidate.token}`);

            expect(response.status).toBe(200);
            expect(response.body.length).toBe(0);
          });
        });

        describe('Contexte : 1 Candidate -> 1 Coach', () => {
          it('should return 200 and all conversations when logged as coach', async () => {
            const conversation = await conversationFactory.create();
            messagingHelper.associationParticipantsToConversation(
              conversation.id,
              [loggedInCandidate.user.id, loggedInCoach.user.id]
            );

            const response: APIResponse<
              MessagingController['getConversations']
            > = await request(server)
              .get(`/messaging/conversations`)
              .set('authorization', `Bearer ${loggedInCoach.token}`);

            expect(response.status).toBe(200);
            expect(response.body.length).toBe(1);
          });
        });

        describe('Contexte : 1 Candidate -> 1 Referer', () => {
          it('should return 200 and all conversations when logged as referer', async () => {
            const conversation = await conversationFactory.create();
            messagingHelper.associationParticipantsToConversation(
              conversation.id,
              [loggedInCandidate.user.id, loggedInReferer.user.id]
            );

            const response: APIResponse<
              MessagingController['getConversations']
            > = await request(server)
              .get(`/messaging/conversations`)
              .set('authorization', `Bearer ${loggedInReferer.token}`);

            expect(response.status).toBe(200);
            expect(response.body.length).toBe(1);
          });
        });
      });

      describe('R - Read conversation - /messaging/conversations/:id', () => {
        it('should return the conversation (conversation without message)', async () => {
          const conversation = await conversationFactory.create();

          await messagingHelper.associationParticipantsToConversation(
            conversation.id,
            [loggedInCandidate.user.id, loggedInCoach.user.id]
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
            [loggedInCandidate.user.id, loggedInCoach.user.id]
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
            [loggedInOtherCandidate.user.id, loggedInCoach.user.id]
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
            [loggedInCandidate.user.id, loggedInCoach.user.id]
          );

          const response = await request(server).get(
            `/messaging/conversations/${conversation.id}`
          );

          expect(response.status).toBe(401);
        });
      });
    });
  });

  /**
   * CRUD - Report
   */
  describe('CRUD - Report', () => {
    it('should 201 when a candidate report a conversation', async () => {
      const conversation = await conversationFactory.create();

      await messagingHelper.associationParticipantsToConversation(
        conversation.id,
        [loggedInCandidate.user.id, loggedInCoach.user.id]
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

    it('should 201 when a coach report a conversation', async () => {
      const conversation = await conversationFactory.create();

      await messagingHelper.associationParticipantsToConversation(
        conversation.id,
        [loggedInCandidate.user.id, loggedInCoach.user.id]
      );

      const response: APIResponse<MessagingController['reportMessageAbuse']> =
        await request(server)
          .post(`/messaging/conversations/${conversation.id}/report`)
          .set('authorization', `Bearer ${loggedInCoach.token}`)
          .send({
            reason: 'SPAM',
            comment: 'Cette personne fait du spam',
          });

      expect(response.status).toBe(201);
    });

    it('should 201 when a referer report a conversation', async () => {
      const conversation = await conversationFactory.create();

      await messagingHelper.associationParticipantsToConversation(
        conversation.id,
        [loggedInCandidate.user.id, loggedInReferer.user.id]
      );

      const response: APIResponse<MessagingController['reportMessageAbuse']> =
        await request(server)
          .post(`/messaging/conversations/${conversation.id}/report`)
          .set('authorization', `Bearer ${loggedInReferer.token}`)
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
        [loggedInOtherCandidate.user.id, loggedInCoach.user.id]
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
        [loggedInCandidate.user.id, loggedInCoach.user.id]
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
