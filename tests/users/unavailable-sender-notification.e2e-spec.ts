import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { MailjetTemplates } from 'src/external-services/mailjet/mailjet.types';
import { QueuesService } from 'src/queues/producers/queues.service';
import { Jobs } from 'src/queues/queues.types';
import { UsersService } from 'src/users/users.service';
import { UserRoles } from 'src/users/users.types';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import { ConversationFactory } from 'tests/messaging/conversation.factory';
import { MessagingHelper } from 'tests/messaging/messaging.helper';
import { QueuesServiceMock } from 'tests/queues/queues.service.mock';
import { LoggedInUser, UsersHelper } from 'tests/users/users.helper';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

describe('UNAVAILABLE SENDER NOTIFICATION', () => {
  let app: INestApplication;

  let addToWorkQueueSpy: jest.SpyInstance;

  let databaseHelper: DatabaseHelper;
  let usersHelper: UsersHelper;
  let usersService: UsersService;
  let conversationFactory: ConversationFactory;
  let messagingHelper: MessagingHelper;

  // The daily cron targets profiles whose `unavailableAt` falls within
  // yesterday's calendar day: [yesterday 00:00, today 00:00[.
  const yesterdayStart = new Date(new Date().setHours(0, 0, 0, 0) - DAY_IN_MS);
  const todayStart = new Date(new Date().setHours(0, 0, 0, 0));
  const yesterdayNoon = new Date(
    yesterdayStart.getTime() + 12 * 60 * 60 * 1000
  );

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [CustomTestingModule],
    })
      .overrideProvider(QueuesService)
      .useClass(QueuesServiceMock)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    databaseHelper = moduleFixture.get<DatabaseHelper>(DatabaseHelper);
    usersHelper = moduleFixture.get<UsersHelper>(UsersHelper);
    usersService = moduleFixture.get<UsersService>(UsersService);
    conversationFactory =
      moduleFixture.get<ConversationFactory>(ConversationFactory);
    messagingHelper = moduleFixture.get<MessagingHelper>(MessagingHelper);

    addToWorkQueueSpy = jest.spyOn(
      QueuesServiceMock.prototype,
      'addToWorkQueue'
    );

    await databaseHelper.resetTestDB();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(async () => {
    await databaseHelper.resetTestDB();
    addToWorkQueueSpy?.mockClear();
  });

  // `messageAuthor` sends the single message; `unavailableUser` is the
  // other participant, the one whose `unavailableAt` the cron checks.
  const createUnansweredConversation = async (
    unavailableUser: LoggedInUser,
    messageAuthor: LoggedInUser
  ) => {
    const conversation = await conversationFactory.create();
    await messagingHelper.associationParticipantsToConversation(
      conversation.id,
      [unavailableUser.user.id, messageAuthor.user.id]
    );
    await messagingHelper.createMessage(conversation.id, messageAuthor.user.id);
    return conversation;
  };

  it('notifies the message author when the other participant became unavailable yesterday and never replied', async () => {
    const unavailableUser = await usersHelper.createLoggedInUser(
      { role: UserRoles.COACH },
      { userProfile: { unavailableAt: yesterdayNoon } }
    );
    const messageAuthor = await usersHelper.createLoggedInUser({
      role: UserRoles.CANDIDATE,
    });

    await createUnansweredConversation(unavailableUser, messageAuthor);

    const notifications = await usersService.getUnavailableSenderNotifications(
      yesterdayStart,
      todayStart
    );

    expect(notifications).toHaveLength(1);
    expect(notifications[0].unavailableUser.id).toBe(unavailableUser.user.id);
    expect(notifications[0].messageAuthor.id).toBe(messageAuthor.user.id);

    await usersService.sendUnavailableSenderNotificationMail(notifications[0]);

    // The message author — not the now-unavailable user — is the actual
    // mail recipient, reassured that they won't get a reply. Per the
    // template copy ("Bonjour {{senderFirstName}} ... vous avez écrit à
    // {{addresseeFirstName}}"), `sender*` names the recipient and
    // `addressee*` names the user who became unavailable.
    expect(addToWorkQueueSpy).toHaveBeenCalledWith(
      Jobs.SEND_MAIL,
      expect.objectContaining({
        toEmail: messageAuthor.user.email,
        templateId: MailjetTemplates.MAILER_UNAVAILABLE_SENDER_NOTIFICATION,
        variables: expect.objectContaining({
          senderFirstName: messageAuthor.user.firstName,
          addresseeFirstName: unavailableUser.user.firstName,
        }),
      })
    );
  });

  it('does not return the conversation when the unavailable user has replied', async () => {
    const unavailableUser = await usersHelper.createLoggedInUser(
      { role: UserRoles.COACH },
      { userProfile: { unavailableAt: yesterdayNoon } }
    );
    const messageAuthor = await usersHelper.createLoggedInUser({
      role: UserRoles.CANDIDATE,
    });

    const conversation = await createUnansweredConversation(
      unavailableUser,
      messageAuthor
    );
    await messagingHelper.createMessage(
      conversation.id,
      unavailableUser.user.id
    );

    const notifications = await usersService.getUnavailableSenderNotifications(
      yesterdayStart,
      todayStart
    );

    expect(notifications).toHaveLength(0);
  });

  it('returns one notification per qualifying conversation for the same unavailable user', async () => {
    const unavailableUser = await usersHelper.createLoggedInUser(
      { role: UserRoles.COACH },
      { userProfile: { unavailableAt: yesterdayNoon } }
    );
    const firstMessageAuthor = await usersHelper.createLoggedInUser({
      role: UserRoles.CANDIDATE,
    });
    const secondMessageAuthor = await usersHelper.createLoggedInUser({
      role: UserRoles.CANDIDATE,
    });

    await createUnansweredConversation(unavailableUser, firstMessageAuthor);
    await createUnansweredConversation(unavailableUser, secondMessageAuthor);

    const notifications = await usersService.getUnavailableSenderNotifications(
      yesterdayStart,
      todayStart
    );

    expect(notifications).toHaveLength(2);
    expect(notifications.map((n) => n.messageAuthor.id).sort()).toEqual(
      [firstMessageAuthor.user.id, secondMessageAuthor.user.id].sort()
    );
  });

  it('sends a new notification on every unavailability pass, without deduplication', async () => {
    const unavailableUser = await usersHelper.createLoggedInUser(
      { role: UserRoles.COACH },
      { userProfile: { unavailableAt: yesterdayNoon } }
    );
    const messageAuthor = await usersHelper.createLoggedInUser({
      role: UserRoles.CANDIDATE,
    });

    await createUnansweredConversation(unavailableUser, messageAuthor);

    const firstPassNotifications =
      await usersService.getUnavailableSenderNotifications(
        yesterdayStart,
        todayStart
      );
    const secondPassNotifications =
      await usersService.getUnavailableSenderNotifications(
        yesterdayStart,
        todayStart
      );

    expect(firstPassNotifications).toHaveLength(1);
    expect(secondPassNotifications).toHaveLength(1);
    expect(secondPassNotifications[0].messageAuthor.id).toBe(
      messageAuthor.user.id
    );
  });
});
