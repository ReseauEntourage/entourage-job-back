import { INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { getModelToken } from '@nestjs/sequelize';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
// Loaded before src/ai-assistant/* on purpose: importing the controller first
// triggers an import cycle through src/app.module.
import { CustomTestingModule } from '../custom-testing.module';
import { UsersHelper, LoggedInUser } from '../users/users.helper';
import {
  AI_ASSISTANT_STREAM_TIMEOUT_MS,
  AiAssistantController,
} from 'src/ai-assistant/ai-assistant.controller';
import { AiAssistantModule } from 'src/ai-assistant/ai-assistant.module';
import { AiAssistantMessage } from 'src/ai-assistant/models/ai-assistant-message.model';
import { TIMEOUT_KEY } from 'src/common/decorators/timeout.decorator';
import { AnthropicService } from 'src/external-services/anthropic/anthropic.service';
import { SlackService } from 'src/external-services/slack/slack.service';
import { QueuesService } from 'src/queues/producers/queues.service';
import { REDIS_CLIENT } from 'src/redis/redis.module';
import { UserRoles } from 'src/users/users.types';
import { DatabaseHelper } from 'tests/database.helper';
import { ConversationFactory } from 'tests/messaging/conversation.factory';
import { MessagingHelper } from 'tests/messaging/messaging.helper';
import { SlackMocks } from 'tests/mocks.types';
import { QueuesServiceMock } from 'tests/queues/queues.service.mock';

type FakeStreamOptions = {
  chunks: string[];
  stopReason: 'end_turn' | 'max_tokens';
};

/**
 * Mimics the subset of the Anthropic MessageStream used by AiAssistantService:
 * an async iterable of text deltas plus finalMessage().
 */
const createFakeStream = ({ chunks, stopReason }: FakeStreamOptions) => ({
  async *[Symbol.asyncIterator]() {
    for (const text of chunks) {
      yield {
        type: 'content_block_delta',
        delta: { type: 'text_delta', text },
      };
    }
  },
  finalMessage: async () => ({
    stop_reason: stopReason,
    usage: { input_tokens: 10, output_tokens: 4096 },
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

describe('AI ASSISTANT', () => {
  let app: INestApplication;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let server: any;

  let databaseHelper: DatabaseHelper;
  let usersHelper: UsersHelper;
  let messagingHelper: MessagingHelper;
  let conversationFactory: ConversationFactory;
  let aiAssistantMessageModel: typeof AiAssistantMessage;

  let loggedInCoach: LoggedInUser;
  let loggedInCandidate: LoggedInUser;
  let conversationId: string;

  const anthropicServiceMock = {
    createStream: jest.fn(),
    generateText: jest.fn().mockResolvedValue('NON'),
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

    // The global ioredis mock (tests/setup.ts) has no counter commands,
    // which the assistant rate limiter relies on.
    const redis = app.get(REDIS_CLIENT);
    redis.incr = jest.fn().mockResolvedValue(1);
    redis.expire = jest.fn().mockResolvedValue(1);
    redis.ttl = jest.fn().mockResolvedValue(3600);

    databaseHelper = moduleFixture.get<DatabaseHelper>(DatabaseHelper);
    usersHelper = moduleFixture.get<UsersHelper>(UsersHelper);
    messagingHelper = moduleFixture.get<MessagingHelper>(MessagingHelper);
    conversationFactory =
      moduleFixture.get<ConversationFactory>(ConversationFactory);
    aiAssistantMessageModel = moduleFixture.get(
      getModelToken(AiAssistantMessage)
    );
  });

  afterAll(async () => {
    await app.close();
    server.close();
  });

  beforeEach(async () => {
    loggedInCoach = await usersHelper.createLoggedInUser({
      role: UserRoles.COACH,
    });
    loggedInCandidate = await usersHelper.createLoggedInUser({
      role: UserRoles.CANDIDATE,
    });
    const conversation = await conversationFactory.create();
    conversationId = conversation.id;
    await messagingHelper.associationParticipantsToConversation(
      conversationId,
      [loggedInCoach.user.id, loggedInCandidate.user.id]
    );
    anthropicServiceMock.createStream.mockReset();
  });

  afterEach(async () => {
    await databaseHelper.resetTestDB();
  });

  describe('POST /ai-assistant/conversations/:id/stream', () => {
    it('should stream the full response without a truncated event when the model ends its turn', async () => {
      anthropicServiceMock.createStream.mockReturnValue(
        createFakeStream({
          chunks: ['Bonjour, ', 'voici ma réponse.'],
          stopReason: 'end_turn',
        })
      );

      const response = await postStream(loggedInCoach.token);
      const events = parseSSEData(response.body);

      expect(response.status).toBe(201);
      expect(events).toContainEqual({ content: 'Bonjour, ' });
      expect(events).toContainEqual({ content: 'voici ma réponse.' });
      expect(events).not.toContainEqual({ type: 'truncated' });
      expect(events[events.length - 1]).toBe('[DONE]');
    });

    it('should emit a truncated event before [DONE] and persist the partial text when max_tokens is reached', async () => {
      anthropicServiceMock.createStream.mockReturnValue(
        createFakeStream({
          chunks: ["L'entretien n'est pas un examen où elle doit tout sa"],
          stopReason: 'max_tokens',
        })
      );

      const response = await postStream(loggedInCoach.token);
      const events = parseSSEData(response.body);

      const truncatedIndex = events.findIndex(
        (e) => (e as { type?: string })?.type === 'truncated'
      );
      expect(truncatedIndex).toBeGreaterThan(-1);
      expect(events.indexOf('[DONE]')).toBeGreaterThan(truncatedIndex);

      const saved = await aiAssistantMessageModel.findOne({
        where: { role: 'assistant' },
      });
      expect(saved?.content).toBe(
        "L'entretien n'est pas un examen où elle doit tout sa"
      );
    });

    // The role check runs inside the stream, so a candidate gets an SSE error
    // event rather than an HTTP 401 — what matters is that nothing is generated.
    it('should refuse a candidate without generating anything', async () => {
      const response = await postStream(loggedInCandidate.token);
      const events = parseSSEData(response.body);

      expect(events).toContainEqual({ error: 'Une erreur est survenue.' });
      expect(events).not.toContainEqual(
        expect.objectContaining({ content: expect.any(String) })
      );
      expect(anthropicServiceMock.createStream).not.toHaveBeenCalled();
    });

    it('should return 401 for a user who is not a participant of the conversation', async () => {
      const outsider = await usersHelper.createLoggedInUser({
        role: UserRoles.COACH,
      });

      const response = await postStream(outsider.token);

      expect(response.status).toBe(401);
      expect(anthropicServiceMock.createStream).not.toHaveBeenCalled();
    });

    it('should use a dedicated timeout longer than the 30s global default', () => {
      const timeout = app
        .get(Reflector)
        .get<number>(
          TIMEOUT_KEY,
          AiAssistantController.prototype.streamResponse
        );

      expect(timeout).toBe(AI_ASSISTANT_STREAM_TIMEOUT_MS);
      expect(AI_ASSISTANT_STREAM_TIMEOUT_MS).toBeGreaterThanOrEqual(120000);
    });
  });
});
