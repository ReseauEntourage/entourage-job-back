import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { MessagingService } from 'src/messaging/messaging.service';
import { QueuesService } from 'src/queues/producers/queues.service';
import { UserRoles } from 'src/users/users.types';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import { QueuesServiceMock } from 'tests/queues/queues.service.mock';
import { LoggedInUser, UsersHelper } from 'tests/users/users.helper';
import { ConversationFactory } from './conversation.factory';
import { MessagingHelper } from './messaging.helper';

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY_IN_MS);

describe('AUTO UNAVAILABILITY - INACTIVE USERS WITH UNREAD CONVERSATIONS', () => {
  let app: INestApplication;

  let databaseHelper: DatabaseHelper;
  let usersHelper: UsersHelper;
  let messagingService: MessagingService;
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
    messagingService = moduleFixture.get<MessagingService>(MessagingService);
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

  // `inactiveUser` never reads the message; `otherParticipant` is only there
  // to author it, since `authorId != u.id` is required for it to count as unread.
  const createInactiveUserWithUnreadMessage = async (
    inactiveUser: LoggedInUser,
    unreadMessageAge: number
  ) => {
    const otherParticipant = await usersHelper.createLoggedInUser({
      role: UserRoles.COACH,
    });
    const conversation = await conversationFactory.create();
    await messagingHelper.associationParticipantsToConversation(
      conversation.id,
      [inactiveUser.user.id, otherParticipant.user.id]
    );
    await messagingHelper.createMessage(
      conversation.id,
      otherParticipant.user.id,
      { createdAt: daysAgo(unreadMessageAge) }
    );
  };

  it('matches a candidate inactive for 30 days with a message unread for 15 days', async () => {
    const candidate = await usersHelper.createLoggedInUser({
      role: UserRoles.CANDIDATE,
      lastConnection: daysAgo(30),
    });
    await createInactiveUserWithUnreadMessage(candidate, 15);

    const rows = await messagingService.getInactiveUsersWithUnreadConversations(
      30,
      15,
      [UserRoles.CANDIDATE]
    );

    expect(rows.map((r) => r.id)).toEqual([candidate.user.id]);
  });

  it('matches a coach inactive for 60 days with a message unread for 30 days', async () => {
    const coach = await usersHelper.createLoggedInUser({
      role: UserRoles.COACH,
      lastConnection: daysAgo(60),
    });
    await createInactiveUserWithUnreadMessage(coach, 30);

    const rows = await messagingService.getInactiveUsersWithUnreadConversations(
      60,
      30,
      [UserRoles.COACH, UserRoles.REFERER]
    );

    expect(rows.map((r) => r.id)).toEqual([coach.user.id]);
  });

  it('does not match a candidate under the tightened thresholds (45 days without connection but message only 10 days old)', async () => {
    const candidate = await usersHelper.createLoggedInUser({
      role: UserRoles.CANDIDATE,
      lastConnection: daysAgo(45),
    });
    await createInactiveUserWithUnreadMessage(candidate, 10);

    const rows = await messagingService.getInactiveUsersWithUnreadConversations(
      30,
      15,
      [UserRoles.CANDIDATE]
    );

    expect(rows).toHaveLength(0);
  });

  it('does not double-count a candidate when the default role profile is queried', async () => {
    const candidate = await usersHelper.createLoggedInUser({
      role: UserRoles.CANDIDATE,
      lastConnection: daysAgo(60),
    });
    await createInactiveUserWithUnreadMessage(candidate, 30);

    const candidateRows =
      await messagingService.getInactiveUsersWithUnreadConversations(30, 15, [
        UserRoles.CANDIDATE,
      ]);
    const defaultRows =
      await messagingService.getInactiveUsersWithUnreadConversations(60, 30, [
        UserRoles.COACH,
        UserRoles.REFERER,
      ]);

    expect(candidateRows.map((r) => r.id)).toEqual([candidate.user.id]);
    expect(defaultRows).toHaveLength(0);
  });
});
