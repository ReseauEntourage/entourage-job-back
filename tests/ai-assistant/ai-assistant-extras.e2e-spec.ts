import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/sequelize';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
// Loaded before src/ai-assistant/* on purpose: importing the controller first
// triggers an import cycle through src/app.module.
import { CustomTestingModule } from '../custom-testing.module';
import { LoggedInUser, UsersHelper } from '../users/users.helper';
import { AiAssistantModule } from 'src/ai-assistant/ai-assistant.module';
import { AiAssistantMessage } from 'src/ai-assistant/models/ai-assistant-message.model';
import { AiAssistantSession } from 'src/ai-assistant/models/ai-assistant-session.model';
import { AnthropicService } from 'src/external-services/anthropic/anthropic.service';
import { SlackService } from 'src/external-services/slack/slack.service';
import { QueuesService } from 'src/queues/producers/queues.service';
import { REDIS_CLIENT } from 'src/redis/redis.module';
import { tracer } from 'src/tracer';
import { User } from 'src/users/models';
import { UserRoles } from 'src/users/users.types';
import { ZoneName } from 'src/utils/types/zones.types';
import { DatabaseHelper } from 'tests/database.helper';
import { ConversationFactory } from 'tests/messaging/conversation.factory';
import { MessagingHelper } from 'tests/messaging/messaging.helper';
import { SlackMocks } from 'tests/mocks.types';
import { QueuesServiceMock } from 'tests/queues/queues.service.mock';

const createFakeStream = (chunks: string[]) => ({
  async *[Symbol.asyncIterator]() {
    for (const text of chunks) {
      yield {
        type: 'content_block_delta',
        delta: { type: 'text_delta', text },
      };
    }
  },
  finalMessage: async () => ({
    stop_reason: 'end_turn',
    usage: { input_tokens: 10, output_tokens: 20 },
  }),
});

const parseSSEData = (body: string): unknown[] =>
  body
    .split('\n')
    .filter((line) => line.startsWith('data: '))
    .map((line) => {
      const payload = line.slice(6);
      try {
        return JSON.parse(payload);
      } catch {
        return payload;
      }
    });

