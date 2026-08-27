import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/sequelize';
import { Test, TestingModule } from '@nestjs/testing';
import { LoggedInUser, UsersHelper } from '../users/users.helper';
import { SlackService } from 'src/external-services/slack/slack.service';
import { ConversationPipelineService } from 'src/messaging/conversation-pipeline.service';
import {
  ConversationActivityStatus,
  ConversationStage,
  ConversationType,
} from 'src/messaging/models/conversation.model';
import { Message } from 'src/messaging/models/message.model';
import { QueuesService } from 'src/queues/producers/queues.service';
import { UserRoles } from 'src/users/users.types';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import { SlackMocks } from 'tests/mocks.types';
import { QueuesServiceMock } from 'tests/queues/queues.service.mock';
import { ConversationFactory } from './conversation.factory';
import { MessagingHelper } from './messaging.helper';

describe('ConversationPipelineService', () => {
  let app: INestApplication;
  let databaseHelper: DatabaseHelper;
  let messagingHelper: MessagingHelper;
  let usersHelper: UsersHelper;
  let conversationFactory: ConversationFactory;
  let conversationPipelineService: ConversationPipelineService;
  let messageModel: typeof Message;

  let loggedInCandidate: LoggedInUser;
  let loggedInCoach: LoggedInUser;

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

    conversationPipelineService = app.get(ConversationPipelineService);
    messageModel = moduleFixture.get<typeof Message>(getModelToken(Message));
    databaseHelper = moduleFixture.get<DatabaseHelper>(DatabaseHelper);
    usersHelper = moduleFixture.get<UsersHelper>(UsersHelper);
    messagingHelper = moduleFixture.get<MessagingHelper>(MessagingHelper);
    conversationFactory =
      moduleFixture.get<ConversationFactory>(ConversationFactory);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    loggedInCandidate = await usersHelper.createLoggedInUser({
      role: UserRoles.CANDIDATE,
    });
    loggedInCoach = await usersHelper.createLoggedInUser({
      role: UserRoles.COACH,
    });
  });

  afterEach(async () => {
    await databaseHelper.resetTestDB();
  });

  describe('recomputeStage', () => {
    it('sets stage to FIRST_CONTACT_INITIATED after a single message', async () => {
      const conversation = await conversationFactory.create();
      await messagingHelper.associationParticipantsToConversation(
        conversation.id,
        [loggedInCandidate.user.id, loggedInCoach.user.id]
      );
      await messagingHelper.createMessage(
        conversation.id,
        loggedInCandidate.user.id
      );

      await conversationPipelineService.recomputeStage(conversation.id);

      const updated = await messagingHelper.findConversation(conversation.id);
      expect(updated.stage).toBe(ConversationStage.FIRST_CONTACT_INITIATED);
    });

    it('sets stage to CONTACT_ESTABLISHED once the other participant has replied', async () => {
      const conversation = await conversationFactory.create();
      await messagingHelper.associationParticipantsToConversation(
        conversation.id,
        [loggedInCandidate.user.id, loggedInCoach.user.id]
      );
      await messagingHelper.createMessage(
        conversation.id,
        loggedInCandidate.user.id
      );
      await messagingHelper.createMessage(
        conversation.id,
        loggedInCoach.user.id
      );

      await conversationPipelineService.recomputeStage(conversation.id);

      const updated = await messagingHelper.findConversation(conversation.id);
      expect(updated.stage).toBe(ConversationStage.CONTACT_ESTABLISHED);
    });

    it('sets stage to LONG_TERM_SUPPORT once each participant has sent 3 messages', async () => {
      const conversation = await conversationFactory.create();
      await messagingHelper.associationParticipantsToConversation(
        conversation.id,
        [loggedInCandidate.user.id, loggedInCoach.user.id]
      );
      await messagingHelper.addMessagesToConversation(
        3,
        conversation.id,
        loggedInCandidate.user.id
      );
      await messagingHelper.addMessagesToConversation(
        3,
        conversation.id,
        loggedInCoach.user.id
      );

      await conversationPipelineService.recomputeStage(conversation.id);

      const updated = await messagingHelper.findConversation(conversation.id);
      expect(updated.stage).toBe(ConversationStage.LONG_TERM_SUPPORT);
    });

    it('does not require the same message count from both participants (threshold is per-participant, not cumulative)', async () => {
      const conversation = await conversationFactory.create();
      await messagingHelper.associationParticipantsToConversation(
        conversation.id,
        [loggedInCandidate.user.id, loggedInCoach.user.id]
      );
      await messagingHelper.addMessagesToConversation(
        5,
        conversation.id,
        loggedInCandidate.user.id
      );
      await messagingHelper.addMessagesToConversation(
        2,
        conversation.id,
        loggedInCoach.user.id
      );

      await conversationPipelineService.recomputeStage(conversation.id);

      const updated = await messagingHelper.findConversation(conversation.id);
      expect(updated.stage).toBe(ConversationStage.CONTACT_ESTABLISHED);
    });

    it('never regresses stage once LONG_TERM_SUPPORT is reached', async () => {
      const conversation = await conversationFactory.create();
      await messagingHelper.associationParticipantsToConversation(
        conversation.id,
        [loggedInCandidate.user.id, loggedInCoach.user.id]
      );
      await messagingHelper.addMessagesToConversation(
        3,
        conversation.id,
        loggedInCandidate.user.id
      );
      await messagingHelper.addMessagesToConversation(
        3,
        conversation.id,
        loggedInCoach.user.id
      );
      await conversationPipelineService.recomputeStage(conversation.id);

      const conversationRow = await messagingHelper.findConversation(
        conversation.id
      );
      expect(conversationRow.stage).toBe(ConversationStage.LONG_TERM_SUPPORT);

      // Delete the coach's messages so a fresh computation from scratch would
      // only yield CONTACT_ESTABLISHED, then verify the persisted stage still
      // doesn't regress on recompute.
      await messageModel.destroy({
        where: {
          conversationId: conversation.id,
          authorId: loggedInCoach.user.id,
        },
      });

      await conversationPipelineService.recomputeStage(conversation.id);

      const updated = await messagingHelper.findConversation(conversation.id);
      expect(updated.stage).toBe(ConversationStage.LONG_TERM_SUPPORT);
    });

    it('does not compute stage for a group conversation', async () => {
      const otherCandidate = await usersHelper.createLoggedInUser({
        role: UserRoles.CANDIDATE,
      });
      const conversation = await conversationFactory.create({
        type: ConversationType.GROUP,
      });
      await messagingHelper.associationParticipantsToConversation(
        conversation.id,
        [
          loggedInCandidate.user.id,
          loggedInCoach.user.id,
          otherCandidate.user.id,
        ]
      );
      await messagingHelper.createMessage(
        conversation.id,
        loggedInCandidate.user.id
      );

      await conversationPipelineService.recomputeStage(conversation.id);

      const updated = await messagingHelper.findConversation(conversation.id);
      expect(updated.stage).toBeNull();
    });
  });

  describe('markActive', () => {
    it('sets activityStatus to ACTIVE on a direct conversation', async () => {
      const conversation = await conversationFactory.create();
      await messagingHelper.associationParticipantsToConversation(
        conversation.id,
        [loggedInCandidate.user.id, loggedInCoach.user.id]
      );

      await conversationPipelineService.markActive(conversation.id);

      const updated = await messagingHelper.findConversation(conversation.id);
      expect(updated.activityStatus).toBe(ConversationActivityStatus.ACTIVE);
    });

    it('does not set activityStatus on a group conversation', async () => {
      const otherCandidate = await usersHelper.createLoggedInUser({
        role: UserRoles.CANDIDATE,
      });
      const conversation = await conversationFactory.create({
        type: ConversationType.GROUP,
      });
      await messagingHelper.associationParticipantsToConversation(
        conversation.id,
        [
          loggedInCandidate.user.id,
          loggedInCoach.user.id,
          otherCandidate.user.id,
        ]
      );

      await conversationPipelineService.markActive(conversation.id);

      const updated = await messagingHelper.findConversation(conversation.id);
      expect(updated.activityStatus).toBeNull();
    });
  });

  describe('deactivateStaleConversations', () => {
    it('deactivates a direct conversation whose last message is more than 30 days old', async () => {
      const conversation = await conversationFactory.create();
      await messagingHelper.associationParticipantsToConversation(
        conversation.id,
        [loggedInCandidate.user.id, loggedInCoach.user.id]
      );
      const oldDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
      await messagingHelper.createMessage(
        conversation.id,
        loggedInCandidate.user.id,
        { createdAt: oldDate, updatedAt: oldDate }
      );
      await conversationPipelineService.markActive(conversation.id);

      const deactivatedIds =
        await conversationPipelineService.deactivateStaleConversations();

      expect(deactivatedIds).toContain(conversation.id);
      const updated = await messagingHelper.findConversation(conversation.id);
      expect(updated.activityStatus).toBe(ConversationActivityStatus.INACTIVE);
    });

    it('does not deactivate a conversation with a recent message', async () => {
      const conversation = await conversationFactory.create();
      await messagingHelper.associationParticipantsToConversation(
        conversation.id,
        [loggedInCandidate.user.id, loggedInCoach.user.id]
      );
      await messagingHelper.createMessage(
        conversation.id,
        loggedInCandidate.user.id
      );
      await conversationPipelineService.markActive(conversation.id);

      const deactivatedIds =
        await conversationPipelineService.deactivateStaleConversations();

      expect(deactivatedIds).not.toContain(conversation.id);
      const updated = await messagingHelper.findConversation(conversation.id);
      expect(updated.activityStatus).toBe(ConversationActivityStatus.ACTIVE);
    });

    it('does not affect a conversation that is already INACTIVE', async () => {
      const conversation = await conversationFactory.create();
      await messagingHelper.associationParticipantsToConversation(
        conversation.id,
        [loggedInCandidate.user.id, loggedInCoach.user.id]
      );
      const oldDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
      await messagingHelper.createMessage(
        conversation.id,
        loggedInCandidate.user.id,
        { createdAt: oldDate, updatedAt: oldDate }
      );
      // Never marked active: activityStatus stays null, not ACTIVE.

      const deactivatedIds =
        await conversationPipelineService.deactivateStaleConversations();

      expect(deactivatedIds).not.toContain(conversation.id);
    });
  });

  describe('detectFirstMeeting', () => {
    const createMessageAndDetect = async (
      conversationId: string,
      authorId: string,
      content: string
    ) => {
      const message = await messagingHelper.createMessage(
        conversationId,
        authorId,
        { content }
      );
      await conversationPipelineService.detectFirstMeeting(
        conversationId,
        message
      );
    };

    it('detects a shared videoconferencing link once the other participant replies', async () => {
      const conversation = await conversationFactory.create();
      await messagingHelper.associationParticipantsToConversation(
        conversation.id,
        [loggedInCandidate.user.id, loggedInCoach.user.id]
      );

      await createMessageAndDetect(
        conversation.id,
        loggedInCandidate.user.id,
        'On peut se voir sur https://meet.google.com/abc-defg-hij'
      );
      await createMessageAndDetect(
        conversation.id,
        loggedInCoach.user.id,
        'Avec plaisir !'
      );

      const updated = await messagingHelper.findConversation(conversation.id);
      expect(updated.firstMeetingDetectedAt).not.toBeNull();
    });

    it('detects a shared phone number once the other participant replies', async () => {
      const conversation = await conversationFactory.create();
      await messagingHelper.associationParticipantsToConversation(
        conversation.id,
        [loggedInCandidate.user.id, loggedInCoach.user.id]
      );

      await createMessageAndDetect(
        conversation.id,
        loggedInCandidate.user.id,
        'Vous pouvez me joindre au 06 12 34 56 78'
      );
      await createMessageAndDetect(
        conversation.id,
        loggedInCoach.user.id,
        "J'appelle demain"
      );

      const updated = await messagingHelper.findConversation(conversation.id);
      expect(updated.firstMeetingDetectedAt).not.toBeNull();
    });

    it('detects a shared email address once the other participant replies', async () => {
      const conversation = await conversationFactory.create();
      await messagingHelper.associationParticipantsToConversation(
        conversation.id,
        [loggedInCandidate.user.id, loggedInCoach.user.id]
      );

      await createMessageAndDetect(
        conversation.id,
        loggedInCandidate.user.id,
        'Contactez-moi sur jean.dupont@example.com'
      );
      await createMessageAndDetect(
        conversation.id,
        loggedInCoach.user.id,
        'Je vous envoie un mail'
      );

      const updated = await messagingHelper.findConversation(conversation.id);
      expect(updated.firstMeetingDetectedAt).not.toBeNull();
    });

    it('does not set firstMeetingDetectedAt when there is no reply after the share', async () => {
      const conversation = await conversationFactory.create();
      await messagingHelper.associationParticipantsToConversation(
        conversation.id,
        [loggedInCandidate.user.id, loggedInCoach.user.id]
      );

      await createMessageAndDetect(
        conversation.id,
        loggedInCandidate.user.id,
        'Vous pouvez me joindre au 06 12 34 56 78'
      );

      const updated = await messagingHelper.findConversation(conversation.id);
      expect(updated.firstMeetingDetectedAt).toBeNull();
    });

    it('does not overwrite firstMeetingDetectedAt once already set', async () => {
      const conversation = await conversationFactory.create();
      await messagingHelper.associationParticipantsToConversation(
        conversation.id,
        [loggedInCandidate.user.id, loggedInCoach.user.id]
      );

      await createMessageAndDetect(
        conversation.id,
        loggedInCandidate.user.id,
        'Mon numéro : 06 12 34 56 78'
      );
      await createMessageAndDetect(
        conversation.id,
        loggedInCoach.user.id,
        "J'appelle demain"
      );

      const firstDetection = await messagingHelper.findConversation(
        conversation.id
      );
      const firstDetectedAt = firstDetection.firstMeetingDetectedAt;
      expect(firstDetectedAt).not.toBeNull();

      await createMessageAndDetect(
        conversation.id,
        loggedInCandidate.user.id,
        'Voici un autre lien https://zoom.us/j/123456789'
      );
      await createMessageAndDetect(
        conversation.id,
        loggedInCoach.user.id,
        'Parfait'
      );

      const secondDetection = await messagingHelper.findConversation(
        conversation.id
      );
      expect(secondDetection.firstMeetingDetectedAt).toEqual(firstDetectedAt);
    });
  });
});
