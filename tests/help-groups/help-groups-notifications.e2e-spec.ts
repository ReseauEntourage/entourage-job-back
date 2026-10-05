import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/sequelize';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { MailjetTemplates } from 'src/external-services/mailjet/mailjet.types';
import { PusherService } from 'src/external-services/pusher/pusher.service';
import { HelpGroupsDigestService } from 'src/help-groups/help-groups-digest.service';
import { HelpGroupsNotificationEmailsService } from 'src/help-groups/help-groups-notification-emails.service';
import {
  getHelpGroupNotificationEmailJobId,
  HELP_GROUP_NOTIFICATION_EMAIL_DELAY_MS,
} from 'src/help-groups/help-groups-notifications.service';
import { HelpGroup, HelpGroupMembership } from 'src/help-groups/models';
import { Notification } from 'src/notifications/models';
import { NotificationsService } from 'src/notifications/notifications.service';
import { NotificationTypes } from 'src/notifications/notifications.types';
import { Post } from 'src/posts/models';
import { QueuesService } from 'src/queues/producers/queues.service';
import {
  Jobs,
  SendHelpGroupNotificationEmailJob,
  SendMailJob,
} from 'src/queues/queues.types';
import { ReportReasons } from 'src/reports/reports.types';
import { User } from 'src/users/models';
import { UserRoles } from 'src/users/users.types';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import { QueuesServiceMock } from 'tests/queues/queues.service.mock';
import { LoggedInUser, UsersHelper } from 'tests/users/users.helper';
import { DiscussionFactory } from './discussion.factory';
import { HelpGroupMembershipFactory } from './help-group-membership.factory';
import { HelpGroupFactory } from './help-group.factory';
import { PostReplyFactory } from './post-reply.factory';

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