// Complements tests/ai-assistant/ai-assistant.e2e-spec.ts: session read/reset, rate limit,
// suggestions, escalation and the role matrix of the three endpoints.
describe('AI ASSISTANT - extras', () => {
  let app: INestApplication;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let server: any;
  let databaseHelper: DatabaseHelper;
  let usersHelper: UsersHelper;
  let messagingHelper: MessagingHelper;
  let conversationFactory: ConversationFactory;
  let messageModel: typeof AiAssistantMessage;
  let sessionModel: typeof AiAssistantSession;
  let userModel: typeof User;
  let redisIncr: jest.Mock;

  let coach: LoggedInUser;
  let candidate: LoggedInUser;
  let referer: LoggedInUser;
  let admin: LoggedInUser;
  let outsider: LoggedInUser;
  let conversationId: string;

  const envBackup = { ...process.env };

  const anthropicServiceMock = {
    createStream: jest.fn(),
    generateText: jest.fn(),
  };

  const postStream = (token: string, id = conversationId) =>
    request(server)
      .post(`/ai-assistant/conversations/${id}/stream`)
      .send({ message: 'Propose-moi une réponse' })
      .set('authorization', `Bearer ${token}`)
      .buffer(true)
      .parse((res, callback) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk: string) => (data += chunk));
        res.on('end', () => callback(null, data));
      });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [CustomTestingModule, AiAssistantModule],
    })
      .overrideProvider(QueuesService)
      .useClass(QueuesServiceMock)
      .overrideProvider(SlackService)
      .useValue(SlackMocks)
      .overrideProvider(AnthropicService)
      .useValue(anthropicServiceMock)
      .compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    server = app.getHttpServer();

    const redis = app.get(REDIS_CLIENT);
    redisIncr = jest.fn().mockResolvedValue(1);
    redis.incr = redisIncr;
    redis.expire = jest.fn().mockResolvedValue(1);
    redis.ttl = jest.fn().mockResolvedValue(1800);

    databaseHelper = moduleFixture.get(DatabaseHelper);
    usersHelper = moduleFixture.get(UsersHelper);
    messagingHelper = moduleFixture.get(MessagingHelper);
    conversationFactory = moduleFixture.get(ConversationFactory);
    messageModel = moduleFixture.get(getModelToken(AiAssistantMessage));
    sessionModel = moduleFixture.get(getModelToken(AiAssistantSession));
    userModel = moduleFixture.get(getModelToken(User));
  });

  afterAll(async () => {
    await databaseHelper.resetTestDB();
    await app.close();
    server.close();
  });

  beforeEach(async () => {
    coach = await usersHelper.createLoggedInUser({ role: UserRoles.COACH });
    candidate = await usersHelper.createLoggedInUser({
      role: UserRoles.CANDIDATE,
      zone: ZoneName.IDF,
    });
    referer = await usersHelper.createLoggedInUser({ role: UserRoles.REFERER });
    admin = await usersHelper.createLoggedInUser({ role: UserRoles.ADMIN });
    outsider = await usersHelper.createLoggedInUser({ role: UserRoles.COACH });

    const conversation = await conversationFactory.create();
    conversationId = conversation.id;
    await messagingHelper.associationParticipantsToConversation(
      conversationId,
      [coach.user.id, candidate.user.id]
    );
    redisIncr.mockReset().mockResolvedValue(1);
    anthropicServiceMock.createStream.mockReset();
    anthropicServiceMock.generateText.mockReset().mockResolvedValue('NON');
  });

  afterEach(async () => {
    process.env = { ...envBackup };
    await databaseHelper.resetTestDB();
  });

  describe('GET /ai-assistant/conversations/:id/session', () => {
    it('returns 401 for an anonymous user', async () => {
      const response = await request(server).get(
        `/ai-assistant/conversations/${conversationId}/session`
      );
      expect(response.status).toBe(401);
    });

    it.each([
      ['referer', () => referer],
      ['admin', () => admin],
      ['coach outside the conversation', () => outsider],
    ])('returns 401 for a %s', async (_label, user) => {
      const response = await request(server)
        .get(`/ai-assistant/conversations/${conversationId}/session`)
        .set('authorization', `Bearer ${user().token}`);

      expect(response.status).toBe(401);
    });

    it('returns an empty session when the coach never used the assistant', async () => {
      const response = await request(server)
        .get(`/ai-assistant/conversations/${conversationId}/session`)
        .set('authorization', `Bearer ${coach.token}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ messages: [] });
    });

    it('returns the messages of the session of the current user only', async () => {
      anthropicServiceMock.createStream.mockReturnValue(
        createFakeStream(['Une réponse'])
      );
      await postStream(coach.token);

      const own = await request(server)
        .get(`/ai-assistant/conversations/${conversationId}/session`)
        .set('authorization', `Bearer ${coach.token}`);
      const candidateView = await request(server)
        .get(`/ai-assistant/conversations/${conversationId}/session`)
        .set('authorization', `Bearer ${candidate.token}`);

      expect(own.status).toBe(200);
      expect(
        own.body.messages.map(({ role }: { role: string }) => role)
      ).toEqual(['user', 'assistant']);
      expect(candidateView.body).toEqual({ messages: [] });
    });
  });

  describe('DELETE /ai-assistant/conversations/:id/session/messages', () => {
    it('returns 401 for an anonymous user', async () => {
      const response = await request(server).delete(
        `/ai-assistant/conversations/${conversationId}/session/messages`
      );
      expect(response.status).toBe(401);
    });

    it.each([
      ['referer', () => referer],
      ['admin', () => admin],
      ['coach outside the conversation', () => outsider],
    ])('returns 401 for a %s and keeps the messages', async (_label, user) => {
      anthropicServiceMock.createStream.mockReturnValue(
        createFakeStream(['Une réponse'])
      );
      await postStream(coach.token);

      const response = await request(server)
        .delete(
          `/ai-assistant/conversations/${conversationId}/session/messages`
        )
        .set('authorization', `Bearer ${user().token}`);

      expect(response.status).toBe(401);
      expect(await messageModel.count()).toBe(2);
    });

    it('returns 204 and clears the messages of the session of the coach', async () => {
      anthropicServiceMock.createStream.mockReturnValue(
        createFakeStream(['Une réponse'])
      );
      await postStream(coach.token);
      expect(await messageModel.count()).toBe(2);

      const response = await request(server)
        .delete(
          `/ai-assistant/conversations/${conversationId}/session/messages`
        )
        .set('authorization', `Bearer ${coach.token}`);

      expect(response.status).toBe(204);
      expect(await messageModel.count()).toBe(0);
      expect(await sessionModel.count()).toBe(1);
    });

    it('returns 204 when there is nothing to reset', async () => {
      const response = await request(server)
        .delete(
          `/ai-assistant/conversations/${conversationId}/session/messages`
        )
        .set('authorization', `Bearer ${coach.token}`);

      expect(response.status).toBe(204);
    });
  });

  describe('POST /ai-assistant/conversations/:id/stream', () => {
    it('returns 401 for an anonymous user, a referer and an admin outside the conversation', async () => {
      const anonymous = await request(server)
        .post(`/ai-assistant/conversations/${conversationId}/stream`)
        .send({ message: 'hello' });
      expect(anonymous.status).toBe(401);

      for (const user of [referer, admin]) {
        const response = await postStream(user.token);
        expect(response.status).toBe(401);
      }
      expect(anthropicServiceMock.createStream).not.toHaveBeenCalled();
    });

    it('returns 400 for an empty message', async () => {
      const response = await request(server)
        .post(`/ai-assistant/conversations/${conversationId}/stream`)
        .send({ message: '' })
        .set('authorization', `Bearer ${coach.token}`);

      expect(response.status).toBe(400);
    });

    describe('LLM Observability trace', () => {
      let traceSpy: jest.SpyInstance;
      let annotateSpy: jest.SpyInstance;
      let workflowActive: boolean;

      const rootAnnotation = () =>
        annotateSpy.mock.calls.map(([, options]) => options)[0];

      beforeEach(() => {
        workflowActive = false;
        const originalTrace = tracer.llmobs.trace.bind(tracer.llmobs);
        traceSpy = jest.spyOn(tracer.llmobs, 'trace').mockImplementation(((
          options: unknown,
          fn: unknown
        ) =>
          (originalTrace as (o: unknown, f: unknown) => unknown)(
            options,
            async (span: unknown) => {
              workflowActive = true;
              try {
                return await (fn as (s: unknown) => Promise<unknown>)(span);
              } finally {
                workflowActive = false;
              }
            }
          )) as never);
        annotateSpy = jest.spyOn(tracer.llmobs, 'annotate');
      });

      afterEach(() => {
        traceSpy.mockRestore();
        annotateSpy.mockRestore();
      });

      it('traces the whole answer, escalation check included, as an ai_assistant workflow', async () => {
        anthropicServiceMock.createStream.mockReturnValue(
          createFakeStream(['ok'])
        );
        let activeDuringEscalationCheck = false;
        anthropicServiceMock.generateText.mockImplementation(async () => {
          activeDuringEscalationCheck = workflowActive;
          return 'NON';
        });

        await postStream(coach.token);

        expect(traceSpy).toHaveBeenCalledTimes(1);
        expect(traceSpy.mock.calls[0][0]).toEqual({
          kind: 'workflow',
          name: 'ai-assistant',
        });
        expect(rootAnnotation()).toEqual({
          tags: { feature: 'ai_assistant', outcome: 'success' },
        });
        expect(activeDuringEscalationCheck).toBe(true);
      });

      it('tags a rate_limited outcome when the quota is used, without any LLM call', async () => {
        redisIncr.mockResolvedValue(11);

        await postStream(coach.token);

        expect(rootAnnotation().tags).toEqual({
          feature: 'ai_assistant',
          outcome: 'rate_limited',
        });
        expect(anthropicServiceMock.createStream).not.toHaveBeenCalled();
        expect(anthropicServiceMock.generateText).not.toHaveBeenCalled();
      });

      it('tags a truncated outcome when the answer reached the token limit', async () => {
        anthropicServiceMock.createStream.mockReturnValue({
          ...createFakeStream(['partial']),
          finalMessage: async () => ({
            stop_reason: 'max_tokens',
            usage: { input_tokens: 1, output_tokens: 1 },
          }),
        });

        await postStream(coach.token);

        expect(rootAnnotation().tags).toEqual({
          feature: 'ai_assistant',
          outcome: 'truncated',
        });
      });

      it('tags an error outcome when the stream fails, and still answers the user', async () => {
        anthropicServiceMock.createStream.mockImplementation(() => {
          throw new Error('Anthropic down');
        });

        const response = await postStream(coach.token);

        expect(rootAnnotation().tags).toEqual({
          feature: 'ai_assistant',
          outcome: 'error',
        });
        expect(parseSSEData(response.body)).toContainEqual({
          error: 'Une erreur est survenue.',
        });
      });
    });

    it('stops with a rate_limit event once the hourly quota is used', async () => {
      redisIncr.mockResolvedValue(11);

      const response = await postStream(coach.token);
      const events = parseSSEData(response.body);

      expect(events).toContainEqual({
        type: 'rate_limit',
        resetInSeconds: 1800,
      });
      expect(events[events.length - 1]).toBe('[DONE]');
      expect(anthropicServiceMock.createStream).not.toHaveBeenCalled();
    });

    it('announces the remaining quota and arms the expiry on the first message of the window', async () => {
      anthropicServiceMock.createStream.mockReturnValue(
        createFakeStream(['ok'])
      );

      const response = await postStream(coach.token);

      expect(parseSSEData(response.body)).toContainEqual({
        type: 'rate_limit_info',
        remaining: 9,
      });
      expect(app.get(REDIS_CLIENT).expire).toHaveBeenCalled();
    });

    it('extracts the suggestions of the answer into a suggest event', async () => {
      anthropicServiceMock.createStream.mockReturnValue(
        createFakeStream([
          'Voici deux pistes. [SUGGESTION]Bonjour, ',
          'disponible demain ?[/SUGGESTION] et [SUGGESTION]  [/SUGGESTION]',
          '[SUGGESTION]Merci pour votre retour[/SUGGESTION]',
        ])
      );

      const response = await postStream(coach.token);

      expect(parseSSEData(response.body)).toContainEqual({
        type: 'suggest',
        suggestions: [
          'Bonjour, disponible demain ?',
          'Merci pour votre retour',
        ],
      });
    });

    it('streams for an admin participant of the conversation', async () => {
      await messagingHelper.associationParticipantsToConversation(
        conversationId,
        [admin.user.id]
      );
      anthropicServiceMock.createStream.mockReturnValue(
        createFakeStream(['réponse admin'])
      );

      const response = await postStream(admin.token);

      expect(parseSSEData(response.body)).toContainEqual({
        content: 'réponse admin',
      });
    });

    it('proposes to escalate to the staff referent when the classifier says so', async () => {
      process.env.STAFF_CONTACT_CANDIDATE_ENTOURAGE_PRO_EMAIL_PARIS =
        admin.user.email;
      await userModel.update(
        { zone: ZoneName.IDF },
        { where: { id: candidate.user.id } }
      );
      anthropicServiceMock.createStream.mockReturnValue(
        createFakeStream(['Cette situation dépasse mon rôle'])
      );
      anthropicServiceMock.generateText.mockResolvedValue('OUI');

      const response = await postStream(coach.token);
      const events = parseSSEData(response.body) as { type?: string }[];

      const escalate = events.find(({ type }) => type === 'escalate');
      expect(escalate).toMatchObject({ referentUserId: admin.user.id });
    });

    it('does not escalate when the classifier fails', async () => {
      process.env.STAFF_CONTACT_CANDIDATE_ENTOURAGE_PRO_EMAIL_PARIS =
        admin.user.email;
      anthropicServiceMock.createStream.mockReturnValue(
        createFakeStream(['Une réponse'])
      );
      anthropicServiceMock.generateText.mockRejectedValue(new Error('down'));

      const response = await postStream(coach.token);
      const events = parseSSEData(response.body) as { type?: string }[];

      expect(events.some(({ type }) => type === 'escalate')).toBe(false);
      expect(events[events.length - 1]).toBe('[DONE]');
    });
  });
});
