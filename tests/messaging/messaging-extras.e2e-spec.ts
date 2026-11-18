import { randomUUID } from 'crypto';
import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/sequelize';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { LoggedInUser, UsersHelper } from '../users/users.helper';
import { S3Service } from 'src/external-services/aws/s3.service';
import { SlackService } from 'src/external-services/slack/slack.service';
import { MediasService } from 'src/medias/medias.service';
import { MessagingService } from 'src/messaging/messaging.service';
import { encodeMessageCursor } from 'src/messaging/messaging.utils';
import { Message } from 'src/messaging/models';
import { QueuesService } from 'src/queues/producers/queues.service';
import { Jobs } from 'src/queues/queues.types';
import { User } from 'src/users/models';
import { UserRoles } from 'src/users/users.types';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import { S3Mocks, SlackMocks } from 'tests/mocks.types';
import { QueuesServiceMock } from 'tests/queues/queues.service.mock';
import { ConversationFactory } from './conversation.factory';
import { MessagingHelper } from './messaging.helper';

// Complements tests/messaging/messaging.e2e-spec.ts: mailing lists, role checks of the
// conversation endpoints, attachments and the statistics/cron queries of MessagingService.
describe('MESSAGING - extras', () => {
  let app: INestApplication;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let server: any;

  let databaseHelper: DatabaseHelper;
  let messagingHelper: MessagingHelper;
  let usersHelper: UsersHelper;
  let conversationFactory: ConversationFactory;
  let messagingService: MessagingService;
  let mediasService: MediasService;
  let userModel: typeof User;
  let messageModel: typeof Message;

  let candidate: LoggedInUser;
  let coach: LoggedInUser;
  let referer: LoggedInUser;
  let admin: LoggedInUser;

  const daysAgo = (days: number) =>
    new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [CustomTestingModule],
    })
      .overrideProvider(QueuesService)
      .useClass(QueuesServiceMock)
      .overrideProvider(SlackService)
      .useValue(SlackMocks)
      .overrideProvider(S3Service)
      .useValue(S3Mocks)
      .compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    server = app.getHttpServer();

    messagingService = app.get(MessagingService);
    mediasService = app.get(MediasService);
    userModel = app.get(getModelToken(User));
    messageModel = app.get(getModelToken(Message));
    databaseHelper = moduleFixture.get(DatabaseHelper);
    usersHelper = moduleFixture.get(UsersHelper);
    messagingHelper = moduleFixture.get(MessagingHelper);
    conversationFactory = moduleFixture.get(ConversationFactory);
  });

  afterAll(async () => {
    await app.close();
    server.close();
  });

  beforeEach(async () => {
    candidate = await usersHelper.createLoggedInUser({
      role: UserRoles.CANDIDATE,
    });
    coach = await usersHelper.createLoggedInUser({ role: UserRoles.COACH });
    referer = await usersHelper.createLoggedInUser({ role: UserRoles.REFERER });
    admin = await usersHelper.createLoggedInUser({ role: UserRoles.ADMIN });
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await databaseHelper.resetTestDB();
  });

  const createConversationWith = async (userIds: string[]) => {
    const conversation = await conversationFactory.create();
    await messagingHelper.associationParticipantsToConversation(
      conversation.id,
      userIds
    );
    return conversation;
  };

  describe('POST /messaging/mailing-lists', () => {
    const body = (overrides: Record<string, unknown> = {}) => ({
      content: 'Bonjour {{firstName}} {{lastName}}',
      recipientEmails: [candidate.user.email, coach.user.email],
      ...overrides,
    });

    it('returns 401 for an anonymous user', async () => {
      const response = await request(server)
        .post('/messaging/mailing-lists')
        .send(body());
      expect(response.status).toBe(401);
    });

    it.each([
      ['candidate', () => candidate],
      ['coach', () => coach],
      ['referer', () => referer],
    ])('returns 403 for a %s', async (_role, getUser) => {
      const addToWorkQueue = jest.spyOn(
        QueuesServiceMock.prototype,
        'addToWorkQueue'
      );

      const response = await request(server)
        .post('/messaging/mailing-lists')
        .set('authorization', `Bearer ${getUser().token}`)
        .send(body());

      expect(response.status).toBe(403);
      expect(addToWorkQueue).not.toHaveBeenCalled();
    });

    it('queues one personalised message per recipient for an admin', async () => {
      const addToWorkQueue = jest.spyOn(
        QueuesServiceMock.prototype,
        'addToWorkQueue'
      );

      const response = await request(server)
        .post('/messaging/mailing-lists')
        .set('authorization', `Bearer ${admin.token}`)
        .send(body());

      expect(response.status).toBe(201);
      expect(addToWorkQueue).toHaveBeenCalledWith(
        Jobs.BULK_SEND_STAFF_MESSAGING_MESSAGE,
        {
          messages: [
            {
              addresseeEmail: candidate.user.email,
              message: `Bonjour ${candidate.user.firstName} ${candidate.user.lastName}`,
            },
            {
              addresseeEmail: coach.user.email,
              message: `Bonjour ${coach.user.firstName} ${coach.user.lastName}`,
            },
          ],
        }
      );
    });

    it('returns 400 when an email does not exist', async () => {
      const response = await request(server)
        .post('/messaging/mailing-lists')
        .set('authorization', `Bearer ${admin.token}`)
        .send(body({ recipientEmails: ['ghost@example.com'] }));

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('ghost@example.com');
    });

    it('returns 400 when a recipient is neither a candidate nor a coach', async () => {
      const response = await request(server)
        .post('/messaging/mailing-lists')
        .set('authorization', `Bearer ${admin.token}`)
        .send(body({ recipientEmails: [referer.user.email] }));

      expect(response.status).toBe(400);
      expect(response.body.message).toContain(referer.user.email);
    });

    it('returns 400 when the content uses an unknown variable', async () => {
      const response = await request(server)
        .post('/messaging/mailing-lists')
        .set('authorization', `Bearer ${admin.token}`)
        .send(body({ content: 'Salut {{unknown}}' }));

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('{{unknown}}');
    });

    it.each([
      ['an empty recipient list', { recipientEmails: [] }],
      ['an invalid email', { recipientEmails: ['not-an-email'] }],
      ['an unknown property', { extra: true }],
    ])('returns 400 for %s', async (_label, overrides) => {
      const response = await request(server)
        .post('/messaging/mailing-lists')
        .set('authorization', `Bearer ${admin.token}`)
        .send(body(overrides));

      expect(response.status).toBe(400);
    });
  });

  describe('Role checks on the conversation endpoints', () => {
    it('returns 401 for anonymous users on every endpoint', async () => {
      const conversation = await createConversationWith([
        candidate.user.id,
        coach.user.id,
      ]);
      const id = conversation.id;

      const requests = [
        () => request(server).get('/messaging/conversations/unseen-count'),
        () => request(server).post(`/messaging/conversations/${id}/archive`),
        () => request(server).post(`/messaging/conversations/${id}/unarchive`),
        () =>
          request(server).post(
            `/messaging/conversations/${id}/dismiss-ai-assistant-banner`
          ),
        () =>
          request(server)
            .post(`/messaging/conversations/${id}/report`)
            .send({ reason: 'SPAM' }),
        () =>
          request(server)
            .post('/messaging/messages')
            .send({ content: 'hello', conversationId: id }),
      ];
      const responses = [];
      for (const send of requests) {
        responses.push(await send());
      }

      responses.forEach((response) => expect(response.status).toBe(401));
    });

    it.each([
      ['candidate', () => candidate],
      ['coach', () => coach],
      ['referer', () => referer],
      ['admin', () => admin],
    ])('returns the unseen count for a %s', async (_role, getUser) => {
      const response = await request(server)
        .get('/messaging/conversations/unseen-count')
        .set('authorization', `Bearer ${getUser().token}`);

      expect(response.status).toBe(200);
      expect(response.text).toBe('0');
    });

    it.each([
      ['archive', 'post'],
      ['unarchive', 'post'],
      ['seen', 'post'],
      ['dismiss-ai-assistant-banner', 'post'],
    ])(
      'refuses %s to a user outside the conversation (referer, admin)',
      async (action) => {
        const conversation = await createConversationWith([
          candidate.user.id,
          coach.user.id,
        ]);

        for (const outsider of [referer, admin]) {
          const response = await request(server)
            .post(`/messaging/conversations/${conversation.id}/${action}`)
            .set('authorization', `Bearer ${outsider.token}`);
          expect(response.status).toBe(401);
        }
      }
    );

    it('refuses a report from a user outside the conversation', async () => {
      const conversation = await createConversationWith([
        candidate.user.id,
        coach.user.id,
      ]);

      for (const outsider of [referer, admin]) {
        const response = await request(server)
          .post(`/messaging/conversations/${conversation.id}/report`)
          .set('authorization', `Bearer ${outsider.token}`)
          .send({ reason: 'SPAM' });
        expect(response.status).toBe(401);
      }
    });

    it('returns 400 for a malformed cursor made of a valid base64 payload without separator', async () => {
      const conversation = await createConversationWith([
        candidate.user.id,
        coach.user.id,
      ]);

      const response = await request(server)
        .get(`/messaging/conversations/${conversation.id}`)
        .query({ before: Buffer.from('nonsense').toString('base64url') })
        .set('authorization', `Bearer ${candidate.token}`);

      expect(response.status).toBe(400);
    });

    it('returns 400 for a cursor whose id is not a UUID or whose date is invalid', async () => {
      const conversation = await createConversationWith([
        candidate.user.id,
        coach.user.id,
      ]);
      const badCursors = [
        encodeMessageCursor({
          createdAt: new Date(),
          id: 'not-a-uuid',
        }),
        Buffer.from(`not-a-date|${randomUUID()}`).toString('base64url'),
      ];

      for (const before of badCursors) {
        const response = await request(server)
          .get(`/messaging/conversations/${conversation.id}`)
          .query({ before })
          .set('authorization', `Bearer ${candidate.token}`);
        expect(response.status).toBe(400);
      }
    });
  });

  describe('POST /messaging/messages - validation and attachments', () => {
    it('returns 400 when an unknown property is sent', async () => {
      const response = await request(server)
        .post('/messaging/messages')
        .set('authorization', `Bearer ${candidate.token}`)
        .send({
          content: 'hello',
          participantIds: [coach.user.id],
          unexpected: 'x',
        });

      expect(response.status).toBe(400);
    });

    it('returns 400 when more than one participant id is sent', async () => {
      const response = await request(server)
        .post('/messaging/messages')
        .set('authorization', `Bearer ${candidate.token}`)
        .send({
          content: 'hello',
          participantIds: [coach.user.id, referer.user.id],
        });

      expect(response.status).toBe(400);
    });

    it('returns 400 when the only participant is the author', async () => {
      const response = await request(server)
        .post('/messaging/messages')
        .set('authorization', `Bearer ${candidate.token}`)
        .send({ content: 'hello', participantIds: [candidate.user.id] });

      expect(response.status).toBe(400);
    });

    it('stores uploaded attachments on the message', async () => {
      const conversation = await createConversationWith([
        candidate.user.id,
        coach.user.id,
      ]);

      const response = await request(server)
        .post('/messaging/messages')
        .set('authorization', `Bearer ${candidate.token}`)
        .field('content', 'Voici mon CV')
        .field('conversationId', conversation.id)
        .attach('files', Buffer.from('%PDF-1.4 fake'), {
          filename: 'cv.pdf',
          contentType: 'application/pdf',
        });

      expect(response.status).toBe(201);
      expect(S3Mocks.upload).toHaveBeenCalled();
      const stored = await messagingService.findOneMessage(response.body.id);
      expect(stored.medias).toHaveLength(1);
    });
  });

  describe('Message attachments lookup', () => {
    it('finds the signed medias of a conversation and of a message', async () => {
      const conversation = await createConversationWith([
        candidate.user.id,
        coach.user.id,
      ]);
      const upload = await request(server)
        .post('/messaging/messages')
        .set('authorization', `Bearer ${candidate.token}`)
        .field('content', 'Voici mes documents')
        .field('conversationId', conversation.id)
        .attach('files', Buffer.from('%PDF-1.4 a'), {
          filename: 'a.pdf',
          contentType: 'application/pdf',
        })
        .attach('files', Buffer.from('%PDF-1.4 b'), {
          filename: 'b.pdf',
          contentType: 'application/pdf',
        });
      expect(upload.status).toBe(201);

      const byConversation = await mediasService.findMediasByConversationId(
        conversation.id
      );
      const byMessage = await mediasService.findMediaByMessageId(
        upload.body.id
      );

      expect(byConversation).toHaveLength(2);
      expect(byMessage).toHaveLength(2);
      expect(byMessage.every(({ signedUrl }) => signedUrl === 'url')).toBe(
        true
      );
      expect(
        await mediasService.findMediasByConversationId(randomUUID())
      ).toEqual([]);
    });
  });

  describe('Statistics and cron queries', () => {
    it('getAverageDelayResponse returns null without conversation and the delay in days otherwise', async () => {
      expect(
        await messagingService.getAverageDelayResponse(coach.user.id)
      ).toBe(null);

      const conversation = await createConversationWith([
        candidate.user.id,
        coach.user.id,
      ]);
      const sentAt = daysAgo(5);
      await messagingHelper.createMessage(conversation.id, candidate.user.id, {
        createdAt: sentAt,
      });
      await messagingHelper.createMessage(conversation.id, coach.user.id, {
        createdAt: new Date(sentAt.getTime() + 2 * 24 * 60 * 60 * 1000),
      });

      expect(
        await messagingService.getAverageDelayResponse(coach.user.id)
      ).toBe(2);
      // The candidate never replied to a message of the coach
      expect(
        await messagingService.getAverageDelayResponse(candidate.user.id)
      ).toBe(null);
    });

    it('getResponseRate ignores conversations whose other participants are all deleted', async () => {
      const withDeleted = await createConversationWith([
        candidate.user.id,
        coach.user.id,
      ]);
      await messagingHelper.createMessage(withDeleted.id, coach.user.id);
      await userModel.destroy({ where: { id: coach.user.id } });

      expect(await messagingService.getResponseRate(candidate.user.id)).toBe(
        null
      );
    });

    it('getResponseRate computes the share of answered conversations', async () => {
      const otherCoach = await usersHelper.createLoggedInUser({
        role: UserRoles.COACH,
      });
      const answered = await createConversationWith([
        candidate.user.id,
        coach.user.id,
      ]);
      await messagingHelper.createMessage(answered.id, coach.user.id);
      await messagingHelper.createMessage(answered.id, candidate.user.id);
      const unanswered = await createConversationWith([
        candidate.user.id,
        otherCoach.user.id,
      ]);
      await messagingHelper.createMessage(unanswered.id, otherCoach.user.id);

      expect(await messagingService.getResponseRate(candidate.user.id)).toBe(
        50
      );
    });

    it('getConversationsReadyForLinkedInShareMail returns conversations whose third message is exactly N days old', async () => {
      const midday = (days: number) => {
        const date = new Date();
        date.setUTCDate(date.getUTCDate() - days);
        date.setUTCHours(12, 0, 0, 0);
        return date;
      };
      const ready = await createConversationWith([
        candidate.user.id,
        coach.user.id,
      ]);
      await messagingHelper.createMessage(ready.id, candidate.user.id, {
        createdAt: midday(6),
      });
      await messagingHelper.createMessage(ready.id, coach.user.id, {
        createdAt: midday(5),
      });
      await messagingHelper.createMessage(ready.id, candidate.user.id, {
        createdAt: midday(3),
      });

      const results =
        await messagingService.getConversationsReadyForLinkedInShareMail(3);

      expect(results.map(({ id }) => id)).toEqual([ready.id]);
      expect(
        await messagingService.getConversationsReadyForLinkedInShareMail(2)
      ).toEqual([]);
    });

    it('getConversationMessagesForModeration returns null for an unknown conversation', async () => {
      expect(
        await messagingService.getConversationMessagesForModeration(
          randomUUID()
        )
      ).toBeNull();
    });

    it('getConversationMessagesForModeration pages the messages and hides deleted authors', async () => {
      const conversation = await createConversationWith([
        candidate.user.id,
        coach.user.id,
      ]);
      await messageModel.bulkCreate(
        Array.from({ length: 31 }, (_, index) => ({
          conversationId: conversation.id,
          authorId: index === 0 ? coach.user.id : candidate.user.id,
          content: `message ${index}`,
          createdAt: new Date(Date.now() - (60 - index) * 60 * 1000),
        }))
      );

      const firstPage =
        await messagingService.getConversationMessagesForModeration(
          conversation.id
        );
      expect(firstPage.messages).toHaveLength(30);
      expect(firstPage.nextCursor).not.toBeNull();

      await userModel.destroy({ where: { id: coach.user.id } });
      const oldest = firstPage.messages[firstPage.messages.length - 1];
      const secondPage =
        await messagingService.getConversationMessagesForModeration(
          conversation.id,
          { createdAt: new Date(oldest.createdAt), id: oldest.id }
        );

      expect(secondPage.messages).toHaveLength(1);
      expect(secondPage.messages[0].author).toBeNull();
      expect(secondPage.nextCursor).toBeNull();
    });
  });
});
