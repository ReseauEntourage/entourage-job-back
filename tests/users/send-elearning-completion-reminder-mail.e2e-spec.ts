import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { MailsService } from 'src/mails/mails.service';
import { QueuesService } from 'src/queues/producers/queues.service';
import { UsersService } from 'src/users/users.service';
import { UserRoles } from 'src/users/users.types';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import { QueuesServiceMock } from 'tests/queues/queues.service.mock';
import { UserFactory } from 'tests/users/user.factory';

describe('UsersService.sendElearningCompletionReminderMail', () => {
  let app: INestApplication;
  let databaseHelper: DatabaseHelper;
  let userFactory: UserFactory;
  let usersService: UsersService;
  let mailsService: { sendElearningCompletionReminderMail: jest.Mock };

  beforeAll(async () => {
    mailsService = {
      sendElearningCompletionReminderMail: jest
        .fn()
        .mockResolvedValue(undefined),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [CustomTestingModule],
    })
      .overrideProvider(MailsService)
      .useValue(mailsService)
      .overrideProvider(QueuesService)
      .useClass(QueuesServiceMock)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    databaseHelper = moduleFixture.get<DatabaseHelper>(DatabaseHelper);
    userFactory = moduleFixture.get<UserFactory>(UserFactory);
    usersService = moduleFixture.get<UsersService>(UsersService);
  });

  afterAll(async () => {
    await databaseHelper.resetTestDB();
    await app.close();
  });

  afterEach(async () => {
    await databaseHelper.resetTestDB();
    mailsService.sendElearningCompletionReminderMail.mockClear();
  });

  it('resolves the mirror role to COACH for a candidate, via UsersService.getUserMirrorRole', async () => {
    const user = await userFactory.create({ role: UserRoles.CANDIDATE });

    await usersService.sendElearningCompletionReminderMail(user);

    expect(
      mailsService.sendElearningCompletionReminderMail
    ).toHaveBeenCalledWith(user, UserRoles.COACH);
  });

  it('resolves the mirror role to CANDIDATE for a coach, via UsersService.getUserMirrorRole', async () => {
    const user = await userFactory.create({ role: UserRoles.COACH });

    await usersService.sendElearningCompletionReminderMail(user);

    expect(
      mailsService.sendElearningCompletionReminderMail
    ).toHaveBeenCalledWith(user, UserRoles.CANDIDATE);
  });
});
