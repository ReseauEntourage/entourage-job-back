import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import moment from 'moment';
import { QueuesService } from 'src/queues/producers/queues.service';
import { UsersService } from 'src/users/users.service';
import { UserRoles } from 'src/users/users.types';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import { QueuesServiceMock } from 'tests/queues/queues.service.mock';
import { UsersHelper } from './users.helper';

const monthsAgo = (months: number) =>
  moment().subtract(months, 'months').toDate();

describe('INACTIVE ACCOUNT DELETION - ELIGIBLE USER ROWS', () => {
  let app: INestApplication;

  let databaseHelper: DatabaseHelper;
  let usersHelper: UsersHelper;
  let usersService: UsersService;

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

    await databaseHelper.resetTestDB();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(async () => {
    await databaseHelper.resetTestDB();
  });

  describe('already connected once', () => {
    it('returns a user whose last connection is over 24 months old', async () => {
      const user = await usersHelper.createLoggedInUser({
        role: UserRoles.CANDIDATE,
        lastConnection: monthsAgo(25),
      });

      const rows = await usersService.getInactiveUsersForDeletion(24);

      expect(rows.map((r) => r.id)).toEqual([user.user.id]);
    });

    it('does not return a user whose last connection is under 24 months old', async () => {
      await usersHelper.createLoggedInUser({
        role: UserRoles.CANDIDATE,
        lastConnection: monthsAgo(23),
      });

      const rows = await usersService.getInactiveUsersForDeletion(24);

      expect(rows).toHaveLength(0);
    });
  });

  describe('never connected', () => {
    it('returns a user created over 24 months ago who never connected', async () => {
      const user = await usersHelper.createLoggedInUser({
        role: UserRoles.CANDIDATE,
        lastConnection: null,
        createdAt: monthsAgo(25),
      });

      const rows = await usersService.getInactiveUsersForDeletion(24);

      expect(rows.map((r) => r.id)).toEqual([user.user.id]);
    });

    it('does not return a user created under 24 months ago who never connected', async () => {
      await usersHelper.createLoggedInUser({
        role: UserRoles.CANDIDATE,
        lastConnection: null,
        createdAt: monthsAgo(23),
      });

      const rows = await usersService.getInactiveUsersForDeletion(24);

      expect(rows).toHaveLength(0);
    });
  });

  it('does not return an admin, even with a matching last connection age', async () => {
    await usersHelper.createLoggedInUser({
      role: UserRoles.ADMIN,
      lastConnection: monthsAgo(25),
    });

    const rows = await usersService.getInactiveUsersForDeletion(24);

    expect(rows).toHaveLength(0);
  });
});
