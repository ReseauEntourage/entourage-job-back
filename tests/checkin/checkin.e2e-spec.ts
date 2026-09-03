import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/sequelize';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { LoggedInUser, UsersHelper } from '../users/users.helper';
import { CheckinController } from 'src/checkin/checkin.controller';
import { CheckinService } from 'src/checkin/checkin.service';
import {
  CHECKIN_CATCHUP_MIN_ENGAGEMENT_THRESHOLD_DATE,
  CHECKIN_ELIGIBILITY_THRESHOLD_DAYS,
  CHECKIN_RELANCE_THRESHOLD_DAYS,
  CheckinEmploymentType,
  CheckinExchangeFrequency,
  CheckinExchangeMode,
  CheckinPerceivedBenefitCandidate,
  CheckinPerceivedSupport,
  CheckinStillInTouch,
} from 'src/checkin/checkin.types';
import { ConversationCheckin } from 'src/checkin/models';
import { runCheckinCatchupScript } from 'src/checkin/scripts/send-checkin-catchup-mails.script';
import { MailjetTemplates } from 'src/external-services/mailjet/mailjet.types';
import { SlackService } from 'src/external-services/slack/slack.service';
import { MessagingService } from 'src/messaging/messaging.service';
import { ConversationType } from 'src/messaging/models';
import {
  Message,
  MessageType,
  ServiceMessageKind,
} from 'src/messaging/models/message.model';
import { CronTasksSlackReporterService } from 'src/queues/consumers/cron-tasks/cron-tasks-slack-reporter.service';
import { QueuesService } from 'src/queues/producers/queues.service';
import { Jobs } from 'src/queues/queues.types';
import { UserRoles } from 'src/users/users.types';
import { APIResponse } from 'src/utils/types';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import { ConversationFactory } from 'tests/messaging/conversation.factory';
import { MessagingHelper } from 'tests/messaging/messaging.helper';
import { SlackMocks } from 'tests/mocks.types';
import { QueuesServiceMock } from 'tests/queues/queues.service.mock';

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY_IN_MS);

