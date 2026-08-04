import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import moment from 'moment/moment';
import { QueuesService } from 'src/queues/producers/queues.service';
import { UserProfilesService } from 'src/user-profiles/user-profiles.service';
import { UsersService } from 'src/users/users.service';
import { OnboardingStatus, UserRoles } from 'src/users/users.types';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import { QueuesServiceMock } from 'tests/queues/queues.service.mock';
import { UserFactory } from 'tests/users/user.factory';

// Onboarding completed `daysAgo` days ago, truncated to midnight like the
// production query, so the modulo lands exactly on day boundaries.
const onboardingCompletedDaysAgo = (daysAgo: number) =>
  moment().startOf('day').subtract(daysAgo, 'days').toDate();

describe('UsersService.getUsersEligibleForRecommendationMails', () => {
  let app: INestApplication;
  let databaseHelper: DatabaseHelper;
  let userFactory: UserFactory;
  let usersService: UsersService;
  let userProfilesService: UserProfilesService;

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
    userProfilesService =
      moduleFixture.get<UserProfilesService>(UserProfilesService);
  });

  afterAll(async () => {
    await databaseHelper.resetTestDB();
    await app.close();
  });

  afterEach(async () => {
    await databaseHelper.resetTestDB();
  });

  it('retains an eligible user exactly 10 days after onboarding completion', async () => {
    const user = await userFactory.create(
      { onboardingCompletedAt: onboardingCompletedDaysAgo(10) },
      { userProfile: { unavailableAt: null, optInRecommendations: true } }
    );

    const result = await usersService.getUsersEligibleForRecommendationMails();

    expect(result.map((u) => u.id)).toContain(user.id);
  });

  it('retains an eligible user exactly 20 days after onboarding completion', async () => {
    const user = await userFactory.create(
      { onboardingCompletedAt: onboardingCompletedDaysAgo(20) },
      { userProfile: { unavailableAt: null, optInRecommendations: true } }
    );

    const result = await usersService.getUsersEligibleForRecommendationMails();

    expect(result.map((u) => u.id)).toContain(user.id);
  });

  it('excludes a user on the day onboarding was completed (day 0)', async () => {
    const user = await userFactory.create(
      { onboardingCompletedAt: onboardingCompletedDaysAgo(0) },
      { userProfile: { unavailableAt: null, optInRecommendations: true } }
    );

    const result = await usersService.getUsersEligibleForRecommendationMails();

    expect(result.map((u) => u.id)).not.toContain(user.id);
  });

  it('excludes a user outside the 10-day cycle', async () => {
    const user = await userFactory.create(
      { onboardingCompletedAt: onboardingCompletedDaysAgo(7) },
      { userProfile: { unavailableAt: null, optInRecommendations: true } }
    );

    const result = await usersService.getUsersEligibleForRecommendationMails();

    expect(result.map((u) => u.id)).not.toContain(user.id);
  });

  it('excludes a user who opted out of recommendation emails', async () => {
    const user = await userFactory.create(
      { onboardingCompletedAt: onboardingCompletedDaysAgo(10) },
      { userProfile: { unavailableAt: null, optInRecommendations: false } }
    );

    const result = await usersService.getUsersEligibleForRecommendationMails();

    expect(result.map((u) => u.id)).not.toContain(user.id);
  });

  it('excludes a user who has not completed onboarding', async () => {
    const user = await userFactory.create(
      {
        onboardingStatus: OnboardingStatus.IN_PROGRESS,
        onboardingCompletedAt: null,
      },
      { userProfile: { unavailableAt: null, optInRecommendations: true } }
    );

    const result = await usersService.getUsersEligibleForRecommendationMails();

    expect(result.map((u) => u.id)).not.toContain(user.id);
  });

  it('excludes an unavailable user', async () => {
    const user = await userFactory.create(
      { onboardingCompletedAt: onboardingCompletedDaysAgo(10) },
      { userProfile: { unavailableAt: new Date(), optInRecommendations: true } }
    );

    const result = await usersService.getUsersEligibleForRecommendationMails();

    expect(result.map((u) => u.id)).not.toContain(user.id);
  });

  it('does not send a catch-up email for a cycle day missed while unavailable', async () => {
    // Unavailable exactly on their cycle day (10)...
    const user = await userFactory.create(
      { onboardingCompletedAt: onboardingCompletedDaysAgo(10) },
      { userProfile: { unavailableAt: new Date(), optInRecommendations: true } }
    );

    const missedDayResult =
      await usersService.getUsersEligibleForRecommendationMails();
    expect(missedDayResult.map((u) => u.id)).not.toContain(user.id);

    // ...becomes available again, simulated as the next day (11 days into
    // the cycle, still off-cycle) by shifting onboardingCompletedAt back one
    // day rather than advancing real time.
    await usersService.update(user.id, {
      onboardingCompletedAt: onboardingCompletedDaysAgo(11),
    });
    await userProfilesService.updateByUserId(user.id, { unavailableAt: null });

    const offCycleResult =
      await usersService.getUsersEligibleForRecommendationMails();
    expect(offCycleResult.map((u) => u.id)).not.toContain(user.id);
  });

  it('respects the roles restricted to candidate and coach', async () => {
    const admin = await userFactory.create(
      {
        role: UserRoles.ADMIN,
        onboardingCompletedAt: onboardingCompletedDaysAgo(10),
      },
      { userProfile: { unavailableAt: null, optInRecommendations: true } }
    );

    const result = await usersService.getUsersEligibleForRecommendationMails();

    expect(result.map((u) => u.id)).not.toContain(admin.id);
  });
});
