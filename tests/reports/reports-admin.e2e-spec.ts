import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/sequelize';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { SlackService } from 'src/external-services/slack/slack.service';
import { HelpGroup } from 'src/help-groups/models';
import { ConversationType } from 'src/messaging/models/conversation.model';
import { Post, PostReply } from 'src/posts/models';
import { QueuesService } from 'src/queues/producers/queues.service';
import { Report } from 'src/reports/models';
import {
  ReportReasons,
  ReportResolutions,
  ReportStatuses,
  ReportTargetType,
  ReportTargetTypes,
} from 'src/reports/reports.types';
import { UserRoles } from 'src/users/users.types';
import { ZoneName } from 'src/utils/types/zones.types';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import { DiscussionFactory } from 'tests/help-groups/discussion.factory';
import { HelpGroupFactory } from 'tests/help-groups/help-group.factory';
import { PostReplyFactory } from 'tests/help-groups/post-reply.factory';
import { ConversationFactory } from 'tests/messaging/conversation.factory';
import { MessagingHelper } from 'tests/messaging/messaging.helper';
import { SlackMocks } from 'tests/mocks.types';
import { QueuesServiceMock } from 'tests/queues/queues.service.mock';
import { UserFactory } from 'tests/users/user.factory';
import { LoggedInUser, UsersHelper } from 'tests/users/users.helper';
import { ReportFactory } from './report.factory';

