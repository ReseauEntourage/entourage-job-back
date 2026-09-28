import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import moment from 'moment/moment';
import { QueuesService } from 'src/queues/producers/queues.service';
import { UsersService } from 'src/users/users.service';
import { OnboardingStatus, UserRoles } from 'src/users/users.types';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import { QueuesServiceMock } from 'tests/queues/queues.service.mock';
import { UserFactory } from 'tests/users/user.factory';

// Same delay as the remindUsersNotCompletedOnboarding cron task.
const DAYS_SINCE_CREATION = 3;

// Created `daysAgo` days ago, truncated to midnight like the production
// query, so the comparison lands exactly on a day boundary.
const createdDaysAgo = (daysAgo: number) =>
  moment().startOf('day').subtract(daysAgo, 'days').toDate();

describe('UsersService.getUsersNotCompletedOnboarding', () => {
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

  const getResultIds = async () =>
    (
      await usersService.getUsersNotCompletedOnboarding(DAYS_SINCE_CREATION)
    ).map((u) => u.id);

  it('includes a verified candidate created 3 days ago with onboarding in progress', async () => {
    const user = await userFactory.create({
      role: UserRoles.CANDIDATE,
      onboardingStatus: OnboardingStatus.IN_PROGRESS,
      createdAt: createdDaysAgo(DAYS_SINCE_CREATION),
    });

    expect(await getResultIds()).toContain(user.id);
  });

  it('includes a verified coach created 3 days ago with onboarding not started', async () => {
    const user = await userFactory.create({
      role: UserRoles.COACH,
      onboardingStatus: OnboardingStatus.NOT_STARTED,
      createdAt: createdDaysAgo(DAYS_SINCE_CREATION),
    });

    expect(await getResultIds()).toContain(user.id);
  });

  it('excludes a user created 3 days ago with onboarding not completed whose email is not verified', async () => {
    const user = await userFactory.create({
      role: UserRoles.CANDIDATE,
      onboardingStatus: OnboardingStatus.IN_PROGRESS,
      createdAt: createdDaysAgo(DAYS_SINCE_CREATION),
    });
    await usersService.update(user.id, { isEmailVerified: false });

    expect(await getResultIds()).not.toContain(user.id);
  });

  it('excludes a verified user created 3 days ago whose onboarding is completed', async () => {
    const user = await userFactory.create({
      role: UserRoles.CANDIDATE,
      onboardingStatus: OnboardingStatus.COMPLETED,
      createdAt: createdDaysAgo(DAYS_SINCE_CREATION),
    });

    expect(await getResultIds()).not.toContain(user.id);
  });

  it('excludes verified users with onboarding not completed created on a different day', async () => {
    const twoDaysAgo = await userFactory.create({
      role: UserRoles.CANDIDATE,
      onboardingStatus: OnboardingStatus.IN_PROGRESS,
      createdAt: createdDaysAgo(DAYS_SINCE_CREATION - 1),
    });
    const fourDaysAgo = await userFactory.create({
      role: UserRoles.CANDIDATE,
      onboardingStatus: OnboardingStatus.IN_PROGRESS,
      createdAt: createdDaysAgo(DAYS_SINCE_CREATION + 1),
    });

    const resultIds = await getResultIds();

    expect(resultIds).not.toContain(twoDaysAgo.id);
    expect(resultIds).not.toContain(fourDaysAgo.id);
  });

  it('excludes an admin created 3 days ago with onboarding not completed', async () => {
    const user = await userFactory.create({
      role: UserRoles.ADMIN,
      onboardingStatus: OnboardingStatus.IN_PROGRESS,
      createdAt: createdDaysAgo(DAYS_SINCE_CREATION),
    });

    expect(await getResultIds()).not.toContain(user.id);
  });
});