describe('CHECKIN', () => {
  let app: INestApplication;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let server: any;

  let databaseHelper: DatabaseHelper;
  let usersHelper: UsersHelper;
  let conversationFactory: ConversationFactory;
  let messagingHelper: MessagingHelper;
  let checkinService: CheckinService;
  let messagingService: MessagingService;
  let slackService: SlackService;
  let conversationCheckinModel: typeof ConversationCheckin;
  let messageModel: typeof Message;
  let addToWorkQueueSpy: jest.SpyInstance;

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
    server = app.getHttpServer();

    databaseHelper = moduleFixture.get<DatabaseHelper>(DatabaseHelper);
    usersHelper = moduleFixture.get<UsersHelper>(UsersHelper);
    conversationFactory =
      moduleFixture.get<ConversationFactory>(ConversationFactory);
    messagingHelper = moduleFixture.get<MessagingHelper>(MessagingHelper);
    checkinService = moduleFixture.get<CheckinService>(CheckinService);
    messagingService = moduleFixture.get<MessagingService>(MessagingService);
    slackService = moduleFixture.get<SlackService>(SlackService);
    conversationCheckinModel = moduleFixture.get<typeof ConversationCheckin>(
      getModelToken(ConversationCheckin)
    );
    messageModel = moduleFixture.get<typeof Message>(getModelToken(Message));

    addToWorkQueueSpy = jest.spyOn(
      QueuesServiceMock.prototype,
      'addToWorkQueue'
    );
  });

  afterAll(async () => {
    await app.close();
    server.close();
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
    jest.clearAllMocks();
  });

  const createConversation = async (props: {
    type?: ConversationType;
    engagementThresholdReachedAt?: Date | null;
    withParticipants?: boolean;
  }) => {
    const {
      type = ConversationType.DIRECT,
      engagementThresholdReachedAt = null,
      withParticipants = true,
    } = props;
    const conversation = await conversationFactory.create({
      type,
      engagementThresholdReachedAt,
    });
    if (withParticipants) {
      await messagingHelper.associationParticipantsToConversation(
        conversation.id,
        [loggedInCandidate.user.id, loggedInCoach.user.id]
      );
    }
    return conversation;
  };

  const createEligibleConversation = () =>
    createConversation({
      engagementThresholdReachedAt: daysAgo(
        CHECKIN_ELIGIBILITY_THRESHOLD_DAYS + 1
      ),
    });

  describe('GET /checkin/:conversationId (éligibilité)', () => {
    it('is eligible once 30 days have passed since engagementThresholdReachedAt', async () => {
      const conversation = await createEligibleConversation();

      const response: APIResponse<CheckinController['getCheckin']> =
        await request(server)
          .get(`/checkin/${conversation.id}`)
          .set('authorization', `Bearer ${loggedInCandidate.token}`);

      expect(response.status).toBe(200);
      expect(response.body.eligible).toBe(true);
      expect(response.body.checkin).toBeNull();
      expect(response.body.otherParticipant?.id).toBe(loggedInCoach.user.id);
    });

    it('is not eligible when engagementThresholdReachedAt is null', async () => {
      const conversation = await createConversation({
        engagementThresholdReachedAt: null,
      });

      const response: APIResponse<CheckinController['getCheckin']> =
        await request(server)
          .get(`/checkin/${conversation.id}`)
          .set('authorization', `Bearer ${loggedInCandidate.token}`);

      expect(response.status).toBe(200);
      expect(response.body.eligible).toBe(false);
    });

    it('is not eligible before 30 days have passed', async () => {
      const conversation = await createConversation({
        engagementThresholdReachedAt: daysAgo(5),
      });

      const response: APIResponse<CheckinController['getCheckin']> =
        await request(server)
          .get(`/checkin/${conversation.id}`)
          .set('authorization', `Bearer ${loggedInCandidate.token}`);

      expect(response.status).toBe(200);
      expect(response.body.eligible).toBe(false);
    });

    it('is never eligible for a group conversation', async () => {
      const conversation = await createConversation({
        type: ConversationType.GROUP,
        engagementThresholdReachedAt: daysAgo(
          CHECKIN_ELIGIBILITY_THRESHOLD_DAYS + 5
        ),
      });

      const response: APIResponse<CheckinController['getCheckin']> =
        await request(server)
          .get(`/checkin/${conversation.id}`)
          .set('authorization', `Bearer ${loggedInCandidate.token}`);

      expect(response.status).toBe(200);
      expect(response.body.eligible).toBe(false);
    });

    it('returns 403 for a user who is not a participant of the conversation', async () => {
      const conversation = await createEligibleConversation();
      const outsider = await usersHelper.createLoggedInUser({
        role: UserRoles.CANDIDATE,
      });

      const response: APIResponse<CheckinController['getCheckin']> =
        await request(server)
          .get(`/checkin/${conversation.id}`)
          .set('authorization', `Bearer ${outsider.token}`);

      expect(response.status).toBe(403);
    });

    it('returns 404 for an unknown conversation', async () => {
      const response: APIResponse<CheckinController['getCheckin']> =
        await request(server)
          .get(`/checkin/00000000-0000-0000-0000-000000000000`)
          .set('authorization', `Bearer ${loggedInCandidate.token}`);

      expect(response.status).toBe(404);
    });

    it('returns the existing (possibly partial) checkin once one has been started', async () => {
      const conversation = await createEligibleConversation();
      await conversationCheckinModel.create({
        conversationId: conversation.id,
        userId: loggedInCandidate.user.id,
        stillInTouch: CheckinStillInTouch.YES,
      });

      const response: APIResponse<CheckinController['getCheckin']> =
        await request(server)
          .get(`/checkin/${conversation.id}`)
          .set('authorization', `Bearer ${loggedInCandidate.token}`);

      expect(response.status).toBe(200);
      expect(response.body.checkin?.stillInTouch).toBe(CheckinStillInTouch.YES);
    });
  });

  describe('PUT /checkin/:conversationId (soumission progressive)', () => {
    it('returns 403 and creates nothing when the conversation is not eligible', async () => {
      const conversation = await createConversation({
        engagementThresholdReachedAt: daysAgo(5),
      });

      const response: APIResponse<CheckinController['submitAnswer']> =
        await request(server)
          .put(`/checkin/${conversation.id}`)
          .send({ stillInTouch: CheckinStillInTouch.YES })
          .set('authorization', `Bearer ${loggedInCandidate.token}`);

      expect(response.status).toBe(403);
      const checkin = await conversationCheckinModel.findOne({
        where: {
          conversationId: conversation.id,
          userId: loggedInCandidate.user.id,
        },
      });
      expect(checkin).toBeNull();
    });

    it('creates the checkin row only once the first real answer is submitted', async () => {
      const conversation = await createEligibleConversation();
      const before = await conversationCheckinModel.findOne({
        where: {
          conversationId: conversation.id,
          userId: loggedInCandidate.user.id,
        },
      });
      expect(before).toBeNull();

      const response: APIResponse<CheckinController['submitAnswer']> =
        await request(server)
          .put(`/checkin/${conversation.id}`)
          .send({ stillInTouch: CheckinStillInTouch.YES })
          .set('authorization', `Bearer ${loggedInCandidate.token}`);

      expect(response.status).toBe(200);
      expect(response.body.stillInTouch).toBe(CheckinStillInTouch.YES);
      const after = await conversationCheckinModel.findOne({
        where: {
          conversationId: conversation.id,
          userId: loggedInCandidate.user.id,
        },
      });
      expect(after).not.toBeNull();
    });

    it('accumulates answers across multiple calls, including array fields', async () => {
      const conversation = await createEligibleConversation();

      await request(server)
        .put(`/checkin/${conversation.id}`)
        .send({ stillInTouch: CheckinStillInTouch.YES })
        .set('authorization', `Bearer ${loggedInCandidate.token}`);

      const response: APIResponse<CheckinController['submitAnswer']> =
        await request(server)
          .put(`/checkin/${conversation.id}`)
          .send({
            exchangeModes: [
              CheckinExchangeMode.PHONE,
              CheckinExchangeMode.VIDEO,
            ],
          })
          .set('authorization', `Bearer ${loggedInCandidate.token}`);

      expect(response.status).toBe(200);
      expect(response.body.stillInTouch).toBe(CheckinStillInTouch.YES);
      expect(response.body.exchangeModes).toEqual([
        CheckinExchangeMode.PHONE,
        CheckinExchangeMode.VIDEO,
      ]);
    });

    it('rejects overwriting a field that was already answered', async () => {
      const conversation = await createEligibleConversation();
      await request(server)
        .put(`/checkin/${conversation.id}`)
        .send({ exchangeFrequency: CheckinExchangeFrequency.WEEKLY })
        .set('authorization', `Bearer ${loggedInCandidate.token}`);

      const response: APIResponse<CheckinController['submitAnswer']> =
        await request(server)
          .put(`/checkin/${conversation.id}`)
          .send({ exchangeFrequency: CheckinExchangeFrequency.MONTHLY })
          .set('authorization', `Bearer ${loggedInCandidate.token}`);

      expect(response.status).toBe(409);
      const checkin = await conversationCheckinModel.findOne({
        where: {
          conversationId: conversation.id,
          userId: loggedInCandidate.user.id,
        },
      });
      expect(checkin?.exchangeFrequency).toBe(CheckinExchangeFrequency.WEEKLY);
    });

    it('lets each participant submit their own, independent checkin', async () => {
      const conversation = await createEligibleConversation();

      await request(server)
        .put(`/checkin/${conversation.id}`)
        .send({ rating: 5 })
        .set('authorization', `Bearer ${loggedInCandidate.token}`);
      await request(server)
        .put(`/checkin/${conversation.id}`)
        .send({ rating: 2 })
        .set('authorization', `Bearer ${loggedInCoach.token}`);

      const candidateCheckin = await conversationCheckinModel.findOne({
        where: {
          conversationId: conversation.id,
          userId: loggedInCandidate.user.id,
        },
      });
      const coachCheckin = await conversationCheckinModel.findOne({
        where: {
          conversationId: conversation.id,
          userId: loggedInCoach.user.id,
        },
      });
      expect(candidateCheckin?.rating).toBe(5);
      expect(coachCheckin?.rating).toBe(2);
    });

    it('returns 403 for a user who is not a participant of the conversation', async () => {
      const conversation = await createEligibleConversation();
      const outsider = await usersHelper.createLoggedInUser({
        role: UserRoles.CANDIDATE,
      });

      const response: APIResponse<CheckinController['submitAnswer']> =
        await request(server)
          .put(`/checkin/${conversation.id}`)
          .send({ stillInTouch: CheckinStillInTouch.YES })
          .set('authorization', `Bearer ${outsider.token}`);

      expect(response.status).toBe(403);
    });
  });

  describe('POST /checkin/:conversationId/contact-request (note basse)', () => {
    it('returns 404 when no rating has been submitted yet', async () => {
      const conversation = await createEligibleConversation();

      const response: APIResponse<CheckinController['requestStaffContact']> =
        await request(server)
          .post(`/checkin/${conversation.id}/contact-request`)
          .set('authorization', `Bearer ${loggedInCandidate.token}`);

      expect(response.status).toBe(404);
    });

    it('returns 403 when the rating is not eligible for a contact request (> 2)', async () => {
      const conversation = await createEligibleConversation();
      await request(server)
        .put(`/checkin/${conversation.id}`)
        .send({ rating: 3 })
        .set('authorization', `Bearer ${loggedInCandidate.token}`);

      const response: APIResponse<CheckinController['requestStaffContact']> =
        await request(server)
          .post(`/checkin/${conversation.id}/contact-request`)
          .set('authorization', `Bearer ${loggedInCandidate.token}`);

      expect(response.status).toBe(403);
      expect(SlackMocks.sendCheckinContactRequestAlert).not.toHaveBeenCalled();
    });

    it('sends a Slack alert and sets contactRequestedAt when the rating is 1 or 2', async () => {
      const conversation = await createEligibleConversation();
      await request(server)
        .put(`/checkin/${conversation.id}`)
        .send({ rating: 1 })
        .set('authorization', `Bearer ${loggedInCandidate.token}`);

      const response: APIResponse<CheckinController['requestStaffContact']> =
        await request(server)
          .post(`/checkin/${conversation.id}/contact-request`)
          .set('authorization', `Bearer ${loggedInCandidate.token}`);

      expect(response.status).toBe(201);
      expect(response.body.contactRequestedAt).not.toBeNull();
      expect(SlackMocks.sendCheckinContactRequestAlert).toHaveBeenCalledTimes(
        1
      );
    });

    it('does not send a second Slack alert on a repeated request', async () => {
      const conversation = await createEligibleConversation();
      await request(server)
        .put(`/checkin/${conversation.id}`)
        .send({ rating: 2 })
        .set('authorization', `Bearer ${loggedInCandidate.token}`);

      await request(server)
        .post(`/checkin/${conversation.id}/contact-request`)
        .set('authorization', `Bearer ${loggedInCandidate.token}`);
      const response: APIResponse<CheckinController['requestStaffContact']> =
        await request(server)
          .post(`/checkin/${conversation.id}/contact-request`)
          .set('authorization', `Bearer ${loggedInCandidate.token}`);

      expect(response.status).toBe(201);
      expect(SlackMocks.sendCheckinContactRequestAlert).toHaveBeenCalledTimes(
        1
      );
    });
  });

  describe('POST /checkin/:conversationId/note (note haute)', () => {
    it('returns 404 when no rating has been submitted yet', async () => {
      const conversation = await createEligibleConversation();

      const response: APIResponse<CheckinController['sendNote']> =
        await request(server)
          .post(`/checkin/${conversation.id}/note`)
          .send({ content: 'Merci pour tout !' })
          .set('authorization', `Bearer ${loggedInCandidate.token}`);

      expect(response.status).toBe(404);
    });

    it('returns 403 when the rating is not eligible for a note (< 4)', async () => {
      const conversation = await createEligibleConversation();
      await request(server)
        .put(`/checkin/${conversation.id}`)
        .send({ rating: 3 })
        .set('authorization', `Bearer ${loggedInCandidate.token}`);

      const response: APIResponse<CheckinController['sendNote']> =
        await request(server)
          .post(`/checkin/${conversation.id}/note`)
          .send({ content: 'Merci pour tout !' })
          .set('authorization', `Bearer ${loggedInCandidate.token}`);

      expect(response.status).toBe(403);
    });

    it('creates a CHECKIN_NOTE service message with structured metadata when the rating is 4 or 5', async () => {
      const conversation = await createEligibleConversation();
      await request(server)
        .put(`/checkin/${conversation.id}`)
        .send({ rating: 5 })
        .set('authorization', `Bearer ${loggedInCandidate.token}`);

      const response: APIResponse<CheckinController['sendNote']> =
        await request(server)
          .post(`/checkin/${conversation.id}/note`)
          .send({ content: 'Merci pour tout !' })
          .set('authorization', `Bearer ${loggedInCandidate.token}`);

      expect(response.status).toBe(201);
      expect(response.body.noteSentAt).not.toBeNull();

      const serviceMessage = await messageModel.findOne({
        where: { conversationId: conversation.id, type: MessageType.SERVICE },
      });
      expect(serviceMessage).not.toBeNull();
      expect(serviceMessage?.authorId).toBeNull();
      expect(serviceMessage?.serviceMessageKind).toBe(
        ServiceMessageKind.CHECKIN_NOTE
      );
      expect(serviceMessage?.metadata).toEqual({
        authorFirstName: loggedInCandidate.user.firstName,
        quotedText: 'Merci pour tout !',
      });
      expect(serviceMessage?.content).toContain('Merci pour tout !');
      expect(serviceMessage?.content).toContain(
        loggedInCandidate.user.firstName
      );
    });

    it('does not create a second service message on a repeated call', async () => {
      const conversation = await createEligibleConversation();
      await request(server)
        .put(`/checkin/${conversation.id}`)
        .send({ rating: 4 })
        .set('authorization', `Bearer ${loggedInCandidate.token}`);

      await request(server)
        .post(`/checkin/${conversation.id}/note`)
        .send({ content: 'Premier mot' })
        .set('authorization', `Bearer ${loggedInCandidate.token}`);
      await request(server)
        .post(`/checkin/${conversation.id}/note`)
        .send({ content: 'Second mot' })
        .set('authorization', `Bearer ${loggedInCandidate.token}`);

      const serviceMessagesCount = await messageModel.count({
        where: { conversationId: conversation.id, type: MessageType.SERVICE },
      });
      expect(serviceMessagesCount).toBe(1);
    });

    it('sends a checkin note notification mail to the other participant', async () => {
      const conversation = await createEligibleConversation();
      await request(server)
        .put(`/checkin/${conversation.id}`)
        .send({ rating: 5 })
        .set('authorization', `Bearer ${loggedInCandidate.token}`);

      await request(server)
        .post(`/checkin/${conversation.id}/note`)
        .send({ content: 'Merci pour tout !' })
        .set('authorization', `Bearer ${loggedInCandidate.token}`);

      expect(addToWorkQueueSpy).toHaveBeenCalledWith(
        Jobs.SEND_MAIL,
        expect.objectContaining({
          toEmail: loggedInCoach.user.email,
          templateId: MailjetTemplates.MAILER_CONVERSATION_CHECKIN_NOTE,
          variables: expect.objectContaining({
            firstName: loggedInCoach.user.firstName,
            message: 'Merci pour tout !',
            otherParticipantFirstName: loggedInCandidate.user.firstName,
          }),
        })
      );
    });

    it('does not send a checkin note notification mail on a repeated call', async () => {
      const conversation = await createEligibleConversation();
      await request(server)
        .put(`/checkin/${conversation.id}`)
        .send({ rating: 4 })
        .set('authorization', `Bearer ${loggedInCandidate.token}`);

      await request(server)
        .post(`/checkin/${conversation.id}/note`)
        .send({ content: 'Premier mot' })
        .set('authorization', `Bearer ${loggedInCandidate.token}`);
      addToWorkQueueSpy.mockClear();
      await request(server)
        .post(`/checkin/${conversation.id}/note`)
        .send({ content: 'Second mot' })
        .set('authorization', `Bearer ${loggedInCandidate.token}`);

      expect(addToWorkQueueSpy).not.toHaveBeenCalled();
    });

    it('does not send a checkin note notification mail when service message creation fails', async () => {
      const conversation = await createEligibleConversation();
      await request(server)
        .put(`/checkin/${conversation.id}`)
        .send({ rating: 5 })
        .set('authorization', `Bearer ${loggedInCandidate.token}`);

      const createServiceMessageSpy = jest
        .spyOn(messagingService, 'createServiceMessage')
        .mockRejectedValueOnce(new Error('boom'));

      await request(server)
        .post(`/checkin/${conversation.id}/note`)
        .send({ content: 'Merci pour tout !' })
        .set('authorization', `Bearer ${loggedInCandidate.token}`);

      expect(addToWorkQueueSpy).not.toHaveBeenCalled();
      createServiceMessageSpy.mockRestore();
    });

    it('does not send a checkin note notification mail when "Passer" is clicked (no note sent)', async () => {
      const conversation = await createEligibleConversation();
      await request(server)
        .put(`/checkin/${conversation.id}`)
        .send({ rating: 5 })
        .set('authorization', `Bearer ${loggedInCandidate.token}`);

      expect(addToWorkQueueSpy).not.toHaveBeenCalled();
    });
  });

  describe('CheckinService.getEligibleCheckinParticipants (cron)', () => {
    it.each([
      ['invitation', CHECKIN_ELIGIBILITY_THRESHOLD_DAYS],
      ['relance', CHECKIN_RELANCE_THRESHOLD_DAYS],
    ])(
      'includes both participants of a direct conversation exactly at the %s threshold',
      async (_label, daysThreshold) => {
        const conversation = await createConversation({
          engagementThresholdReachedAt: daysAgo(daysThreshold + 0.5),
        });

        const recipients =
          await checkinService.getEligibleCheckinParticipants(daysThreshold);

        expect(recipients).toContainEqual({
          conversationId: conversation.id,
          userId: loggedInCandidate.user.id,
        });
        expect(recipients).toContainEqual({
          conversationId: conversation.id,
          userId: loggedInCoach.user.id,
        });
      }
    );

    it.each([
      ['invitation', CHECKIN_ELIGIBILITY_THRESHOLD_DAYS],
      ['relance', CHECKIN_RELANCE_THRESHOLD_DAYS],
    ])(
      'excludes a conversation whose %s threshold was reached too recently',
      async (_label, daysThreshold) => {
        const conversation = await createConversation({
          engagementThresholdReachedAt: daysAgo(10),
        });

        const recipients =
          await checkinService.getEligibleCheckinParticipants(daysThreshold);

        expect(recipients).not.toContainEqual(
          expect.objectContaining({ conversationId: conversation.id })
        );
      }
    );

    it.each([
      ['invitation', CHECKIN_ELIGIBILITY_THRESHOLD_DAYS],
      ['relance', CHECKIN_RELANCE_THRESHOLD_DAYS],
    ])(
      'excludes a conversation whose %s threshold was reached too long ago',
      async (_label, daysThreshold) => {
        const conversation = await createConversation({
          engagementThresholdReachedAt: daysAgo(daysThreshold + 5),
        });

        const recipients =
          await checkinService.getEligibleCheckinParticipants(daysThreshold);

        expect(recipients).not.toContainEqual(
          expect.objectContaining({ conversationId: conversation.id })
        );
      }
    );

    it('excludes a group conversation even within the eligibility window', async () => {
      const conversation = await createConversation({
        type: ConversationType.GROUP,
        engagementThresholdReachedAt: daysAgo(
          CHECKIN_ELIGIBILITY_THRESHOLD_DAYS + 0.5
        ),
      });

      const recipients = await checkinService.getEligibleCheckinParticipants(
        CHECKIN_ELIGIBILITY_THRESHOLD_DAYS
      );

      expect(recipients).not.toContainEqual(
        expect.objectContaining({ conversationId: conversation.id })
      );
    });

    it('excludes a conversation with no engagementThresholdReachedAt', async () => {
      const conversation = await createConversation({
        engagementThresholdReachedAt: null,
      });

      const recipients = await checkinService.getEligibleCheckinParticipants(
        CHECKIN_ELIGIBILITY_THRESHOLD_DAYS
      );

      expect(recipients).not.toContainEqual(
        expect.objectContaining({ conversationId: conversation.id })
      );
    });

    it('excludes a participant who already has a ConversationCheckin record, but keeps the other participant', async () => {
      const conversation = await createConversation({
        engagementThresholdReachedAt: daysAgo(
          CHECKIN_ELIGIBILITY_THRESHOLD_DAYS + 0.5
        ),
      });
      await conversationCheckinModel.create({
        conversationId: conversation.id,
        userId: loggedInCandidate.user.id,
      });

      const recipients = await checkinService.getEligibleCheckinParticipants(
        CHECKIN_ELIGIBILITY_THRESHOLD_DAYS
      );

      expect(recipients).not.toContainEqual({
        conversationId: conversation.id,
        userId: loggedInCandidate.user.id,
      });
      expect(recipients).toContainEqual({
        conversationId: conversation.id,
        userId: loggedInCoach.user.id,
      });
    });

    it('excludes a participant with only a started (unfinished) checkin, not just a completed one', async () => {
      const conversation = await createConversation({
        engagementThresholdReachedAt: daysAgo(
          CHECKIN_RELANCE_THRESHOLD_DAYS + 0.5
        ),
      });
      await conversationCheckinModel.create({
        conversationId: conversation.id,
        userId: loggedInCandidate.user.id,
        stillInTouch: CheckinStillInTouch.YES,
      });

      const recipients = await checkinService.getEligibleCheckinParticipants(
        CHECKIN_RELANCE_THRESHOLD_DAYS
      );

      expect(recipients).not.toContainEqual({
        conversationId: conversation.id,
        userId: loggedInCandidate.user.id,
      });
    });
  });

  describe('CheckinService.getCatchupEligibleCheckinParticipants (one-shot deployment catchup)', () => {
    const catchupMinDate = new Date(
      CHECKIN_CATCHUP_MIN_ENGAGEMENT_THRESHOLD_DATE
    );

    it('includes both participants of a direct conversation whose threshold is well past 30 days but after the min date', async () => {
      const conversation = await createConversation({
        engagementThresholdReachedAt: daysAgo(
          CHECKIN_ELIGIBILITY_THRESHOLD_DAYS + 10
        ),
      });

      const recipients =
        await checkinService.getCatchupEligibleCheckinParticipants();

      expect(recipients).toContainEqual({
        conversationId: conversation.id,
        userId: loggedInCandidate.user.id,
      });
      expect(recipients).toContainEqual({
        conversationId: conversation.id,
        userId: loggedInCoach.user.id,
      });
    });

    it('excludes a conversation whose engagementThresholdReachedAt is before the min catchup date', async () => {
      const conversation = await createConversation({
        engagementThresholdReachedAt: new Date(
          catchupMinDate.getTime() - DAY_IN_MS
        ),
      });

      const recipients =
        await checkinService.getCatchupEligibleCheckinParticipants();

      expect(recipients).not.toContainEqual(
        expect.objectContaining({ conversationId: conversation.id })
      );
    });

    it('excludes a conversation whose threshold was reached exactly 30 days ago (left to the daily cron)', async () => {
      const conversation = await createConversation({
        engagementThresholdReachedAt: daysAgo(
          CHECKIN_ELIGIBILITY_THRESHOLD_DAYS - 0.5
        ),
      });

      const recipients =
        await checkinService.getCatchupEligibleCheckinParticipants();

      expect(recipients).not.toContainEqual(
        expect.objectContaining({ conversationId: conversation.id })
      );
    });

    it('excludes a participant who already has a ConversationCheckin record, but keeps the other participant', async () => {
      const conversation = await createConversation({
        engagementThresholdReachedAt: daysAgo(
          CHECKIN_ELIGIBILITY_THRESHOLD_DAYS + 10
        ),
      });
      await conversationCheckinModel.create({
        conversationId: conversation.id,
        userId: loggedInCandidate.user.id,
      });

      const recipients =
        await checkinService.getCatchupEligibleCheckinParticipants();

      expect(recipients).not.toContainEqual({
        conversationId: conversation.id,
        userId: loggedInCandidate.user.id,
      });
      expect(recipients).toContainEqual({
        conversationId: conversation.id,
        userId: loggedInCoach.user.id,
      });
    });

    it('excludes a group conversation even within the eligibility window', async () => {
      const conversation = await createConversation({
        type: ConversationType.GROUP,
        engagementThresholdReachedAt: daysAgo(
          CHECKIN_ELIGIBILITY_THRESHOLD_DAYS + 10
        ),
      });

      const recipients =
        await checkinService.getCatchupEligibleCheckinParticipants();

      expect(recipients).not.toContainEqual(
        expect.objectContaining({ conversationId: conversation.id })
      );
    });
  });

  describe('runCheckinCatchupScript (one-shot deployment catchup script)', () => {
    const runScript = () =>
      runCheckinCatchupScript(
        checkinService,
        new CronTasksSlackReporterService(slackService)
      );

    it('sends the invitation mail to catchup-eligible participants', async () => {
      await createConversation({
        engagementThresholdReachedAt: daysAgo(
          CHECKIN_ELIGIBILITY_THRESHOLD_DAYS + 10
        ),
      });

      await runScript();

      expect(addToWorkQueueSpy).toHaveBeenCalledWith(
        Jobs.SEND_MAIL,
        expect.objectContaining({
          toEmail: loggedInCandidate.user.email,
          templateId: MailjetTemplates.MAILER_CONVERSATION_CHECKIN_INVITATION,
        })
      );
      expect(addToWorkQueueSpy).toHaveBeenCalledWith(
        Jobs.SEND_MAIL,
        expect.objectContaining({
          toEmail: loggedInCoach.user.email,
          templateId: MailjetTemplates.MAILER_CONVERSATION_CHECKIN_INVITATION,
        })
      );
      expect(slackService.sendTechnicalMonitoringMessage).toHaveBeenCalledWith(
        true,
        expect.stringContaining('Checkin catchup mails'),
        expect.anything(),
        expect.anything()
      );
    });

    it('does not send anything to a participant who already has a ConversationCheckin', async () => {
      const conversation = await createConversation({
        engagementThresholdReachedAt: daysAgo(
          CHECKIN_ELIGIBILITY_THRESHOLD_DAYS + 10
        ),
      });
      await conversationCheckinModel.create({
        conversationId: conversation.id,
        userId: loggedInCandidate.user.id,
      });

      await runScript();

      expect(addToWorkQueueSpy).not.toHaveBeenCalledWith(
        Jobs.SEND_MAIL,
        expect.objectContaining({ toEmail: loggedInCandidate.user.email })
      );
      expect(addToWorkQueueSpy).toHaveBeenCalledWith(
        Jobs.SEND_MAIL,
        expect.objectContaining({ toEmail: loggedInCoach.user.email })
      );
    });

    it('does not send anything for a conversation at exactly the 30-day threshold (left to the daily cron)', async () => {
      await createConversation({
        engagementThresholdReachedAt: daysAgo(
          CHECKIN_ELIGIBILITY_THRESHOLD_DAYS - 0.5
        ),
      });

      await runScript();

      expect(addToWorkQueueSpy).not.toHaveBeenCalled();
    });

    it('does not send anything for a conversation whose threshold predates the catchup min date', async () => {
      await createConversation({
        engagementThresholdReachedAt: new Date(
          new Date(CHECKIN_CATCHUP_MIN_ENGAGEMENT_THRESHOLD_DATE).getTime() -
            DAY_IN_MS
        ),
      });

      await runScript();

      expect(addToWorkQueueSpy).not.toHaveBeenCalled();
    });
  });

  describe('CheckinService.sendInvitationMails / sendRelanceMails (cron)', () => {
    it('sends the invitation mail to both participants, each with their own autologin token', async () => {
      const conversation = await createEligibleConversation();

      await checkinService.sendInvitationMails([
        { conversationId: conversation.id, userId: loggedInCandidate.user.id },
        { conversationId: conversation.id, userId: loggedInCoach.user.id },
      ]);

      expect(addToWorkQueueSpy).toHaveBeenCalledTimes(2);
      expect(addToWorkQueueSpy).toHaveBeenCalledWith(
        Jobs.SEND_MAIL,
        expect.objectContaining({
          toEmail: loggedInCandidate.user.email,
          templateId: MailjetTemplates.MAILER_CONVERSATION_CHECKIN_INVITATION,
        })
      );
      expect(addToWorkQueueSpy).toHaveBeenCalledWith(
        Jobs.SEND_MAIL,
        expect.objectContaining({
          toEmail: loggedInCoach.user.email,
          templateId: MailjetTemplates.MAILER_CONVERSATION_CHECKIN_INVITATION,
        })
      );
    });

    it('sends the relance mail with the relance template, only to the given recipient', async () => {
      const conversation = await createEligibleConversation();

      await checkinService.sendRelanceMails([
        { conversationId: conversation.id, userId: loggedInCandidate.user.id },
      ]);

      expect(addToWorkQueueSpy).toHaveBeenCalledTimes(1);
      expect(addToWorkQueueSpy).toHaveBeenCalledWith(
        Jobs.SEND_MAIL,
        expect.objectContaining({
          toEmail: loggedInCandidate.user.email,
          templateId: MailjetTemplates.MAILER_CONVERSATION_CHECKIN_RELANCE,
        })
      );
    });

    it('only sends to the recipients passed in, not unconditionally to every participant (no double-send to an already-checked-in participant)', async () => {
      const conversation = await createEligibleConversation();

      await checkinService.sendInvitationMails([
        { conversationId: conversation.id, userId: loggedInCandidate.user.id },
      ]);

      expect(addToWorkQueueSpy).toHaveBeenCalledTimes(1);
      expect(addToWorkQueueSpy).toHaveBeenCalledWith(
        Jobs.SEND_MAIL,
        expect.objectContaining({ toEmail: loggedInCandidate.user.email })
      );
    });

    it('does nothing for an unknown conversation', async () => {
      await checkinService.sendInvitationMails([
        {
          conversationId: '00000000-0000-0000-0000-000000000000',
          userId: loggedInCandidate.user.id,
        },
      ]);

      expect(addToWorkQueueSpy).not.toHaveBeenCalled();
    });
  });

  describe('Parcours complet', () => {
    it('note basse (1-2): questions puis alerte référent sur demande de contact', async () => {
      const conversation = await createEligibleConversation();
      const token = loggedInCandidate.token;
      const put = (body: Record<string, unknown>) =>
        request(server)
          .put(`/checkin/${conversation.id}`)
          .send(body)
          .set('authorization', `Bearer ${token}`);

      await put({ stillInTouch: CheckinStillInTouch.YES });
      await put({
        exchangeModes: [CheckinExchangeMode.ENTOURAGE_PRO_MESSAGES],
      });
      await put({ exchangeFrequency: CheckinExchangeFrequency.WEEKLY });
      await put({
        perceivedBenefits: [CheckinPerceivedBenefitCandidate.CONCRETE_ADVICE],
      });
      await put({ perceivedSupport: CheckinPerceivedSupport.YES_A_BIT });
      const ratingResponse = await put({ rating: 1 });
      expect(ratingResponse.status).toBe(200);
      await put({ comment: 'Ça ne se passe pas très bien' });

      const contactResponse: APIResponse<
        CheckinController['requestStaffContact']
      > = await request(server)
        .post(`/checkin/${conversation.id}/contact-request`)
        .set('authorization', `Bearer ${token}`);

      expect(contactResponse.status).toBe(201);
      expect(contactResponse.body.contactRequestedAt).not.toBeNull();
      expect(SlackMocks.sendCheckinContactRequestAlert).toHaveBeenCalledTimes(
        1
      );

      const finalCheckin = await conversationCheckinModel.findOne({
        where: {
          conversationId: conversation.id,
          userId: loggedInCandidate.user.id,
        },
      });
      expect(finalCheckin?.rating).toBe(1);
      expect(finalCheckin?.comment).toBe('Ça ne se passe pas très bien');
    });

    it('note haute (4-5): questions puis mot envoyé, visible et distinct pour les deux participants', async () => {
      const conversation = await createEligibleConversation();
      const token = loggedInCandidate.token;
      const put = (body: Record<string, unknown>) =>
        request(server)
          .put(`/checkin/${conversation.id}`)
          .send(body)
          .set('authorization', `Bearer ${token}`);

      await put({ stillInTouch: CheckinStillInTouch.YES });
      await put({
        exchangeModes: [
          CheckinExchangeMode.IN_PERSON,
          CheckinExchangeMode.PHONE,
        ],
      });
      await put({ exchangeFrequency: CheckinExchangeFrequency.MONTHLY });
      await put({
        perceivedBenefits: [
          CheckinPerceivedBenefitCandidate.FIND_JOB_INTERNSHIP_OR_APPRENTICESHIP,
        ],
      });
      await put({ employmentType: CheckinEmploymentType.JOB });
      await put({ perceivedSupport: CheckinPerceivedSupport.YES_A_LOT });
      const ratingResponse = await put({ rating: 5 });
      expect(ratingResponse.status).toBe(200);
      // Note 4-5: no free comment step in the flow, straight to the final screen.

      const noteResponse: APIResponse<CheckinController['sendNote']> =
        await request(server)
          .post(`/checkin/${conversation.id}/note`)
          .send({ content: "J'ai trouvé un emploi grâce à vous, merci !" })
          .set('authorization', `Bearer ${token}`);

      expect(noteResponse.status).toBe(201);

      const serviceMessage = await messageModel.findOne({
        where: { conversationId: conversation.id, type: MessageType.SERVICE },
      });
      expect(serviceMessage?.serviceMessageKind).toBe(
        ServiceMessageKind.CHECKIN_NOTE
      );
      expect(serviceMessage?.metadata).toEqual({
        authorFirstName: loggedInCandidate.user.firstName,
        quotedText: "J'ai trouvé un emploi grâce à vous, merci !",
      });

      // Visible to the other participant too (same conversation, no per-user scoping).
      const conversationWithMessages = await messagingHelper.findConversation(
        conversation.id
      );
      expect(
        conversationWithMessages?.messages.some(
          (message) => message.id === serviceMessage?.id
        )
      ).toBe(true);
    });

    it('note moyenne (3): pas d’alerte référent ni de mot envoyé', async () => {
      const conversation = await createEligibleConversation();
      await request(server)
        .put(`/checkin/${conversation.id}`)
        .send({ rating: 3 })
        .set('authorization', `Bearer ${loggedInCandidate.token}`);

      const contactResponse: APIResponse<
        CheckinController['requestStaffContact']
      > = await request(server)
        .post(`/checkin/${conversation.id}/contact-request`)
        .set('authorization', `Bearer ${loggedInCandidate.token}`);
      const noteResponse: APIResponse<CheckinController['sendNote']> =
        await request(server)
          .post(`/checkin/${conversation.id}/note`)
          .send({ content: 'Bof' })
          .set('authorization', `Bearer ${loggedInCandidate.token}`);

      expect(contactResponse.status).toBe(403);
      expect(noteResponse.status).toBe(403);
      const serviceMessagesCount = await messageModel.count({
        where: { conversationId: conversation.id, type: MessageType.SERVICE },
      });
      expect(serviceMessagesCount).toBe(0);
      expect(SlackMocks.sendCheckinContactRequestAlert).not.toHaveBeenCalled();
    });

    it('completedAt reste null tant que rating n’a pas été soumis, puis est posé au même appel', async () => {
      const conversation = await createEligibleConversation();
      const token = loggedInCandidate.token;
      const put = (body: Record<string, unknown>) =>
        request(server)
          .put(`/checkin/${conversation.id}`)
          .send(body)
          .set('authorization', `Bearer ${token}`);

      const afterStillInTouch = await put({
        stillInTouch: CheckinStillInTouch.YES,
      });
      expect(afterStillInTouch.body.completedAt).toBeNull();
      const afterPerceivedSupport = await put({
        perceivedSupport: CheckinPerceivedSupport.YES_A_BIT,
      });
      expect(afterPerceivedSupport.body.completedAt).toBeNull();

      const afterRating = await put({ rating: 4 });

      expect(afterRating.body.completedAt).not.toBeNull();
      const checkin = await conversationCheckinModel.findOne({
        where: {
          conversationId: conversation.id,
          userId: loggedInCandidate.user.id,
        },
      });
      expect(checkin?.completedAt).not.toBeNull();
    });

    it('un checkin déjà commencé ne peut pas être recommencé ni écrasé', async () => {
      const conversation = await createEligibleConversation();
      await request(server)
        .put(`/checkin/${conversation.id}`)
        .send({ stillInTouch: CheckinStillInTouch.YES })
        .set('authorization', `Bearer ${loggedInCandidate.token}`);

      const retry: APIResponse<CheckinController['submitAnswer']> =
        await request(server)
          .put(`/checkin/${conversation.id}`)
          .send({ stillInTouch: CheckinStillInTouch.NO_TOO_BAD })
          .set('authorization', `Bearer ${loggedInCandidate.token}`);

      expect(retry.status).toBe(409);
      const checkin = await conversationCheckinModel.findOne({
        where: {
          conversationId: conversation.id,
          userId: loggedInCandidate.user.id,
        },
      });
      expect(checkin?.stillInTouch).toBe(CheckinStillInTouch.YES);
    });
  });
});