describe('Help groups - Notifications', () => {
  let app: INestApplication;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let server: any;

  let databaseHelper: DatabaseHelper;
  let usersHelper: UsersHelper;
  let helpGroupFactory: HelpGroupFactory;
  let membershipFactory: HelpGroupMembershipFactory;
  let discussionFactory: DiscussionFactory;
  let postReplyFactory: PostReplyFactory;
  let notificationsService: NotificationsService;
  let emailsService: HelpGroupsNotificationEmailsService;
  let digestService: HelpGroupsDigestService;

  let notificationModel: typeof Notification;
  let membershipModel: typeof HelpGroupMembership;
  let postModel: typeof Post;
  let userModel: typeof User;

  const sendEvent = jest.fn();
  let addToWorkQueue: jest.SpyInstance;

  const route = '/help-groups';

  let group: HelpGroup;
  let julien: LoggedInUser;
  let amina: LoggedInUser;
  let thomas: LoggedInUser;
  let discussion: Post;

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
    notificationsService = moduleFixture.get(NotificationsService);
    emailsService = moduleFixture.get(HelpGroupsNotificationEmailsService);
    digestService = moduleFixture.get(HelpGroupsDigestService);

    notificationModel = moduleFixture.get(getModelToken(Notification));
    membershipModel = moduleFixture.get(getModelToken(HelpGroupMembership));
    postModel = moduleFixture.get(getModelToken(Post));
    userModel = moduleFixture.get(getModelToken(User));
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
    // Every module instance of the queues service shares this prototype
    addToWorkQueue = jest.spyOn(QueuesServiceMock.prototype, 'addToWorkQueue');
    // The real ids are not created in Mailjet yet: 0 sends nothing
    jest.replaceProperty(
      MailjetTemplates,
      'HELP_GROUP_NOTIFICATION',
      9000001 as never
    );
    jest.replaceProperty(
      MailjetTemplates,
      'HELP_GROUPS_WEEKLY_DIGEST',
      9000002 as never
    );
    // Only reports, never hides, unless a test says otherwise
    process.env.HELP_GROUPS_AUTO_HIDE_THRESHOLD = '0';

    await databaseHelper.resetTestDB();
    group = await helpGroupFactory.create({ name: 'Refaire un CV' });
    julien = await createMember({ firstName: 'Julien' });
    amina = await createMember({ firstName: 'Amina' });
    thomas = await createMember({ firstName: 'Thomas' });
    discussion = await discussionFactory.create(
      { authorId: julien.user.id, title: 'Trou dans le CV' },
      group.id
    );
  });

  afterEach(() => {
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

  async function createMember(props: Partial<User> = {}) {
    const user = await usersHelper.createLoggedInUser({
      role: UserRoles.CANDIDATE,
      helpGroupsCharterAcceptedAt: new Date(),
      ...props,
    });
    await membershipFactory.create({ groupId: group.id, userId: user.user.id });
    return user;
  }

  const discussionPath = (id = discussion.id) =>
    `${route}/${group.slug}/discussions/${id}`;

  const reply = async (user: LoggedInUser, content = 'Ma réponse') => {
    const response = await api('post', `${discussionPath()}/replies`, user, {
      content,
    });
    expect(response.status).toBe(201);
    return response.body as { id: string };
  };

  const react = (
    user: LoggedInUser,
    target: { discussionId?: string; replyId?: string },
    emoji = '💪'
  ) => api('put', `${discussionPath()}/reactions`, user, { target, emoji });

  const unreact = (
    user: LoggedInUser,
    target: { discussionId?: string; replyId?: string }
  ) => api('delete', `${discussionPath()}/reactions`, user, { target });

  const notificationsOf = (user: LoggedInUser) =>
    notificationModel.findAll({ where: { userId: user.user.id } });

  const bell = async (user: LoggedInUser) => {
    const response = await api('get', '/notifications', user);
    expect(response.status).toBe(200);
    return response.body.items as {
      label: string;
      seen: boolean;
      destination: { replyId: string | null };
      excerpt: string | null;
    }[];
  };

  // Email jobs queued by the producer, in their order
  const emailJobs = (): SendHelpGroupNotificationEmailJob[] =>
    addToWorkQueue.mock.calls
      .filter(([type]) => type === Jobs.SEND_HELP_GROUP_NOTIFICATION_EMAIL)
      .map(([, data]) => data);

  // Mails queued for Mailjet (mocked: never sent)
  const sentMails = (): SendMailJob[] =>
    addToWorkQueue.mock.calls
      .filter(([type]) => type === Jobs.SEND_MAIL)
      .map(([, data]) => data);

  // Runs the delayed jobs, as the worker would after 60 s
  const runEmailJobs = async (jobs = emailJobs()) => {
    for (const job of jobs) {
      await emailsService.sendNotificationEmail(job);
    }
  };

  describe('Events', () => {
    it('Should notify the author of the discussion of a reply, naming the person and giving the beginning of the reply', async () => {
      await reply(amina, 'Tu peux parler de ton engagement associatif.');
      const items = await bell(julien);
      expect(items).toHaveLength(1);
      expect(items[0].label).toBe('Amina vous a répondu');
      expect(items[0].excerpt).toBe(
        'Tu peux parler de ton engagement associatif.'
      );
      expect(items[0].seen).toBe(false);
    });

    it('Should not notify the author of their own reply', async () => {
      await reply(julien);
      expect(await notificationsOf(julien)).toHaveLength(0);
    });

    it('Should notify the previous participants and the author, the author only once', async () => {
      await reply(amina);
      await reply(julien);
      await reply(thomas);

      const aminaItems = await bell(amina);
      expect(aminaItems).toHaveLength(1);
      expect(aminaItems[0].label).toBe(
        'Julien et Thomas ont répondu dans une discussion où vous avez participé'
      );
      const julienItems = await bell(julien);
      expect(julienItems).toHaveLength(1);
      expect(julienItems[0].label).toBe('Amina et Thomas vous ont répondu');
    });

    it('Should group the replies of a discussion in one notification, unseen again and on top', async () => {
      const first = await reply(amina);
      await notificationsService.markSeen(julien.user.id, [first.id]);
      expect((await bell(julien))[0].seen).toBe(true);

      await reply(thomas);
      const [row] = await notificationsOf(julien);
      expect(row.events).toHaveLength(2);
      expect(row.seenAt).toBeNull();
      const items = await bell(julien);
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({
        label: 'Amina et Thomas vous ont répondu',
        seen: false,
      });
    });

    it('Should open on the oldest unseen reply', async () => {
      const first = await reply(amina);
      await reply(thomas);
      expect((await bell(julien))[0].destination.replyId).toBe(first.id);
    });

    it('Should not notify a former member, a deleted account, nor anyone in an unpublished group', async () => {
      await membershipModel.update(
        { leftAt: new Date() },
        { where: { userId: julien.user.id } }
      );
      await reply(amina);
      expect(await notificationsOf(julien)).toHaveLength(0);

      await membershipModel.update(
        { leftAt: null },
        { where: { userId: julien.user.id } }
      );
      await userModel.destroy({ where: { id: julien.user.id } });
      await reply(thomas);
      expect(await notificationsOf(julien)).toHaveLength(0);
    });

    it('Should notify the author of a message of a reaction, once per message', async () => {
      const aminaReply = await reply(amina);
      const sofia = await createMember({ firstName: 'Sofia' });
      expect((await react(sofia, { replyId: aminaReply.id })).status).toBe(200);
      const reactionItems = (await bell(amina)).filter(({ label }) =>
        label.includes('soutient')
      );
      expect(reactionItems).toHaveLength(1);
      expect(reactionItems[0].label).toBe('Sofia soutient votre message');
      expect(reactionItems[0].destination.replyId).toBe(aminaReply.id);

      // Replacing one's reaction is not a new event
      expect(
        (await react(sofia, { replyId: aminaReply.id }, '❤️')).status
      ).toBe(200);
      const rows = await notificationModel.findAll({
        where: {
          userId: amina.user.id,
          type: NotificationTypes.HELP_GROUP_REACTION,
        },
      });
      expect(rows).toHaveLength(1);
      expect(rows[0].events).toHaveLength(1);
    });

    it('Should remove the notification when the only reaction is removed', async () => {
      const sofia = await createMember({ firstName: 'Sofia' });
      await react(sofia, { discussionId: discussion.id });
      expect(await notificationsOf(julien)).toHaveLength(1);
      expect(
        (await unreact(sofia, { discussionId: discussion.id })).status
      ).toBe(200);
      expect(await notificationsOf(julien)).toHaveLength(0);
    });

    it('Should not notify a reaction to one own message', async () => {
      await react(julien, { discussionId: discussion.id });
      expect(await notificationsOf(julien)).toHaveLength(0);
    });

    it('Should signal the change on the private channel of each recipient, with an empty payload', async () => {
      await reply(amina);
      expect(sendEvent).toHaveBeenCalledWith(
        `private-user-${julien.user.id}`,
        'notifications-changed',
        {}
      );
      expect(sendEvent).not.toHaveBeenCalledWith(
        `private-user-${amina.user.id}`,
        'notifications-changed',
        expect.anything()
      );
    });

    it('Should still notify the other recipients when one of them fails', async () => {
      await reply(amina);
      addToWorkQueue.mockClear();
      // The email of the first recipient (the author) cannot be queued
      addToWorkQueue.mockRejectedValueOnce(new Error('Redis down'));
      await reply(thomas);
      expect(await notificationsOf(julien)).toHaveLength(1);
      const [aminaRow] = await notificationsOf(amina);
      expect(aminaRow).toBeDefined();
      // Attempted for both, after the failure of the first one
      expect(emailJobs().map(({ notificationId }) => notificationId)).toEqual(
        expect.arrayContaining([aminaRow.id])
      );
      expect(emailJobs()).toHaveLength(2);
      expect(sendEvent).toHaveBeenCalledWith(
        `private-user-${amina.user.id}`,
        'notifications-changed',
        {}
      );
    });

    it('Should never fail the reply when the notifications fail', async () => {
      jest
        .spyOn(notificationsService, 'upsertEvent')
        .mockRejectedValue(new Error('DB down'));
      const response = await api('post', `${discussionPath()}/replies`, amina, {
        content: 'Réponse',
      });
      expect(response.status).toBe(201);
    });
  });

  describe('Removal', () => {
    it('Should remove the notification once its only reply is deleted, and send no email', async () => {
      const aminaReply = await reply(amina);
      const response = await api(
        'delete',
        `${discussionPath()}/replies/${aminaReply.id}`,
        amina
      );
      expect(response.status).toBe(204);
      expect(await notificationsOf(julien)).toHaveLength(0);
      await runEmailJobs();
      expect(sentMails()).toHaveLength(0);
    });

    it('Should keep the other replies of the notification, with its last event date recomputed', async () => {
      const first = await reply(amina);
      const second = await reply(thomas);
      await api('delete', `${discussionPath()}/replies/${second.id}`, thomas);
      const [row] = await notificationsOf(julien);
      expect(row.events.map(({ eventId }) => eventId)).toEqual([first.id]);
      expect(row.lastEventAt.toISOString()).toBe(row.events[0].at);
    });

    it('Should remove every notification of a deleted discussion, reactions to its replies included', async () => {
      const aminaReply = await reply(amina);
      await react(thomas, { replyId: aminaReply.id });
      expect(await notificationsOf(amina)).toHaveLength(1);
      expect((await api('delete', discussionPath(), julien)).status).toBe(204);
      expect(await notificationModel.count()).toBe(0);
    });

    it('Should remove the notification of a reply hidden after reports, and not recreate it once restored', async () => {
      process.env.HELP_GROUPS_AUTO_HIDE_THRESHOLD = '1';
      const aminaReply = await reply(amina);
      const report = await api('post', `${discussionPath()}/reports`, thomas, {
        target: { replyId: aminaReply.id },
        reason: ReportReasons.SPAM,
      });
      expect(report.status).toBe(201);
      expect(await notificationsOf(julien)).toHaveLength(0);

      const admin = await usersHelper.createLoggedInUser({
        role: UserRoles.ADMIN,
      });
      expect(
        (
          await api(
            'post',
            `/admin/help-groups/replies/${aminaReply.id}/restore`,
            admin
          )
        ).status
      ).toBeLessThan(300);
      expect(await notificationsOf(julien)).toHaveLength(0);
    });

    it('Should remove the notifications of a discussion hidden after reports', async () => {
      process.env.HELP_GROUPS_AUTO_HIDE_THRESHOLD = '1';
      await reply(amina);
      await api('post', `${discussionPath()}/reports`, thomas, {
        target: { discussionId: discussion.id },
        reason: ReportReasons.SPAM,
      });
      expect(await notificationsOf(julien)).toHaveLength(0);
    });
  });

  describe('Immediate emails', () => {
    it('Should queue one delayed job per event and recipient, with a deterministic id', async () => {
      const aminaReply = await reply(amina);
      const [row] = await notificationsOf(julien);
      expect(addToWorkQueue).toHaveBeenCalledWith(
        Jobs.SEND_HELP_GROUP_NOTIFICATION_EMAIL,
        { notificationId: row.id, eventId: aminaReply.id },
        {
          delay: HELP_GROUP_NOTIFICATION_EMAIL_DELAY_MS,
          jobId: getHelpGroupNotificationEmailJobId(row.id, aminaReply.id),
        }
      );
      expect(
        getHelpGroupNotificationEmailJobId(row.id, aminaReply.id)
      ).not.toContain(':');
    });

    it('Should send an email to the author for a reply, with its subject, links and reason', async () => {
      const aminaReply = await reply(amina, 'Parle de ton bénévolat.');
      await runEmailJobs();
      const mails = sentMails();
      expect(mails).toHaveLength(1);
      expect(mails[0]).toMatchObject({
        toEmail: julien.user.email,
        templateId: MailjetTemplates.HELP_GROUP_NOTIFICATION,
        subject: 'Amina vous a répondu dans « Refaire un CV »',
        variables: expect.objectContaining({
          actorFirstName: 'Amina',
          groupName: 'Refaire un CV',
          discussionTitle: 'Trou dans le CV',
          excerpt: 'Parle de ton bénévolat.',
          reason: expect.stringContaining('Vous recevez cet email parce que'),
        }),
      });
      const variables = mails[0].variables as {
        discussionUrl: string;
        settingsUrl: string;
      };
      expect(variables.discussionUrl).toContain(
        `/backoffice/groupes/${group.slug}/discussions/${discussion.id}?replyId=${aminaReply.id}&autologinToken=`
      );
      expect(variables.settingsUrl).toContain(
        `/backoffice/groupes/${group.slug}?emails=1&autologinToken=`
      );
    });

    it('Should send two emails for two replies, and a participant subject to a participant', async () => {
      await reply(amina);
      await reply(thomas);
      await runEmailJobs();
      const subjects = sentMails().map(({ toEmail, subject }) => [
        toEmail,
        subject,
      ]);
      expect(subjects).toEqual(
        expect.arrayContaining([
          [julien.user.email, 'Amina vous a répondu dans « Refaire un CV »'],
          [julien.user.email, 'Thomas vous a répondu dans « Refaire un CV »'],
          [
            amina.user.email,
            'Thomas a répondu dans une discussion où vous avez participé',
          ],
        ])
      );
      expect(subjects).toHaveLength(3);
    });

    it('Should send an email for a reaction', async () => {
      const aminaReply = await reply(amina);
      addToWorkQueue.mockClear();
      const sofia = await createMember({ firstName: 'Sofia' });
      await react(sofia, { replyId: aminaReply.id });
      await runEmailJobs();
      expect(sentMails()).toEqual([
        expect.objectContaining({
          toEmail: amina.user.email,
          subject: 'Sofia a réagi à votre message',
        }),
      ]);
    });

    it('Should send no email for a reply seen before the job runs, even when the row is not all seen', async () => {
      const first = await reply(amina);
      await reply(thomas);
      const julienJobs = emailJobs().filter(
        ({ eventId }) => eventId === first.id
      );
      await notificationsService.markSeen(julien.user.id, [first.id]);
      const [row] = await notificationsOf(julien);
      expect(row.seenAt).toBeNull();

      await runEmailJobs(julienJobs);
      expect(sentMails()).toHaveLength(0);
    });

    it('Should send nothing when the emails of the group are turned off, the notification staying in the bell', async () => {
      expect(
        (
          await api('patch', `${route}/${group.slug}/membership`, julien, {
            emailsEnabled: false,
          })
        ).status
      ).toBe(200);
      await reply(amina);
      await runEmailJobs();
      expect(sentMails()).toHaveLength(0);
      expect(await bell(julien)).toHaveLength(1);
    });

    it('Should send nothing to a person who left the group meanwhile', async () => {
      await reply(amina);
      await api('delete', `${route}/${group.slug}/membership`, julien);
      await runEmailJobs();
      expect(sentMails()).toHaveLength(0);
    });

    it('Should send nothing when the job is replayed', async () => {
      await reply(amina);
      await runEmailJobs();
      await runEmailJobs();
      expect(sentMails()).toHaveLength(1);
      const [row] = await notificationsOf(julien);
      expect(row.events[0].emailedAt).toBeTruthy();
    });

    it('Should give the email back when it could not be queued', async () => {
      await reply(amina);
      const [job] = emailJobs();
      addToWorkQueue.mockRejectedValueOnce(new Error('Redis down'));
      await expect(emailsService.sendNotificationEmail(job)).rejects.toThrow(
        'Redis down'
      );
      await emailsService.sendNotificationEmail(job);
      expect(sentMails()).toHaveLength(2);
      const [row] = await notificationsOf(julien);
      expect(row.events[0].emailedAt).toBeTruthy();
    });

    it('Should send nothing, nor mark anything as sent, while the Mailjet template is not configured', async () => {
      jest.replaceProperty(
        MailjetTemplates,
        'HELP_GROUP_NOTIFICATION',
        0 as never
      );
      await reply(amina);
      await runEmailJobs();
      expect(sentMails()).toHaveLength(0);
      const [row] = await notificationsOf(julien);
      expect(row.events[0].emailedAt ?? null).toBeNull();
    });
  });

  describe('Emails setting', () => {
    const membershipPath = () => `${route}/${group.slug}/membership`;

    it('Should let a member turn off and on the emails of the group, exposed on the group page', async () => {
      const off = await api('patch', membershipPath(), julien, {
        emailsEnabled: false,
      });
      expect(off.body).toEqual({ emailsEnabled: false });
      const page = await api('get', `${route}/${group.slug}`, julien);
      expect(page.body.emailsEnabled).toBe(false);
      const on = await api('patch', membershipPath(), julien, {
        emailsEnabled: true,
      });
      expect(on.body).toEqual({ emailsEnabled: true });
    });

    it('Should refuse a non member with a 403, and expose no setting to them', async () => {
      const outsider = await usersHelper.createLoggedInUser({
        role: UserRoles.COACH,
      });
      const response = await api('patch', membershipPath(), outsider, {
        emailsEnabled: false,
      });
      expect(response.status).toBe(403);
      const page = await api('get', `${route}/${group.slug}`, outsider);
      expect(page.body.emailsEnabled).toBeNull();
    });

    it('Should refuse a malformed body', async () => {
      const response = await api('patch', membershipPath(), julien, {
        emailsEnabled: 'no',
      });
      expect(response.status).toBe(400);
    });

    it('Should enable the emails again on a new membership', async () => {
      await api('patch', membershipPath(), julien, { emailsEnabled: false });
      await api('delete', membershipPath(), julien);
      expect((await api('post', membershipPath(), julien)).status).toBe(200);
      const page = await api('get', `${route}/${group.slug}`, julien);
      expect(page.body.emailsEnabled).toBe(true);
    });
  });

  describe('Weekly digest', () => {
    const lastWeek = (days = 3) => new Date(Date.now() - days * DAY_IN_MS);

    const digestMails = () =>
      sentMails().filter(
        ({ templateId }) =>
          templateId === MailjetTemplates.HELP_GROUPS_WEEKLY_DIGEST
      );

    const digestOf = (user: LoggedInUser) =>
      digestMails().find(({ toEmail }) => toEmail === user.user.email);

    type DigestVariables = {
      groups: {
        name: string;
        discussions: { title: string; authorFirstName: string }[];
      }[];
      groupsUrl: string | null;
    };

    beforeEach(async () => {
      // The discussion of the outer setup is out of the period
      await postModel.update(
        { createdAt: lastWeek(10), lastActivityAt: lastWeek(10) },
        { where: { id: discussion.id }, silent: true }
      );
    });

    const createDiscussion = (
      authorId: string,
      props: Partial<Post> = {},
      groupId = group.id
    ) =>
      discussionFactory.create(
        {
          authorId,
          createdAt: lastWeek(),
          lastActivityAt: lastWeek(),
          ...props,
        },
        groupId
      );

    it('Should present a discussion of the week where the person did not write', async () => {
      await createDiscussion(thomas.user.id, { title: 'Lettre de motivation' });
      await digestService.sendWeeklyDigests();
      const mail = digestOf(julien);
      expect(mail.subject).toBe('Cette semaine dans vos groupes');
      const variables = mail.variables as DigestVariables;
      expect(variables.groups).toEqual([
        expect.objectContaining({
          name: 'Refaire un CV',
          discussions: [
            expect.objectContaining({
              title: 'Lettre de motivation',
              authorFirstName: 'Thomas',
            }),
          ],
        }),
      ]);
      expect(variables.groupsUrl).toBeNull();
      // The author of the discussion wrote in it: nothing for them
      expect(digestOf(thomas)).toBeUndefined();
    });

    it('Should exclude a discussion where the person replied, even with a deleted reply', async () => {
      const other = await createDiscussion(thomas.user.id);
      await postReplyFactory.create({
        postId: other.id,
        authorId: julien.user.id,
        createdAt: lastWeek(2),
        deletedAt: new Date(),
      });
      await digestService.sendWeeklyDigests();
      expect(digestOf(julien)).toBeUndefined();
    });

    it('Should present an old discussion with a visible reply of the week', async () => {
      await postReplyFactory.create({
        postId: discussion.id,
        authorId: thomas.user.id,
        createdAt: lastWeek(1),
      });
      await digestService.sendWeeklyDigests();
      expect(digestOf(amina)).toBeDefined();
      // Julien wrote the discussion
      expect(digestOf(julien)).toBeUndefined();
    });

    it('Should exclude the groups not joined and the groups whose emails are turned off', async () => {
      const otherGroup = await helpGroupFactory.create({ name: 'Entretiens' });
      await createDiscussion(thomas.user.id, {}, otherGroup.id);
      await digestService.sendWeeklyDigests();
      expect(digestOf(julien)).toBeUndefined();

      await createDiscussion(thomas.user.id, {
        createdAt: new Date(),
        lastActivityAt: new Date(),
      });
      await membershipModel.update(
        { emailsEnabled: false },
        { where: { userId: julien.user.id } }
      );
      await userModel.update(
        { helpGroupsDigestSentAt: null },
        { where: { id: julien.user.id } }
      );
      addToWorkQueue.mockClear();
      await digestService.sendWeeklyDigests();
      expect(digestOf(julien)).toBeUndefined();
      expect(digestOf(amina)).toBeDefined();
    });

    it('Should send nothing on a calm week, and exclude deleted or hidden discussions', async () => {
      await createDiscussion(thomas.user.id, { deletedAt: new Date() });
      await createDiscussion(thomas.user.id, { hiddenAt: new Date() });
      await digestService.sendWeeklyDigests();
      expect(digestMails()).toHaveLength(0);
    });

    it('Should present the discussions by group', async () => {
      const otherGroup = await helpGroupFactory.create({ name: 'Entretiens' });
      await membershipFactory.create({
        groupId: otherGroup.id,
        userId: julien.user.id,
      });
      await createDiscussion(thomas.user.id, { title: 'CV' });
      await createDiscussion(
        thomas.user.id,
        { title: 'Entretien' },
        otherGroup.id
      );
      await digestService.sendWeeklyDigests();
      const variables = digestOf(julien).variables as DigestVariables;
      expect(variables.groups.map(({ name }) => name).sort()).toEqual([
        'Entretiens',
        'Refaire un CV',
      ]);
    });

    it('Should present the ten most recently active discussions and a link to the groups beyond', async () => {
      for (let i = 0; i < 15; i += 1) {
        const at = new Date(Date.now() - (i + 1) * 60 * 60 * 1000);
        await createDiscussion(thomas.user.id, {
          title: `Discussion ${i}`,
          createdAt: at,
          lastActivityAt: at,
        });
      }
      await digestService.sendWeeklyDigests();
      const variables = digestOf(julien).variables as DigestVariables;
      const titles = variables.groups.flatMap(({ discussions }) =>
        discussions.map(({ title }) => title)
      );
      expect(titles).toEqual(
        Array.from({ length: 10 }, (_, i) => `Discussion ${i}`)
      );
      expect(variables.groupsUrl).toContain(
        '/backoffice/groupes?autologinToken='
      );
    });

    it('Should not send the same activity twice, a second run the same day sending nothing', async () => {
      await createDiscussion(thomas.user.id);
      await digestService.sendWeeklyDigests();
      expect(digestOf(julien)).toBeDefined();
      addToWorkQueue.mockClear();
      await digestService.sendWeeklyDigests();
      expect(digestMails()).toHaveLength(0);
      const user = await userModel.findByPk(julien.user.id, {
        attributes: ['helpGroupsDigestSentAt'],
      });
      expect(user.helpGroupsDigestSentAt).toBeTruthy();
    });

    it('Should put the previous date back when the digest cannot be queued, the next run sending it', async () => {
      await createDiscussion(thomas.user.id);
      const before = await userModel.findByPk(julien.user.id, {
        attributes: ['helpGroupsDigestSentAt'],
      });
      addToWorkQueue.mockImplementation(async (type, data) => {
        if (
          type === Jobs.SEND_MAIL &&
          (data as SendMailJob).toEmail === julien.user.email
        ) {
          throw new Error('Redis down');
        }
        return { id: 'mock-job-id' };
      });
      const failed = await digestService.sendWeeklyDigests();
      expect(failed.failed).toBe(1);
      const after = await userModel.findByPk(julien.user.id, {
        attributes: ['helpGroupsDigestSentAt'],
      });
      expect(after.helpGroupsDigestSentAt).toEqual(
        before.helpGroupsDigestSentAt
      );

      addToWorkQueue.mockReset();
      addToWorkQueue.mockResolvedValue({ id: 'mock-job-id' });
      await digestService.sendWeeklyDigests();
      expect(digestOf(julien)).toBeDefined();
    });

    it('Should send no digest, and keep the activity due, while the Mailjet template is not configured', async () => {
      await createDiscussion(thomas.user.id);
      jest.replaceProperty(
        MailjetTemplates,
        'HELP_GROUPS_WEEKLY_DIGEST',
        0 as never
      );
      await digestService.sendWeeklyDigests();
      expect(digestMails()).toHaveLength(0);
      const user = await userModel.findByPk(julien.user.id, {
        attributes: ['helpGroupsDigestSentAt'],
      });
      expect(user.helpGroupsDigestSentAt).toBeNull();
    });

    it('Should name a deleted author "Utilisateur supprimé"', async () => {
      await createDiscussion(thomas.user.id);
      await userModel.destroy({ where: { id: thomas.user.id } });
      await digestService.sendWeeklyDigests();
      const variables = digestOf(julien).variables as DigestVariables;
      expect(variables.groups[0].discussions[0].authorFirstName).toBe(
        'Utilisateur supprimé'
      );
    });
  });
});
