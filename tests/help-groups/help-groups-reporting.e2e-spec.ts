import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/sequelize';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { PusherService } from 'src/external-services/pusher/pusher.service';
import { SlackService } from 'src/external-services/slack/slack.service';
import { HelpGroupsReportingService } from 'src/help-groups/help-groups-reporting.service';
import { HelpGroup } from 'src/help-groups/models';
import { Post, PostReply } from 'src/posts/models';
import { PostsService } from 'src/posts/posts.service';
import { QueuesService } from 'src/queues/producers/queues.service';
import { Report } from 'src/reports/models';
import { ReportsService } from 'src/reports/reports.service';
import {
  ReportReasons,
  ReportResolutions,
  ReportStatuses,
  ReportTargetTypes,
} from 'src/reports/reports.types';
import { User } from 'src/users/models';
import { UserRoles } from 'src/users/users.types';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import { QueuesServiceMock } from 'tests/queues/queues.service.mock';
import { ReportFactory } from 'tests/reports/report.factory';
import { LoggedInUser, UsersHelper } from 'tests/users/users.helper';
import { DiscussionFactory } from './discussion.factory';
import { HelpGroupMembershipFactory } from './help-group-membership.factory';
import { HelpGroupFactory } from './help-group.factory';
import { PostReactionFactory } from './post-reaction.factory';
import { PostReplyFactory } from './post-reply.factory';

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';

