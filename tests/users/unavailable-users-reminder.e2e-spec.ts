import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { QueuesService } from 'src/queues/producers/queues.service';
import { UsersService } from 'src/users/users.service';
import { UserRoles } from 'src/users/users.types';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import { ConversationFactory } from 'tests/messaging/conversation.factory';
import { MessagingHelper } from 'tests/messaging/messaging.helper';
import { QueuesServiceMock } from 'tests/queues/queues.service.mock';
import { LoggedInUser, UsersHelper } from './users.helper';

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY_IN_MS);

describe('UNAVAILABLE USERS REMINDER MAIL - ELIGIBLE USER ROWS', () => {
  let app: INestApplication;

  let databaseHelper: DatabaseHelper;
  let usersHelper: UsersHelper;
  let usersService: UsersService;
  let conversationFactory: ConversationFactory;
  let messagingHelper: MessagingHelper;

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

    await databaseHelper.resetTestDB();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(async () => {
    await databaseHelper.resetTestDB();
  });

  // The recipient never sees the message; `otherParticipant` authors it so
  // the recipient's `seenAt` (never set) trails the last message. The query
  // doesn't exclude the author's own participant row (unlike the auto-
  // unavailability query), so the author's role must fall outside whichever
  // role filter is under test, or it would also show up in `rows`.
  const createStillAvailableUserWithUnreadMessage = async (
    recipient: LoggedInUser,
    lastMessageAge: number,
    authorRole: (typeof UserRoles)[keyof typeof UserRoles]
  ) => {
    const otherParticipant = await usersHelper.createLoggedInUser({
      role: authorRole,
    });
    const conversation = await conversationFactory.create();
    await messagingHelper.associationParticipantsToConversation(
      conversation.id,
      [recipient.user.id, otherParticipant.user.id]
    );
    await messagingHelper.createMessage(
      conversation.id,
      otherParticipant.user.id,
      { createdAt: daysAgo(lastMessageAge) }
    );
  };

  it('returns a candidate whose last message is 15 days old', async () => {
    const candidate = await usersHelper.createLoggedInUser({
      role: UserRoles.CANDIDATE,
    });
    await createStillAvailableUserWithUnreadMessage(
      candidate,
      15,
      UserRoles.COACH
    );

    const rows = await usersService.getUserRowsForUnavailableUsers(15, [
      UserRoles.CANDIDATE,
    ]);

    expect(rows.map((r) => r.id)).toEqual([candidate.user.id]);
  });

  it('does not return a candidate under the candidate window when queried with the default 30-day window', async () => {
    const candidate = await usersHelper.createLoggedInUser({
      role: UserRoles.CANDIDATE,
    });
    await createStillAvailableUserWithUnreadMessage(
      candidate,
      15,
      UserRoles.COACH
    );

    const rows = await usersService.getUserRowsForUnavailableUsers(30, [
      UserRoles.COACH,
      UserRoles.REFERER,
    ]);

    expect(rows).toHaveLength(0);
  });

  it('returns a coach whose last message is 30 days old under the default window', async () => {
    const coach = await usersHelper.createLoggedInUser({
      role: UserRoles.COACH,
    });
    await createStillAvailableUserWithUnreadMessage(
      coach,
      30,
      UserRoles.CANDIDATE
    );

    const rows = await usersService.getUserRowsForUnavailableUsers(30, [
      UserRoles.COACH,
      UserRoles.REFERER,
    ]);

    expect(rows.map((r) => r.id)).toEqual([coach.user.id]);
  });

  it('does not return a coach when queried with the candidate 15-day window', async () => {
    const coach = await usersHelper.createLoggedInUser({
      role: UserRoles.COACH,
    });
    await createStillAvailableUserWithUnreadMessage(
      coach,
      30,
      UserRoles.CANDIDATE
    );

    const rows = await usersService.getUserRowsForUnavailableUsers(15, [
      UserRoles.CANDIDATE,
    ]);

    expect(rows).toHaveLength(0);
  });
});