describe('Reports - Admin', () => {
  let app: INestApplication;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let server: any;

  let databaseHelper: DatabaseHelper;
  let usersHelper: UsersHelper;
  let userFactory: UserFactory;
  let conversationFactory: ConversationFactory;
  let messagingHelper: MessagingHelper;
  let helpGroupFactory: HelpGroupFactory;
  let discussionFactory: DiscussionFactory;
  let postReplyFactory: PostReplyFactory;
  let reportFactory: ReportFactory;
  let reportModel: typeof Report;
  let postReplyModel: typeof PostReply;

  let admin: LoggedInUser;
  let coach: LoggedInUser;
  let candidate: LoggedInUser;
  let otherCandidate: LoggedInUser;

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

    databaseHelper = moduleFixture.get(DatabaseHelper);
    usersHelper = moduleFixture.get(UsersHelper);
    userFactory = moduleFixture.get(UserFactory);
    conversationFactory = moduleFixture.get(ConversationFactory);
    messagingHelper = moduleFixture.get(MessagingHelper);
    helpGroupFactory = moduleFixture.get(HelpGroupFactory);
    discussionFactory = moduleFixture.get(DiscussionFactory);
    postReplyFactory = moduleFixture.get(PostReplyFactory);
    reportFactory = moduleFixture.get(ReportFactory);
    reportModel = moduleFixture.get(getModelToken(Report));
    postReplyModel = moduleFixture.get(getModelToken(PostReply));
  });

  afterAll(async () => {
    await databaseHelper.resetTestDB();
    await app.close();
    server.close();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    await databaseHelper.resetTestDB();
    admin = await usersHelper.createLoggedInUser({
      role: UserRoles.ADMIN,
      zone: ZoneName.AURA,
    });
    coach = await usersHelper.createLoggedInUser({
      role: UserRoles.COACH,
      zone: ZoneName.AURA,
    });
    candidate = await usersHelper.createLoggedInUser({
      role: UserRoles.CANDIDATE,
      zone: ZoneName.IDF,
    });
    otherCandidate = await usersHelper.createLoggedInUser({
      role: UserRoles.CANDIDATE,
      zone: ZoneName.NORD,
    });
  });

  const get = (path: string, user = admin) =>
    request(server)
      .get(`/admin/reports${path}`)
      .set('authorization', `Bearer ${user.token}`);

  const resolve = (
    targetType: ReportTargetType,
    targetId: string,
    body: object = {},
    user = admin
  ) =>
    request(server)
      .post(`/admin/reports/targets/${targetType}/${targetId}/resolve`)
      .set('authorization', `Bearer ${user.token}`)
      .send(body);

  const reportProfile = (
    targetId: string,
    reporterId: string,
    props: Partial<Report> = {}
  ) =>
    reportFactory.create({
      targetType: ReportTargetTypes.USER_PROFILE,
      targetId,
      reporterId,
      zone: ZoneName.AURA,
      ...props,
    });

  const createConversation = async (
    participantIds: string[],
    type = ConversationType.DIRECT
  ) => {
    const conversation = await conversationFactory.create({ type });
    await messagingHelper.associationParticipantsToConversation(
      conversation.id,
      participantIds
    );
    return conversation;
  };

  const createReply = async () => {
    const group: HelpGroup = await helpGroupFactory.create();
    const discussion: Post = await discussionFactory.create(
      { authorId: coach.user.id, title: 'Une discussion' },
      group.id
    );
    const reply: PostReply = await postReplyFactory.create({
      postId: discussion.id,
      authorId: coach.user.id,
      content: 'Une réponse signalée',
    });
    return { group, discussion, reply };
  };

  describe('Access', () => {
    it('Should refuse every route to a non admin with a 403', async () => {
      await reportProfile(coach.user.id, candidate.user.id);
      const conversation = await createConversation([
        candidate.user.id,
        coach.user.id,
      ]);

      expect((await get('/targets', coach)).status).toBe(403);
      expect((await get('/pending-count', coach)).status).toBe(403);
      expect(
        (await get(`/targets/USER_PROFILE/${coach.user.id}`, coach)).status
      ).toBe(403);
      expect(
        (await get(`/targets/CONVERSATION/${conversation.id}/messages`, coach))
          .status
      ).toBe(403);
      expect(
        (
          await resolve(
            ReportTargetTypes.USER_PROFILE,
            coach.user.id,
            {},
            coach
          )
        ).status
      ).toBe(403);
    });
  });

  describe('List of the targets', () => {
    it('Should group the reports of a same target in a single row', async () => {
      await reportProfile(coach.user.id, candidate.user.id, {
        reason: ReportReasons.SPAM,
      });
      await reportProfile(coach.user.id, otherCandidate.user.id, {
        reason: ReportReasons.FRAUD,
      });
      await reportProfile(coach.user.id, admin.user.id, {
        reason: ReportReasons.SPAM,
      });

      const response = await get('/targets');

      expect(response.status).toBe(200);
      expect(response.body.items).toHaveLength(1);
      expect(response.body.items[0]).toMatchObject({
        targetType: ReportTargetTypes.USER_PROFILE,
        targetId: coach.user.id,
        label: `${coach.user.firstName} ${coach.user.lastName}`,
        pendingCount: 3,
        reportsCount: 3,
        status: 'PENDING',
        zones: [ZoneName.AURA],
      });
      expect([...response.body.items[0].reasons].sort()).toEqual(
        [ReportReasons.FRAUD, ReportReasons.SPAM].sort()
      );
      expect(response.body.nextCursor).toBeNull();
    });

    it('Should show again as pending a handled target reported again', async () => {
      await reportProfile(coach.user.id, candidate.user.id);
      expect(
        (await resolve(ReportTargetTypes.USER_PROFILE, coach.user.id)).status
      ).toBe(201);
      expect((await get('/targets')).body.items[0]).toMatchObject({
        status: 'RESOLVED',
        pendingCount: 0,
      });

      await reportProfile(coach.user.id, candidate.user.id);

      expect((await get('/targets')).body.items[0]).toMatchObject({
        status: 'PENDING',
        pendingCount: 1,
        reportsCount: 2,
      });
    });

    it('Should list a group conversation reported from two zones in both zones, and count it in both badges', async () => {
      const conversation = await createConversation(
        [candidate.user.id, otherCandidate.user.id, coach.user.id],
        ConversationType.GROUP
      );
      await reportFactory.create({
        targetType: ReportTargetTypes.CONVERSATION,
        targetId: conversation.id,
        reporterId: candidate.user.id,
        zone: ZoneName.IDF,
      });
      await reportFactory.create({
        targetType: ReportTargetTypes.CONVERSATION,
        targetId: conversation.id,
        reporterId: otherCandidate.user.id,
        zone: ZoneName.NORD,
      });

      for (const zone of [ZoneName.IDF, ZoneName.NORD]) {
        const list = await get(`/targets?zone=${zone}`);
        expect(
          list.body.items.map(({ targetId }: { targetId: string }) => targetId)
        ).toEqual([conversation.id]);
        expect([...list.body.items[0].zones].sort()).toEqual(
          [ZoneName.IDF, ZoneName.NORD].sort()
        );
        expect((await get(`/pending-count?zone=${zone}`)).body).toEqual({
          count: 1,
        });
      }
      expect((await get(`/targets?zone=${ZoneName.AURA}`)).body.items).toEqual(
        []
      );
      expect((await get(`/pending-count?zone=${ZoneName.AURA}`)).body).toEqual({
        count: 0,
      });
      expect(
        (await get(`/targets/CONVERSATION/${conversation.id}`)).body.label
      ).toContain('Conversation entre');
    });

    it('Should place a target to handle in the zones of its reports to handle only', async () => {
      // Handled in Paris, then reported again in Lyon
      await reportProfile(coach.user.id, candidate.user.id, {
        zone: ZoneName.IDF,
        status: ReportStatuses.RESOLVED,
        resolution: ReportResolutions.MANUAL,
      });
      await reportProfile(coach.user.id, otherCandidate.user.id, {
        zone: ZoneName.AURA,
      });

      const ids = async (query: string) =>
        (await get(`/targets?${query}`)).body.items.map(
          ({ targetId }: { targetId: string }) => targetId
        );
      expect(await ids(`status=PENDING&zone=${ZoneName.IDF}`)).toEqual([]);
      expect(await ids(`zone=${ZoneName.IDF}`)).toEqual([]);
      expect((await get(`/pending-count?zone=${ZoneName.IDF}`)).body).toEqual({
        count: 0,
      });
      expect(await ids(`status=PENDING&zone=${ZoneName.AURA}`)).toEqual([
        coach.user.id,
      ]);
      expect(
        (await get(`/targets?zone=${ZoneName.AURA}`)).body.items[0]
      ).toMatchObject({ zones: [ZoneName.AURA] });
      expect((await get(`/pending-count?zone=${ZoneName.AURA}`)).body).toEqual({
        count: 1,
      });

      // Once handled, the target belongs to the zones of all its reports
      await resolve(ReportTargetTypes.USER_PROFILE, coach.user.id);
      expect(await ids(`status=RESOLVED&zone=${ZoneName.IDF}`)).toEqual([
        coach.user.id,
      ]);
    });

    it('Should filter on type, status and zone, and list the targets to handle first', async () => {
      const conversation = await createConversation([
        candidate.user.id,
        coach.user.id,
      ]);
      const { reply } = await createReply();
      await reportFactory.create({
        targetType: ReportTargetTypes.CONVERSATION,
        targetId: conversation.id,
        reporterId: candidate.user.id,
        zone: ZoneName.AURA,
      });
      await reportFactory.create({
        targetType: ReportTargetTypes.POST_REPLY,
        targetId: reply.id,
        reporterId: candidate.user.id,
        zone: ZoneName.AURA,
      });
      // Handled, and the most recent: listed after the targets to handle
      await reportProfile(otherCandidate.user.id, candidate.user.id, {
        status: ReportStatuses.RESOLVED,
        resolution: ReportResolutions.MANUAL,
        zone: ZoneName.NORD,
      });

      const all = (await get('/targets')).body.items;
      expect(all.map(({ targetId }: { targetId: string }) => targetId)).toEqual(
        [reply.id, conversation.id, otherCandidate.user.id]
      );
      expect(all[0].label).toContain('Une réponse signalée');

      const ids = async (query: string) =>
        (await get(`/targets?${query}`)).body.items.map(
          ({ targetId }: { targetId: string }) => targetId
        );
      expect(await ids('type=GROUP_MESSAGE')).toEqual([reply.id]);
      expect(await ids('type=CONVERSATION')).toEqual([conversation.id]);
      expect(await ids('type=USER_PROFILE')).toEqual([otherCandidate.user.id]);
      expect(await ids('status=PENDING')).toEqual([reply.id, conversation.id]);
      expect(await ids('status=RESOLVED')).toEqual([otherCandidate.user.id]);
      expect(await ids(`status=PENDING&zone=${ZoneName.NORD}`)).toEqual([]);
      expect(await ids(`zone=${ZoneName.NORD}`)).toEqual([
        otherCandidate.user.id,
      ]);
      expect((await get('/targets?type=UNKNOWN')).status).toBe(400);
      expect((await get('/targets?zone=MARS')).status).toBe(400);
      expect((await get('/pending-count')).body).toEqual({ count: 2 });
    });

    it('Should load the list by pages', async () => {
      const users = await Promise.all(
        Array.from({ length: 21 }, () =>
          userFactory.create({ role: UserRoles.COACH })
        )
      );
      for (const user of users) {
        await reportProfile(user.id, candidate.user.id);
      }

      const first = await get('/targets');
      expect(first.body.items).toHaveLength(20);
      expect(first.body.nextCursor).toEqual(expect.any(String));
      const second = await get(
        `/targets?cursor=${encodeURIComponent(first.body.nextCursor)}`
      );
      expect(second.body.items).toHaveLength(1);
      expect(second.body.nextCursor).toBeNull();
      const listed = [...first.body.items, ...second.body.items].map(
        ({ targetId }: { targetId: string }) => targetId
      );
      expect(new Set(listed).size).toBe(21);
      expect((await get('/targets?cursor=invalide')).status).toBe(400);
    });
  });

  describe('Page of a target', () => {
    it('Should show the reports and the participants of a conversation, and read it all by pages', async () => {
      const conversation = await createConversation([
        candidate.user.id,
        coach.user.id,
      ]);
      for (let i = 0; i < 35; i += 1) {
        await messagingHelper.createMessage(
          conversation.id,
          i % 2 ? candidate.user.id : coach.user.id
        );
      }
      await reportFactory.create({
        targetType: ReportTargetTypes.CONVERSATION,
        targetId: conversation.id,
        reporterId: candidate.user.id,
        comment: 'Propos déplacés',
      });
      await reportFactory.create({
        targetType: ReportTargetTypes.CONVERSATION,
        targetId: conversation.id,
        reporterId: coach.user.id,
      });

      const page = await get(`/targets/CONVERSATION/${conversation.id}`);
      expect(page.status).toBe(200);
      expect(page.body).toMatchObject({
        targetType: ReportTargetTypes.CONVERSATION,
        targetId: conversation.id,
        status: 'PENDING',
        canResolve: true,
      });
      expect(page.body.reports).toHaveLength(2);
      expect(
        page.body.context.participants
          .map(({ id }: { id: string }) => id)
          .sort()
      ).toEqual([candidate.user.id, coach.user.id].sort());

      const first = await get(
        `/targets/CONVERSATION/${conversation.id}/messages`
      );
      expect(first.status).toBe(200);
      expect(first.body.messages).toHaveLength(30);
      const second = await get(
        `/targets/CONVERSATION/${conversation.id}/messages?before=${first.body.nextCursor}`
      );
      expect(second.body.messages).toHaveLength(5);
      expect(second.body.nextCursor).toBeNull();
      const ids = [...first.body.messages, ...second.body.messages].map(
        ({ id }) => id
      );
      expect(new Set(ids).size).toBe(35);
    });

    it('Should return the messages of a deleted author without identity', async () => {
      const conversation = await createConversation([
        candidate.user.id,
        coach.user.id,
      ]);
      await messagingHelper.createMessage(conversation.id, coach.user.id);
      await messagingHelper.createMessage(conversation.id, candidate.user.id);
      await reportFactory.create({
        targetType: ReportTargetTypes.CONVERSATION,
        targetId: conversation.id,
        reporterId: candidate.user.id,
      });
      await userFactory.delete(coach.user.id);

      const { messages } = (
        await get(`/targets/CONVERSATION/${conversation.id}/messages`)
      ).body;

      const byAuthor = (authorId: string) =>
        messages.find(
          (message: { authorId: string }) => message.authorId === authorId
        );
      expect(byAuthor(coach.user.id).author).toBeNull();
      expect(byAuthor(candidate.user.id).author).toMatchObject({
        id: candidate.user.id,
        firstName: candidate.user.firstName,
      });
    });

    it('Should answer 404 for a conversation never reported, on its page as on its messages', async () => {
      const conversation = await createConversation([
        candidate.user.id,
        coach.user.id,
      ]);
      expect(
        (await get(`/targets/CONVERSATION/${conversation.id}`)).status
      ).toBe(404);
      expect(
        (await get(`/targets/CONVERSATION/${conversation.id}/messages`)).status
      ).toBe(404);
      expect((await get(`/targets/USER_PROFILE/${coach.user.id}`)).status).toBe(
        404
      );
      expect((await get(`/targets/UNKNOWN/${coach.user.id}`)).status).toBe(400);
    });

    it('Should return a deleted reporter without identity', async () => {
      await reportProfile(coach.user.id, candidate.user.id);
      await userFactory.delete(candidate.user.id);

      const page = await get(`/targets/USER_PROFILE/${coach.user.id}`);

      expect(page.status).toBe(200);
      expect(page.body.reports[0].reporter).toBeNull();
      expect(page.body.context.user).toMatchObject({
        id: coach.user.id,
        firstName: coach.user.firstName,
      });
    });

    it('Should show the group, the content and the state of a group message, even hidden or deleted', async () => {
      const { group, discussion, reply } = await createReply();
      await reportFactory.create({
        targetType: ReportTargetTypes.POST_REPLY,
        targetId: reply.id,
        reporterId: candidate.user.id,
      });
      const context = async () =>
        (await get(`/targets/POST_REPLY/${reply.id}`)).body;

      const visible = await context();
      expect(visible.canResolve).toBe(false);
      expect(visible.context).toMatchObject({
        group: { id: group.id, name: group.name, slug: group.slug },
        message: {
          discussionId: discussion.id,
          replyId: reply.id,
          content: 'Une réponse signalée',
          state: 'VISIBLE',
          author: { id: coach.user.id },
        },
      });

      await postReplyModel.update(
        { hiddenAt: new Date() },
        { where: { id: reply.id } }
      );
      expect((await context()).context.message.state).toBe('HIDDEN');

      await postReplyModel.destroy({ where: { id: reply.id } });
      const deleted = await context();
      expect(deleted.context.message).toMatchObject({
        state: 'DELETED',
        content: 'Une réponse signalée',
      });
    });
  });

  describe('Closing', () => {
    it('Should close the pending reports of a profile with the note, the admin and the date', async () => {
      await reportProfile(coach.user.id, candidate.user.id);
      await reportProfile(coach.user.id, otherCandidate.user.id);

      const response = await resolve(
        ReportTargetTypes.USER_PROFILE,
        coach.user.id,
        { note: '  Échange avec la personne, sans suite  ' }
      );

      expect(response.status).toBe(201);
      expect(response.body).toEqual({ resolvedCount: 2 });
      const reports = await reportModel.findAll();
      reports.forEach((report) =>
        expect(report).toMatchObject({
          status: ReportStatuses.RESOLVED,
          resolution: ReportResolutions.MANUAL,
          resolvedById: admin.user.id,
          resolutionNote: 'Échange avec la personne, sans suite',
          resolvedAt: expect.any(Date),
        })
      );
      const page = await get(`/targets/USER_PROFILE/${coach.user.id}`);
      expect(page.body.status).toBe('RESOLVED');
      expect(page.body.reports[0]).toMatchObject({
        resolutionNote: 'Échange avec la personne, sans suite',
        resolvedBy: { id: admin.user.id },
      });
      // Nobody is told about the decision
      expect(SlackMocks.sendMessage).not.toHaveBeenCalled();
    });

    it('Should refuse to close a group message by hand with a 400', async () => {
      const { reply, discussion } = await createReply();
      await reportFactory.create({
        targetType: ReportTargetTypes.POST_REPLY,
        targetId: reply.id,
        reporterId: candidate.user.id,
      });

      expect(
        (await resolve(ReportTargetTypes.POST_REPLY, reply.id)).status
      ).toBe(400);
      expect(
        (await resolve(ReportTargetTypes.POST, discussion.id)).status
      ).toBe(400);
      expect(
        await reportModel.count({ where: { status: ReportStatuses.PENDING } })
      ).toBe(1);
    });

    it('Should refuse a too long note with a 400, and a target never reported with a 404', async () => {
      await reportProfile(coach.user.id, candidate.user.id);
      expect(
        (
          await resolve(ReportTargetTypes.USER_PROFILE, coach.user.id, {
            note: 'a'.repeat(1001),
          })
        ).status
      ).toBe(400);
      expect(
        (await resolve(ReportTargetTypes.USER_PROFILE, candidate.user.id))
          .status
      ).toBe(404);
    });
  });
});
