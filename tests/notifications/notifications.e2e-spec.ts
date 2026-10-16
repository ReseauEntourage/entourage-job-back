import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/sequelize';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { PusherService } from 'src/external-services/pusher/pusher.service';
import { HelpGroup } from 'src/help-groups/models';
import { Notification } from 'src/notifications/models';
import { NotificationsService } from 'src/notifications/notifications.service';
import {
  NotificationSubjectTypes,
  NotificationTypes,
} from 'src/notifications/notifications.types';
import { formatActorNames } from 'src/notifications/notifications.utils';
import { Post, PostReply } from 'src/posts/models';
import { QueuesService } from 'src/queues/producers/queues.service';
import { User } from 'src/users/models';
import { UserRoles } from 'src/users/users.types';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import { DiscussionFactory } from 'tests/help-groups/discussion.factory';
import { HelpGroupMembershipFactory } from 'tests/help-groups/help-group-membership.factory';
import { HelpGroupFactory } from 'tests/help-groups/help-group.factory';
import { PostReplyFactory } from 'tests/help-groups/post-reply.factory';
import { QueuesServiceMock } from 'tests/queues/queues.service.mock';
import { LoggedInUser, UsersHelper } from 'tests/users/users.helper';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

describe('Notifications center', () => {
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
  let notificationModel: typeof Notification;
  let userModel: typeof User;
  let helpGroupModel: typeof HelpGroup;

  const sendEvent = jest.fn();
  const authorizeChannel = jest.fn();

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
      .useValue({ sendEvent, authorizeChannel })
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
    notificationModel = moduleFixture.get(getModelToken(Notification));
    userModel = moduleFixture.get(getModelToken(User));
    helpGroupModel = moduleFixture.get(getModelToken(HelpGroup));
  });

  afterAll(async () => {
    await databaseHelper.resetTestDB();
    await app.close();
    server.close();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    sendEvent.mockResolvedValue({});
    authorizeChannel.mockReturnValue({ auth: 'key:signature' });

    await databaseHelper.resetTestDB();
    group = await helpGroupFactory.create({ name: 'Refaire un CV' });
    julien = await createMember('Julien');
    amina = await createMember('Amina');
    thomas = await createMember('Thomas');
    discussion = await discussionFactory.create(
      { authorId: julien.user.id, title: 'Trou dans le CV' },
      group.id
    );
  });

  async function createMember(firstName: string) {
    const user = await usersHelper.createLoggedInUser({
      role: UserRoles.CANDIDATE,
      firstName,
    });
    await membershipFactory.create({ groupId: group.id, userId: user.user.id });
    return user;
  }

  const get = (path: string, user?: LoggedInUser) => {
    const req = request(server).get(path);
    return user ? req.set('authorization', `Bearer ${user.token}`) : req;
  };

  const post = (path: string, user: LoggedInUser | undefined, body: object) => {
    const req = request(server).post(path);
    if (user) {
      req.set('authorization', `Bearer ${user.token}`);
    }
    return req.send(body);
  };

  // A reply of `author` notified to Julien, written directly in the center
  const notifyReply = async (author: LoggedInUser, at = new Date()) => {
    const reply: PostReply = await postReplyFactory.create({
      postId: discussion.id,
      authorId: author.user.id,
      content: `Réponse de ${author.user.firstName}`,
      createdAt: at,
    });
    const notificationId = await notificationsService.upsertEvent({
      userId: julien.user.id,
      type: NotificationTypes.HELP_GROUP_REPLY,
      subjectType: NotificationSubjectTypes.POST,
      subjectId: discussion.id,
      groupId: group.id,
      event: { actorId: author.user.id, eventId: reply.id, at },
    });
    return { reply, notificationId };
  };

  const unseenCount = async (user = julien) =>
    (await get('/notifications/unseen-count', user)).body.count;

  describe('Grouping by subject', () => {
    it('Should group the events of a subject in one row, unseen again on each new event, never adding an event twice', async () => {
      const first = await notifyReply(amina);
      await notificationsService.markSeen(julien.user.id, [first.reply.id]);
      const second = await notifyReply(thomas);
      expect(second.notificationId).toBe(first.notificationId);

      const rows = await notificationModel.findAll();
      expect(rows).toHaveLength(1);
      expect(rows[0].events).toHaveLength(2);
      expect(rows[0].seenAt).toBeNull();

      // The same event again: nothing added
      const again = await notificationsService.upsertEvent({
        userId: julien.user.id,
        type: NotificationTypes.HELP_GROUP_REPLY,
        subjectType: NotificationSubjectTypes.POST,
        subjectId: discussion.id,
        groupId: group.id,
        event: {
          actorId: amina.user.id,
          eventId: first.reply.id,
          at: new Date(),
        },
      });
      expect(again).toBeNull();
      expect(
        (await notificationModel.findByPk(rows[0].id)).events
      ).toHaveLength(2);
    });

    it('Should delete a row left without any event', async () => {
      const { reply } = await notifyReply(amina);
      const recipients = await notificationsService.removeEvents(
        NotificationTypes.HELP_GROUP_REPLY,
        [discussion.id],
        { eventId: reply.id }
      );
      expect(recipients).toEqual([julien.user.id]);
      expect(await notificationModel.count()).toBe(0);
    });
  });

  describe('Bell API', () => {
    it('Should list the notifications of the last 30 days, most recent first, with a label in first names and no number', async () => {
      await notifyReply(amina);
      await notifyReply(thomas);
      const response = await get('/notifications', julien);
      expect(response.status).toBe(200);
      expect(response.body.items).toEqual([
        expect.objectContaining({
          type: NotificationTypes.HELP_GROUP_REPLY,
          label: 'Amina et Thomas vous ont répondu',
          context: {
            groupName: 'Refaire un CV',
            discussionTitle: 'Trou dans le CV',
          },
          seen: false,
          destination: expect.objectContaining({
            slug: group.slug,
            discussionId: discussion.id,
          }),
        }),
      ]);
      expect(response.body.items[0].label).not.toMatch(/\d/);
    });

    it('Should name up to three people, then "et d\'autres"', () => {
      expect(formatActorNames(['Amina'])).toBe('Amina');
      expect(formatActorNames(['Amina', 'Thomas', 'Sofia'])).toBe(
        'Amina, Thomas et Sofia'
      );
      expect(formatActorNames(['Amina', 'Thomas', 'Sofia', 'Léa'])).toBe(
        "Amina, Thomas, Sofia et d'autres"
      );
    });

    it('Should leave out the deleted accounts from the label, and a notification of deleted accounts only', async () => {
      await notifyReply(amina);
      await notifyReply(thomas);
      await userModel.destroy({ where: { id: thomas.user.id } });
      expect((await get('/notifications', julien)).body.items[0].label).toBe(
        'Amina vous a répondu'
      );
      await userModel.destroy({ where: { id: amina.user.id } });
      expect((await get('/notifications', julien)).body.items).toEqual([]);
    });

    it('Should not list a notification older than 30 days, and paginate with a cursor', async () => {
      const old = await notifyReply(amina);
      await notificationModel.update(
        { lastEventAt: new Date(Date.now() - 31 * DAY_IN_MS) },
        { where: { id: old.notificationId } }
      );
      expect((await get('/notifications', julien)).body.items).toEqual([]);
      expect(await unseenCount()).toBe(0);

      const response = await get('/notifications?cursor=invalid', julien);
      expect(response.status).toBe(400);
    });

    it('Should only show one own notifications, and refuse a logged out request', async () => {
      await notifyReply(amina);
      expect((await get('/notifications', amina)).body.items).toEqual([]);
      expect((await get('/notifications')).status).toBe(401);
      expect((await get('/notifications/unseen-count')).status).toBe(401);
    });

    it('Should count the unseen rows, not the events', async () => {
      await notifyReply(amina);
      await notifyReply(thomas);
      const other = await discussionFactory.create(
        { authorId: julien.user.id },
        group.id
      );
      const otherReply = await postReplyFactory.create({
        postId: other.id,
        authorId: amina.user.id,
      });
      await notificationsService.upsertEvent({
        userId: julien.user.id,
        type: NotificationTypes.HELP_GROUP_REPLY,
        subjectType: NotificationSubjectTypes.POST,
        subjectId: other.id,
        groupId: group.id,
        event: {
          actorId: amina.user.id,
          eventId: otherReply.id,
          at: new Date(),
        },
      });
      expect(await unseenCount()).toBe(2);
    });

    it('Should not count a notification the list leaves out, such as one of an unpublished group', async () => {
      await notifyReply(amina);
      expect(await unseenCount()).toBe(1);
      await helpGroupModel.update(
        { publishedAt: null },
        { where: { id: group.id } }
      );
      expect((await get('/notifications', julien)).body.items).toEqual([]);
      expect(await unseenCount()).toBe(0);
    });

    it('Should show seen, and not count, a notification whose only unseen events are left out', async () => {
      const first = await notifyReply(amina);
      await notifyReply(thomas);
      await post('/notifications/seen', julien, {
        messageIds: [first.reply.id],
      });
      expect(await unseenCount()).toBe(1);
      // The unseen reply of Thomas is left out once his account is deleted
      await userModel.destroy({ where: { id: thomas.user.id } });
      const [item] = (await get('/notifications', julien)).body.items;
      expect(item.label).toBe('Amina vous a répondu');
      expect(item.seen).toBe(true);
      expect(await unseenCount()).toBe(0);
    });

    it('Should mark nothing as seen when the list is opened', async () => {
      await notifyReply(amina);
      await get('/notifications', julien);
      await get('/notifications', julien);
      expect(await unseenCount()).toBe(1);
      expect((await get('/notifications', julien)).body.items[0].seen).toBe(
        false
      );
    });

    it('Should mark seen a displayed reply, the row staying unseen while another reply is not displayed', async () => {
      const first = await notifyReply(amina);
      await notifyReply(thomas);
      const response = await post('/notifications/seen', julien, {
        messageIds: [first.reply.id],
      });
      expect(response.status).toBe(204);

      const row = await notificationModel.findByPk(first.notificationId);
      expect(
        row.events.find(({ eventId }) => eventId === first.reply.id).seenAt
      ).toBeTruthy();
      expect(row.seenAt).toBeNull();
      expect(await unseenCount()).toBe(1);
      expect(sendEvent).toHaveBeenCalledWith(
        `private-user-${julien.user.id}`,
        'notifications-changed',
        {}
      );
    });

    it('Should mark the row seen once every event is displayed', async () => {
      const first = await notifyReply(amina);
      const second = await notifyReply(thomas);
      await post('/notifications/seen', julien, {
        messageIds: [first.reply.id, second.reply.id],
      });
      expect(await unseenCount()).toBe(0);
      expect((await get('/notifications', julien)).body.items[0].seen).toBe(
        true
      );
    });

    it('Should mark seen the reactions to a displayed message', async () => {
      const reply = await postReplyFactory.create({
        postId: discussion.id,
        authorId: julien.user.id,
      });
      await notificationsService.upsertEvent({
        userId: julien.user.id,
        type: NotificationTypes.HELP_GROUP_REACTION,
        subjectType: NotificationSubjectTypes.POST_REPLY,
        subjectId: reply.id,
        groupId: group.id,
        event: {
          actorId: amina.user.id,
          eventId: '0b9b5f0e-4d2c-4c56-9a8b-5b1b0a8f2a11',
          at: new Date(),
        },
      });
      await post('/notifications/seen', julien, { messageIds: [reply.id] });
      expect(await unseenCount()).toBe(0);
    });

    it('Should mark seen every notification of the user at once, and signal the bell', async () => {
      const first = await notifyReply(amina);
      await notifyReply(thomas);
      expect(await unseenCount()).toBe(1);
      sendEvent.mockClear();

      const response = await post('/notifications/seen-all', julien, {});
      expect(response.status).toBe(204);

      const row = await notificationModel.findByPk(first.notificationId);
      expect(row.seenAt).toBeTruthy();
      expect(row.events.every(({ seenAt }) => !!seenAt)).toBe(true);
      expect(await unseenCount()).toBe(0);
      expect(sendEvent).toHaveBeenCalledWith(
        `private-user-${julien.user.id}`,
        'notifications-changed',
        {}
      );
    });

    it('Should leave the notifications of the others unseen when marking all seen, and signal nothing when there is nothing to mark', async () => {
      await notifyReply(amina);
      sendEvent.mockClear();
      const response = await post('/notifications/seen-all', thomas, {});
      expect(response.status).toBe(204);
      expect(sendEvent).not.toHaveBeenCalled();
      expect(await unseenCount()).toBe(1);
    });

    it('Should refuse a logged out request to mark all seen', async () => {
      const response = await request(server).post('/notifications/seen-all');
      expect(response.status).toBe(401);
    });

    it('Should refuse a malformed seen body', async () => {
      expect(
        (await post('/notifications/seen', julien, { messageIds: ['nope'] }))
          .status
      ).toBe(400);
      expect(
        (await post('/notifications/seen', julien, { messageIds: [] })).status
      ).toBe(400);
    });
  });

  describe('Private channel of a user', () => {
    const path = '/pusher/auth';
    const form = (channelName: string) => ({
      socket_id: '1234.5678',
      channel_name: channelName,
    });

    it('Should sign the channel of the logged-in user themselves', async () => {
      const channel = `private-user-${julien.user.id}`;
      const response = await request(server)
        .post(path)
        .set('authorization', `Bearer ${julien.token}`)
        .type('form')
        .send(form(channel));
      expect(response.status).toBe(200);
      expect(authorizeChannel).toHaveBeenCalledWith('1234.5678', channel);
    });

    it('Should refuse the channel of another person with a 403', async () => {
      const response = await post(
        path,
        amina,
        form(`private-user-${julien.user.id}`)
      );
      expect(response.status).toBe(403);
      expect(authorizeChannel).not.toHaveBeenCalled();
    });

    it('Should refuse a logged out request with a 401', async () => {
      const response = await post(
        path,
        undefined,
        form(`private-user-${julien.user.id}`)
      );
      expect(response.status).toBe(401);
    });

    it('Should refuse a non string socket id with a 403', async () => {
      const response = await post(path, julien, {
        socket_id: { x: 1 },
        channel_name: `private-user-${julien.user.id}`,
      });
      expect(response.status).toBe(403);
    });
  });

  describe('Purge', () => {
    it('Should delete a notification of 31 days and keep one of 29 days', async () => {
      const old = await notifyReply(amina);
      await notificationModel.update(
        { lastEventAt: new Date(Date.now() - 31 * DAY_IN_MS) },
        { where: { id: old.notificationId } }
      );
      const other = await discussionFactory.create(
        { authorId: amina.user.id },
        group.id
      );
      const recentReply = await postReplyFactory.create({
        postId: other.id,
        authorId: julien.user.id,
      });
      const recentId = await notificationsService.upsertEvent({
        userId: amina.user.id,
        type: NotificationTypes.HELP_GROUP_REPLY,
        subjectType: NotificationSubjectTypes.POST,
        subjectId: other.id,
        groupId: group.id,
        event: {
          actorId: julien.user.id,
          eventId: recentReply.id,
          at: new Date(Date.now() - 29 * DAY_IN_MS),
        },
      });

      expect(await notificationsService.purgeExpired()).toBe(1);
      expect(await notificationModel.findByPk(old.notificationId)).toBeNull();
      expect(await notificationModel.findByPk(recentId)).not.toBeNull();
    });
  });
});
