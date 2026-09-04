import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import moment from 'moment/moment';
import { QueuesService } from 'src/queues/producers/queues.service';
import { UsersService } from 'src/users/users.service';
import { UserRoles } from 'src/users/users.types';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import { QueuesServiceMock } from 'tests/queues/queues.service.mock';
import { UserFactory } from 'tests/users/user.factory';

// Created `daysAgo` days ago, truncated to midnight like the production
// query, so the comparison lands exactly on a day boundary.
const createdDaysAgo = (daysAgo: number) =>
  moment().startOf('day').subtract(daysAgo, 'days').toDate();

describe('UsersService.getUsersWithUnverifiedEmailOneDayAfterCreation', () => {
  let app: INestApplication;
  let databaseHelper: DatabaseHelper;
  let userFactory: UserFactory;
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
    userFactory = moduleFixture.get<UserFactory>(UserFactory);
    usersService = moduleFixture.get<UsersService>(UsersService);
  });

  afterAll(async () => {
    await databaseHelper.resetTestDB();
    await app.close();
  });

  afterEach(async () => {
    await databaseHelper.resetTestDB();
  });

  it('includes a candidate created exactly 1 day ago whose email is not verified', async () => {
    const user = await userFactory.create({
      role: UserRoles.CANDIDATE,
      createdAt: createdDaysAgo(1),
    });
    await usersService.update(user.id, { isEmailVerified: false });

    const result =
      await usersService.getUsersWithUnverifiedEmailOneDayAfterCreation();

    expect(result.map((u) => u.id)).toContain(user.id);
  });

  it('includes a coach created exactly 1 day ago whose email is not verified', async () => {
    const user = await userFactory.create({
      role: UserRoles.COACH,
      createdAt: createdDaysAgo(1),
    });
    await usersService.update(user.id, { isEmailVerified: false });

    const result =
      await usersService.getUsersWithUnverifiedEmailOneDayAfterCreation();

    expect(result.map((u) => u.id)).toContain(user.id);
  });

  it('excludes a user created 1 day ago whose email is already verified', async () => {
    const user = await userFactory.create({
      role: UserRoles.CANDIDATE,
      createdAt: createdDaysAgo(1),
    });

    const result =
      await usersService.getUsersWithUnverifiedEmailOneDayAfterCreation();

    expect(result.map((u) => u.id)).not.toContain(user.id);
  });

  it('excludes an unverified user created on a different day', async () => {
    const user = await userFactory.create({
      role: UserRoles.CANDIDATE,
      createdAt: createdDaysAgo(2),
    });
    await usersService.update(user.id, { isEmailVerified: false });

    const result =
      await usersService.getUsersWithUnverifiedEmailOneDayAfterCreation();

    expect(result.map((u) => u.id)).not.toContain(user.id);
  });

  it('excludes an unverified user created today', async () => {
    const user = await userFactory.create({
      role: UserRoles.CANDIDATE,
      createdAt: createdDaysAgo(0),
    });
    await usersService.update(user.id, { isEmailVerified: false });

    const result =
      await usersService.getUsersWithUnverifiedEmailOneDayAfterCreation();

    expect(result.map((u) => u.id)).not.toContain(user.id);
  });

  it('excludes an unverified referer created exactly 1 day ago', async () => {
    const referer = await userFactory.create({
      role: UserRoles.REFERER,
      createdAt: createdDaysAgo(1),
    });
    await usersService.update(referer.id, { isEmailVerified: false });

    const result =
      await usersService.getUsersWithUnverifiedEmailOneDayAfterCreation();

    expect(result.map((u) => u.id)).not.toContain(referer.id);
  });
});