// Resolves once `check` stops throwing: Slack alerts run after the response
const waitFor = async (check: () => void, timeoutMs = 5000) => {
  const start = Date.now();
  for (;;) {
    try {
      check();
      return;
    } catch (error) {
      if (Date.now() - start > timeoutMs) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }
};

const CANDIDATE_REFERENT_SLACK_EMAIL = 'referent-candidats@entourage.test';
const COACH_REFERENT_SLACK_EMAIL = 'referent-coachs@entourage.test';

describe('Help groups - Reporting', () => {
  let app: INestApplication;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let server: any;

  let databaseHelper: DatabaseHelper;
  let usersHelper: UsersHelper;
  let helpGroupFactory: HelpGroupFactory;
  let membershipFactory: HelpGroupMembershipFactory;
  let discussionFactory: DiscussionFactory;
  let postReplyFactory: PostReplyFactory;
  let postReactionFactory: PostReactionFactory;
  let reportFactory: ReportFactory;
  let reportsService: ReportsService;
  let reportingService: HelpGroupsReportingService;
  let slackService: SlackService;
  let queuesService: QueuesService;
  let postsService: PostsService;

  let postModel: typeof Post;
  let postReplyModel: typeof PostReply;
  let reportModel: typeof Report;

  const sendEvent = jest.fn();
  let sendMessage: jest.SpyInstance;
  let pendingAlerts: Promise<unknown>[];

  const route = '/help-groups';

  let group: HelpGroup;
  let author: LoggedInUser;
  let member: LoggedInUser;
  let admin: LoggedInUser;
  let discussion: Post;
  let reply: PostReply;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [CustomTestingModule],
    })
      .overrideProvider(QueuesService)
      .useClass(QueuesServiceMock)
      .overrideProvider(PusherService)
      .useValue({ sendEvent, authorizeChannel: jest.fn() })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    server = app.getHttpServer();

    databaseHelper = moduleFixture.get(DatabaseHelper);
    usersHelper = moduleFixture.get(UsersHelper);
    helpGroupFactory = moduleFixture.get(HelpGroupFactory);
    membershipFactory = moduleFixture.get(HelpGroupMembershipFactory);
    discussionFactory = moduleFixture.get(DiscussionFactory);
    postReplyFactory = moduleFixture.get(PostReplyFactory);
    postReactionFactory = moduleFixture.get(PostReactionFactory);
    reportFactory = moduleFixture.get(ReportFactory);
    reportsService = moduleFixture.get(ReportsService);
    reportingService = moduleFixture.get(HelpGroupsReportingService);
    slackService = moduleFixture.get(SlackService);
    queuesService = moduleFixture.get(QueuesService);
    postsService = moduleFixture.get(PostsService);

    postModel = moduleFixture.get(getModelToken(Post));
    postReplyModel = moduleFixture.get(getModelToken(PostReply));
    reportModel = moduleFixture.get(getModelToken(Report));
  });

  afterAll(async () => {
    await databaseHelper.resetTestDB();
    await app.close();
    server.close();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    sendEvent.mockResolvedValue({});
    // Keeps the alerts sent after each response, to wait for them
    pendingAlerts = [];
    const sendAlerts = reportingService['sendAlerts'].bind(reportingService);
    jest
      .spyOn(
        reportingService as unknown as { sendAlerts: typeof sendAlerts },
        'sendAlerts'
      )
      .mockImplementation((...args: Parameters<typeof sendAlerts>) => {
        const alert = sendAlerts(...args);
        pendingAlerts.push(alert);
        return alert;
      });
    sendMessage = jest
      .spyOn(slackService, 'sendMessage')
      .mockResolvedValue({ ok: true });
    jest
      .spyOn(slackService, 'getUserIdByEmail')
      .mockImplementation(async (email) =>
        email === CANDIDATE_REFERENT_SLACK_EMAIL
          ? 'U_CANDIDATES'
          : email === COACH_REFERENT_SLACK_EMAIL
            ? 'U_COACHES'
            : null
      );
    process.env.STAFF_CONTACT_CANDIDATE_SLACK_EMAIL_PARIS =
      CANDIDATE_REFERENT_SLACK_EMAIL;
    process.env.STAFF_CONTACT_COACH_SLACK_EMAIL_PARIS =
      COACH_REFERENT_SLACK_EMAIL;

    await databaseHelper.resetTestDB();
    group = await helpGroupFactory.create();
    author = await createMember();
    member = await createMember();
    admin = await usersHelper.createLoggedInUser({ role: UserRoles.ADMIN });
    discussion = await discussionFactory.create(
      { authorId: author.user.id, title: 'Trou dans le CV' },
      group.id
    );
    reply = await postReplyFactory.create({
      postId: discussion.id,
      authorId: author.user.id,
      content: 'Une réponse à signaler',
    });
  });

  afterEach(async () => {
    // The fire and forget alerts of the test end before the next one
    await Promise.allSettled(pendingAlerts);
    delete process.env.STAFF_CONTACT_CANDIDATE_SLACK_EMAIL_PARIS;
    delete process.env.STAFF_CONTACT_COACH_SLACK_EMAIL_PARIS;
    delete process.env.HELP_GROUPS_AUTO_HIDE_THRESHOLD;
  });

  const api = (
    method: Method,
    path: string,
    user?: LoggedInUser,
    body?: object
  ) => {
    const req = request(server)[method](path);
    if (user) {
      req.set('authorization', `Bearer ${user.token}`);
    }
    return body ? req.send(body) : req;
  };

  const createMember = async (props: Partial<User> = {}) => {
    const user = await usersHelper.createLoggedInUser({
      role: UserRoles.CANDIDATE,
      helpGroupsCharterAcceptedAt: new Date(),
      ...props,
    });
    await membershipFactory.create({ groupId: group.id, userId: user.user.id });
    return user;
  };

  const discussionPath = (id = discussion.id, slug = group.slug) =>
    `${route}/${slug}/discussions/${id}`;
  const reportsPath = (id = discussion.id, slug = group.slug) =>
    `${discussionPath(id, slug)}/reports`;

  const reportReply = (
    user: LoggedInUser,
    body: object = {},
    replyId = reply.id
  ) =>
    api('post', reportsPath(), user, {
      target: { replyId },
      reason: ReportReasons.INSULTS,
      ...body,
    });

  const reportDiscussion = (user: LoggedInUser, body: object = {}) =>
    api('post', reportsPath(), user, {
      target: { discussionId: discussion.id },
      reason: ReportReasons.SPAM,
      ...body,
    });

  const disableAutoHide = () => {
    process.env.HELP_GROUPS_AUTO_HIDE_THRESHOLD = '0';
  };

  const hideReply = (id = reply.id) =>
    postReplyModel.update({ hiddenAt: new Date() }, { where: { id } });
  const hideDiscussion = (id = discussion.id) =>
    postModel.update({ hiddenAt: new Date() }, { where: { id } });

  const findReplyRow = (id = reply.id) =>
    postReplyModel.findByPk(id, { paranoid: false });

  const getReplies = async (user: LoggedInUser) =>
    (await api('get', `${discussionPath()}/replies`, user)).body.items;

  describe('Reports storage', () => {
    const target = () => ({
      targetType: ReportTargetTypes.POST_REPLY,
      targetId: reply.id,
    });

    it('Should count the distinct reporters of the pending reports only', async () => {
      const other = await createMember();
      await reportFactory.create({ ...target(), reporterId: member.user.id });
      await reportFactory.create({ ...target(), reporterId: other.user.id });
      // A resolved report of the same person does not count
      await reportFactory.create({
        ...target(),
        reporterId: member.user.id,
        status: ReportStatuses.RESOLVED,
        resolution: ReportResolutions.RESTORED,
      });
      expect(await reportsService.countPendingDistinctReporters(target())).toBe(
        2
      );
    });

    it('Should refuse a second pending report of the same person on a target', async () => {
      await reportFactory.create({ ...target(), reporterId: member.user.id });
      await expect(
        reportsService.create({
          ...target(),
          reporterId: member.user.id,
          reason: ReportReasons.SPAM,
        })
      ).rejects.toMatchObject({ status: 409 });
      expect(await reportsService.countPendingDistinctReporters(target())).toBe(
        1
      );
    });
  });

  describe('Report a message', () => {
    it('Should save the report of a reply, with its motive and comment', async () => {
      const response = await reportReply(member, { comment: '  Insultant  ' });
      expect(response.status).toBe(201);
      const reports = await reportModel.findAll();
      expect(reports).toHaveLength(1);
      expect(reports[0]).toMatchObject({
        targetType: ReportTargetTypes.POST_REPLY,
        targetId: reply.id,
        reporterId: member.user.id,
        reason: ReportReasons.INSULTS,
        comment: 'Insultant',
        status: ReportStatuses.PENDING,
      });
      expect(response.body).toEqual({ id: reports[0].id });
    });

    it('Should save the report of the discussion message, without comment', async () => {
      const response = await reportDiscussion(member);
      expect(response.status).toBe(201);
      const [report] = await reportModel.findAll();
      expect(report).toMatchObject({
        targetType: ReportTargetTypes.POST,
        targetId: discussion.id,
        comment: null,
      });
    });

    it('Should accept the report of a non member, and of a person without eLearning', async () => {
      const outsider = await usersHelper.createLoggedInUser({
        role: UserRoles.COACH,
      });
      const noElearning = await createMember({ elearningCompletedAt: null });
      disableAutoHide();
      expect((await reportReply(outsider)).status).toBe(201);
      expect((await reportReply(noElearning)).status).toBe(201);
      expect(await reportModel.count()).toBe(2);
    });

    it('Should refuse the report of one’s own message with a 403', async () => {
      const response = await reportReply(author);
      expect(response.status).toBe(403);
      expect(await reportModel.count()).toBe(0);
    });

    it('Should refuse the report of a deleted reply with a 404', async () => {
      const deleted = await postReplyFactory.create({
        postId: discussion.id,
        authorId: author.user.id,
        deletedAt: new Date(),
      });
      expect((await reportReply(member, {}, deleted.id)).status).toBe(404);
    });

    it('Should refuse the report of a message already hidden for the reader with a 404', async () => {
      await hideReply();
      expect((await reportReply(member)).status).toBe(404);
    });

    it('Should refuse a reply of another discussion, and a deleted discussion', async () => {
      const other = await discussionFactory.create(
        { authorId: author.user.id },
        group.id
      );
      const otherReply = await postReplyFactory.create({
        postId: other.id,
        authorId: author.user.id,
      });
      expect((await reportReply(member, {}, otherReply.id)).status).toBe(404);
      await postModel.destroy({ where: { id: other.id } });
      const response = await api('post', reportsPath(other.id), member, {
        target: { discussionId: other.id },
        reason: ReportReasons.SPAM,
      });
      expect(response.status).toBe(404);
    });

    it('Should refuse the report of a message of an unpublished group with a 404', async () => {
      const unpublished = await helpGroupFactory.create({ publishedAt: null });
      const hidden = await discussionFactory.create(
        { authorId: author.user.id },
        unpublished.id
      );
      const response = await api(
        'post',
        reportsPath(hidden.id, unpublished.slug),
        admin,
        { target: { discussionId: hidden.id }, reason: ReportReasons.SPAM }
      );
      expect(response.status).toBe(404);
    });

    it('Should refuse a second report while the first is still to handle, with a 409', async () => {
      disableAutoHide();
      expect((await reportReply(member)).status).toBe(201);
      const response = await reportReply(member);
      expect(response.status).toBe(409);
      expect(response.body.message).toBe('REPORT_ALREADY_PENDING');
      expect(await reportModel.count()).toBe(1);
    });

    it('Should accept a new report once the previous one is handled', async () => {
      expect((await reportReply(member)).status).toBe(201);
      await api(
        'post',
        `/admin/help-groups/replies/${reply.id}/restore`,
        admin
      );
      expect((await reportReply(member)).status).toBe(201);
      expect(
        await reportModel.count({ where: { status: ReportStatuses.PENDING } })
      ).toBe(1);
    });

    it('Should refuse a missing or unknown motive, and a too long comment, with a 400', async () => {
      expect((await reportReply(member, { reason: undefined })).status).toBe(
        400
      );
      expect((await reportReply(member, { reason: 'RUDE' })).status).toBe(400);
      expect(
        (await reportReply(member, { comment: 'a'.repeat(1001) })).status
      ).toBe(400);
      expect(await reportModel.count()).toBe(0);
    });

    it('Should accept a comment of 1000 characters', async () => {
      expect(
        (await reportReply(member, { comment: 'a'.repeat(1000) })).status
      ).toBe(201);
    });

    it('Should refuse a target holding none or both messages with a 400', async () => {
      expect(
        (
          await api('post', reportsPath(), member, {
            target: {},
            reason: ReportReasons.SPAM,
          })
        ).status
      ).toBe(400);
      expect(
        (
          await api('post', reportsPath(), member, {
            target: { discussionId: discussion.id, replyId: reply.id },
            reason: ReportReasons.SPAM,
          })
        ).status
      ).toBe(400);
    });

    it('Should refuse an anonymous request with a 401', async () => {
      expect((await reportReply(undefined)).status).toBe(401);
    });
  });

  describe('Moderation alert', () => {
    it('Should alert the moderation channel with the report details, and send no email', async () => {
      disableAutoHide();
      const addToWorkQueue = jest.spyOn(queuesService, 'addToWorkQueue');
      const response = await reportReply(member, { comment: 'Très agressif' });
      expect(response.status).toBe(201);
      await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1));
      const [, blocks, text] = sendMessage.mock.calls[0];
      const blocksText = JSON.stringify(blocks);
      expect(text).toContain(group.name);
      expect(blocksText).toContain(group.name);
      expect(blocksText).toContain('Une réponse à signaler');
      expect(blocksText).toContain('Propos déplacés');
      expect(blocksText).toContain('Très agressif');
      expect(blocksText).toContain(`replyId=${reply.id}`);
      expect(blocksText).toContain(member.user.email);
      expect(blocksText).toContain(author.user.email);
      // Emails go through the work queue: nothing is queued
      expect(addToWorkQueue).not.toHaveBeenCalled();
    });

    it('Should escape the user written texts, so that they never mention anyone', async () => {
      disableAutoHide();
      await postReplyModel.update(
        { content: 'Bonjour <@U_CANDIDATES> & <!here>' },
        { where: { id: reply.id } }
      );
      await reportReply(member, { comment: '<!channel> urgent' });
      await Promise.allSettled(pendingAlerts);
      const blocksText = JSON.stringify(sendMessage.mock.calls[0][1]);
      expect(blocksText).not.toContain('<!channel>');
      expect(blocksText).not.toContain('<!here>');
      expect(blocksText).toContain('&lt;!channel&gt; urgent');
      expect(blocksText).toContain('&lt;@U_CANDIDATES&gt; &amp; &lt;!here&gt;');
    });

    it('Should mention a referent shared by the author and the reporter only once', async () => {
      disableAutoHide();
      await reportReply(member);
      await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1));
      const blocksText = JSON.stringify(sendMessage.mock.calls[0][1]);
      expect(blocksText.match(/<@U_CANDIDATES>/g)).toHaveLength(1);
      expect(blocksText).not.toContain('U_COACHES');
    });

    it('Should mention the referents of the author and of the reporter', async () => {
      disableAutoHide();
      const coach = await usersHelper.createLoggedInUser({
        role: UserRoles.COACH,
      });
      await reportReply(coach);
      await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1));
      const blocksText = JSON.stringify(sendMessage.mock.calls[0][1]);
      expect(blocksText).toContain('<@U_CANDIDATES>');
      expect(blocksText).toContain('<@U_COACHES>');
    });

    it('Should ignore a referent not found on Slack', async () => {
      disableAutoHide();
      delete process.env.STAFF_CONTACT_CANDIDATE_SLACK_EMAIL_PARIS;
      await reportReply(member);
      await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1));
      expect(JSON.stringify(sendMessage.mock.calls[0][1])).toContain(
        'Aucun référent identifié'
      );
    });

    it('Should save the report even when Slack fails', async () => {
      disableAutoHide();
      sendMessage.mockRejectedValue(new Error('Slack down'));
      const response = await reportReply(member);
      expect(response.status).toBe(201);
      await waitFor(() => expect(sendMessage).toHaveBeenCalled());
      expect(await reportModel.count()).toBe(1);
    });
  });

  describe('Automatic hiding', () => {
    it('Should hide a reply at its first report, signal it and send a priority alert', async () => {
      expect((await reportReply(member)).status).toBe(201);
      expect((await findReplyRow()).hiddenAt).not.toBeNull();
      expect(sendEvent).toHaveBeenCalledWith(
        `private-post-${discussion.id}`,
        'reply-updated',
        { discussionId: discussion.id, replyId: reply.id }
      );
      await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(2));
      // The two alerts are sent concurrently: found by their text, not order
      const priorityCall = sendMessage.mock.calls.find(([, , text]) =>
        String(text).startsWith('PRIORITAIRE')
      );
      const priority = JSON.stringify(priorityCall?.[1]);
      expect(priority).toContain('PRIORITAIRE');
      expect(priority).toContain('masqué automatiquement');
      expect(priority).toContain('Propos déplacés');
      expect(priority).toContain('<@U_CANDIDATES>');
    });

    it('Should hide the discussion message at its first report', async () => {
      expect((await reportDiscussion(member)).status).toBe(201);
      expect((await postModel.findByPk(discussion.id)).hiddenAt).not.toBeNull();
      expect(sendEvent).toHaveBeenCalledWith(
        `private-post-${discussion.id}`,
        'discussion-updated',
        { discussionId: discussion.id }
      );
    });

    it('Should keep a restored message visible, and hide it again on a new report', async () => {
      await reportReply(member);
      const restore = await api(
        'post',
        `/admin/help-groups/replies/${reply.id}/restore`,
        admin
      );
      expect(restore.status).toBe(204);
      expect((await findReplyRow()).hiddenAt).toBeNull();

      const other = await createMember();
      expect((await reportReply(other)).status).toBe(201);
      expect((await findReplyRow()).hiddenAt).not.toBeNull();
    });

    it('Should not hide anything when the threshold is 0', async () => {
      disableAutoHide();
      expect((await reportReply(member)).status).toBe(201);
      expect((await findReplyRow()).hiddenAt).toBeNull();
      await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1));
      expect(JSON.stringify(sendMessage.mock.calls[0][1])).not.toContain(
        'PRIORITAIRE'
      );
    });

    it('Should keep the default threshold of 1 when the env var is malformed', async () => {
      process.env.HELP_GROUPS_AUTO_HIDE_THRESHOLD = 'abc';
      expect(reportingService.getAutoHideThreshold()).toBe(1);
      expect((await reportReply(member)).status).toBe(201);
      expect((await findReplyRow()).hiddenAt).not.toBeNull();
    });

    it('Should wait for a second reporter when the threshold is 2', async () => {
      process.env.HELP_GROUPS_AUTO_HIDE_THRESHOLD = '2';
      await reportReply(member);
      expect((await findReplyRow()).hiddenAt).toBeNull();
      await reportReply(await createMember());
      expect((await findReplyRow()).hiddenAt).not.toBeNull();
    });

    it('Should recompute the last activity of the discussion without the hidden reply, then with it once restored', async () => {
      const lastActivityAt = async () =>
        (await postModel.findByPk(discussion.id)).lastActivityAt.getTime();
      await postReplyModel.update(
        { createdAt: new Date('2026-09-01T10:00:00.000Z') },
        { where: { id: reply.id }, silent: true }
      );
      const latest = await postReplyFactory.create({
        postId: discussion.id,
        authorId: author.user.id,
      });
      await postModel.update(
        { lastActivityAt: latest.createdAt },
        { where: { id: discussion.id } }
      );

      await reportReply(member, {}, latest.id);
      expect(await lastActivityAt()).toBe(
        Math.max(
          new Date(discussion.createdAt).getTime(),
          new Date('2026-09-01T10:00:00.000Z').getTime()
        )
      );

      await api(
        'post',
        `/admin/help-groups/replies/${latest.id}/restore`,
        admin
      );
      expect(await lastActivityAt()).toBe(new Date(latest.createdAt).getTime());
    });

    it('Should still send the priority alert when the report alert fails', async () => {
      sendMessage.mockRejectedValueOnce(new Error('Slack down'));
      expect((await reportReply(member)).status).toBe(201);
      await Promise.allSettled(pendingAlerts);
      expect(sendMessage).toHaveBeenCalledTimes(2);
      expect(
        sendMessage.mock.calls.some(([, , text]) =>
          String(text).includes('PRIORITAIRE')
        )
      ).toBe(true);
    });

    it('Should hide again with a report sent while a restoration holds the message', async () => {
      await hideReply();
      await reportFactory.create({
        targetType: ReportTargetTypes.POST_REPLY,
        targetId: reply.id,
        reporterId: member.user.id,
      });
      // A restoration in progress: it holds the reply row
      const restoration = await postReplyModel.sequelize.transaction();
      await postReplyModel.update(
        { hiddenAt: null },
        { where: { id: reply.id }, transaction: restoration }
      );
      // An admin can report a hidden message: the request waits for the lock
      const pending = reportReply(admin).then((response) => response);
      await new Promise((resolve) => setTimeout(resolve, 300));
      await reportModel.update(
        {
          status: ReportStatuses.RESOLVED,
          resolution: ReportResolutions.RESTORED,
        },
        {
          where: { targetId: reply.id, status: ReportStatuses.PENDING },
          transaction: restoration,
        }
      );
      await restoration.commit();

      expect((await pending).status).toBe(201);
      expect(
        await reportModel.findOne({ where: { reporterId: admin.user.id } })
      ).toMatchObject({ status: ReportStatuses.PENDING });
      expect((await findReplyRow()).hiddenAt).not.toBeNull();
    });

    it('Should save the report even when the hiding fails, without hiding anything', async () => {
      jest
        .spyOn(postsService, 'refreshLastActivityAt')
        .mockRejectedValueOnce(new Error('Database hiccup'));
      const response = await reportReply(member);
      expect(response.status).toBe(201);
      expect(await reportModel.count()).toBe(1);
      expect((await findReplyRow()).hiddenAt).toBeNull();
    });

    it('Should hide the message even when Slack fails', async () => {
      sendMessage.mockRejectedValue(new Error('Slack down'));
      expect((await reportReply(member)).status).toBe(201);
      expect((await findReplyRow()).hiddenAt).not.toBeNull();
    });
  });

  describe('Reads of a hidden message', () => {
    const contentKeys = ['content', 'title', 'author', 'reactionsSummary'];

    it('Should reduce a hidden reply to its id for another reader, on every reply read', async () => {
      await postReactionFactory.create({
        replyId: reply.id,
        userId: member.user.id,
      });
      await hideReply();
      const [item] = await getReplies(member);
      expect(item).toEqual({ id: reply.id, isUnderReview: true });
      contentKeys.forEach((key) => expect(item).not.toHaveProperty(key));
    });

    it('Should show their hidden reply to its author, with the mention', async () => {
      await hideReply();
      const [item] = await getReplies(author);
      expect(item).toMatchObject({
        id: reply.id,
        content: 'Une réponse à signaler',
        isUnderReview: true,
      });
      expect(item).not.toHaveProperty('reportReasons');
    });

    it('Should show a hidden reply to an admin, with the pending motives', async () => {
      await reportReply(member, { reason: ReportReasons.FRAUD });
      const [item] = await getReplies(admin);
      expect(item).toMatchObject({
        content: 'Une réponse à signaler',
        isUnderReview: true,
        reportReasons: [ReportReasons.FRAUD],
      });
    });

    it('Should mark a visible reply as not under review', async () => {
      const [item] = await getReplies(member);
      expect(item.isUnderReview).toBe(false);
    });

    it('Should reduce a hidden discussion to the mention for another reader', async () => {
      await hideDiscussion();
      const response = await api('get', discussionPath(), member);
      expect(response.status).toBe(200);
      expect(Object.keys(response.body).sort()).toEqual(
        ['group', 'id', 'isUnderReview', 'repliesCount'].sort()
      );
      expect(response.body.isUnderReview).toBe(true);
      // Its replies stay readable
      const [item] = await getReplies(member);
      expect(item.content).toBe('Une réponse à signaler');
    });

    it('Should show their hidden discussion to its author, and the motives to an admin', async () => {
      await reportDiscussion(member, { reason: ReportReasons.IN_DANGER });
      const forAuthor = (await api('get', discussionPath(), author)).body;
      expect(forAuthor).toMatchObject({
        title: 'Trou dans le CV',
        isUnderReview: true,
      });
      expect(forAuthor).not.toHaveProperty('reportReasons');
      const forAdmin = (await api('get', discussionPath(), admin)).body;
      expect(forAdmin).toMatchObject({
        title: 'Trou dans le CV',
        isUnderReview: true,
        reportReasons: [ReportReasons.IN_DANGER],
      });
    });

    it('Should leave a hidden discussion out of the group list, except for its author and the admins', async () => {
      await hideDiscussion();
      const listIds = async (user: LoggedInUser) =>
        (
          await api('get', `${route}/${group.slug}/discussions`, user)
        ).body.items.map(
          ({ id, isUnderReview }: { id: string; isUnderReview: boolean }) => ({
            id,
            isUnderReview,
          })
        );
      expect(await listIds(member)).toEqual([]);
      expect(await listIds(author)).toEqual([
        { id: discussion.id, isUnderReview: true },
      ]);
      expect(await listIds(admin)).toEqual([
        { id: discussion.id, isUnderReview: true },
      ]);
    });

    it('Should not count a hidden reply in the replies count', async () => {
      await postReplyFactory.create({
        postId: discussion.id,
        authorId: member.user.id,
      });
      await hideReply();
      const detail = (await api('get', discussionPath(), member)).body;
      expect(detail.repliesCount).toBe(1);
      const [item] = (
        await api('get', `${route}/${group.slug}/discussions`, member)
      ).body.items;
      expect(item.repliesCount).toBe(1);
    });

    it('Should leave the author of a hidden message out of the recent contributors', async () => {
      await hideReply();
      await hideDiscussion();
      const [card] = (await api('get', route, member)).body;
      expect(card.recentContributors).toEqual([]);
    });

    it('Should refuse a reaction on a hidden reply with a 404', async () => {
      await hideReply();
      const response = await api(
        'put',
        `${discussionPath()}/reactions`,
        member,
        { target: { replyId: reply.id }, emoji: '❤️' }
      );
      expect(response.status).toBe(404);
    });
  });

  describe('Admin decision', () => {
    it('Should restore a hidden reply, close its pending reports and signal it', async () => {
      await reportReply(member);
      sendEvent.mockClear();
      const response = await api(
        'post',
        `/admin/help-groups/replies/${reply.id}/restore`,
        admin
      );
      expect(response.status).toBe(204);
      expect((await findReplyRow()).hiddenAt).toBeNull();
      const [report] = await reportModel.findAll();
      expect(report).toMatchObject({
        status: ReportStatuses.RESOLVED,
        resolution: ReportResolutions.RESTORED,
        resolvedById: admin.user.id,
      });
      expect(report.resolvedAt).not.toBeNull();
      expect(sendEvent).toHaveBeenCalledWith(
        `private-post-${discussion.id}`,
        'reply-updated',
        { discussionId: discussion.id, replyId: reply.id }
      );
      const [item] = await getReplies(member);
      expect(item.content).toBe('Une réponse à signaler');
    });

    it('Should restore a hidden discussion', async () => {
      await reportDiscussion(member);
      const response = await api(
        'post',
        `/admin/help-groups/discussions/${discussion.id}/restore`,
        admin
      );
      expect(response.status).toBe(204);
      expect((await postModel.findByPk(discussion.id)).hiddenAt).toBeNull();
      expect((await reportModel.findOne()).resolution).toBe(
        ReportResolutions.RESTORED
      );
    });

    it('Should close the pending reports of a hidden message deleted by an admin', async () => {
      await reportReply(member);
      const response = await api(
        'delete',
        `/admin/help-groups/replies/${reply.id}`,
        admin,
        { reason: 'DISRESPECT' }
      );
      expect(response.status).toBe(204);
      expect(await getReplies(member)).toEqual([]);
      expect(await reportModel.findOne()).toMatchObject({
        status: ReportStatuses.RESOLVED,
        resolution: ReportResolutions.DELETED,
        resolvedById: admin.user.id,
      });
    });

    it('Should close the pending reports of a discussion deleted by an admin', async () => {
      await reportDiscussion(member);
      await api(
        'delete',
        `/admin/help-groups/discussions/${discussion.id}`,
        admin,
        {
          reason: 'SPAM',
        }
      );
      expect((await reportModel.findOne()).resolution).toBe(
        ReportResolutions.DELETED
      );
    });

    it('Should close the pending reports of its replies when an admin deletes a discussion', async () => {
      disableAutoHide();
      await reportReply(member);
      await api(
        'delete',
        `/admin/help-groups/discussions/${discussion.id}`,
        admin,
        { reason: 'SPAM' }
      );
      expect(await reportModel.findOne()).toMatchObject({
        targetType: ReportTargetTypes.POST_REPLY,
        status: ReportStatuses.RESOLVED,
        resolution: ReportResolutions.DELETED,
        resolvedById: admin.user.id,
      });
    });

    it('Should also close the reports of a reply its author deleted, when an admin deletes the discussion', async () => {
      disableAutoHide();
      await reportReply(member);
      await api(
        'delete',
        `${discussionPath()}/replies/${reply.id}`,
        author
      ).expect(204);
      await api(
        'delete',
        `/admin/help-groups/discussions/${discussion.id}`,
        admin,
        { reason: 'SPAM' }
      );
      expect(await reportModel.findOne()).toMatchObject({
        status: ReportStatuses.RESOLVED,
        resolution: ReportResolutions.DELETED,
      });
    });

    it('Should refuse the restoration to a non admin with a 403', async () => {
      await reportReply(member);
      const response = await api(
        'post',
        `/admin/help-groups/replies/${reply.id}/restore`,
        author
      );
      expect(response.status).toBe(403);
      expect((await findReplyRow()).hiddenAt).not.toBeNull();
    });

    it('Should refuse the restoration of a message outside help groups with a 404', async () => {
      const orphan = await postModel.create({
        authorId: author.user.id,
        content: 'Hors groupe',
      });
      const response = await api(
        'post',
        `/admin/help-groups/discussions/${orphan.id}/restore`,
        admin
      );
      expect(response.status).toBe(404);
    });
  });
});
