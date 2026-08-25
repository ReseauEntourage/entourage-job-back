import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import moment from 'moment/moment';
import { CompanyUserRole } from 'src/companies/company-user.utils';
import { QueuesService } from 'src/queues/producers/queues.service';
import { UsersService } from 'src/users/users.service';
import { UserRoles } from 'src/users/users.types';
import { CompanyFactory } from 'tests/companies/company.factory';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import { QueuesServiceMock } from 'tests/queues/queues.service.mock';
import { UserFactory } from 'tests/users/user.factory';

const DAYS_AFTER_ONBOARDING_COMPLETION = 2;

// Onboarding completed `daysAgo` days ago, truncated to midnight like the
// production query, so the comparison lands exactly on a day boundary.
const onboardingCompletedDaysAgo = (daysAgo: number) =>
  moment().startOf('day').subtract(daysAgo, 'days').toDate();

describe('UsersService.getUsersEligibleForElearningCompletionReminder', () => {
  let app: INestApplication;
  let databaseHelper: DatabaseHelper;
  let userFactory: UserFactory;
  let companyFactory: CompanyFactory;
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
    companyFactory = moduleFixture.get<CompanyFactory>(CompanyFactory);
    usersService = moduleFixture.get<UsersService>(UsersService);
  });

  afterAll(async () => {
    await databaseHelper.resetTestDB();
    await app.close();
  });

  afterEach(async () => {
    await databaseHelper.resetTestDB();
  });

  it('includes a candidate who completed onboarding exactly 2 days ago without finishing elearning', async () => {
    const user = await userFactory.create({
      role: UserRoles.CANDIDATE,
      onboardingCompletedAt: onboardingCompletedDaysAgo(
        DAYS_AFTER_ONBOARDING_COMPLETION
      ),
      elearningCompletedAt: null,
    });

    const result =
      await usersService.getUsersEligibleForElearningCompletionReminder(
        DAYS_AFTER_ONBOARDING_COMPLETION
      );

    expect(result.map((u) => u.id)).toContain(user.id);
  });

  it('includes a coach who completed onboarding exactly 2 days ago without finishing elearning', async () => {
    const user = await userFactory.create({
      role: UserRoles.COACH,
      onboardingCompletedAt: onboardingCompletedDaysAgo(
        DAYS_AFTER_ONBOARDING_COMPLETION
      ),
      elearningCompletedAt: null,
    });

    const result =
      await usersService.getUsersEligibleForElearningCompletionReminder(
        DAYS_AFTER_ONBOARDING_COMPLETION
      );

    expect(result.map((u) => u.id)).toContain(user.id);
  });

  it('excludes a user who has already completed elearning', async () => {
    const user = await userFactory.create({
      role: UserRoles.CANDIDATE,
      onboardingCompletedAt: onboardingCompletedDaysAgo(
        DAYS_AFTER_ONBOARDING_COMPLETION
      ),
      elearningCompletedAt: new Date(),
    });

    const result =
      await usersService.getUsersEligibleForElearningCompletionReminder(
        DAYS_AFTER_ONBOARDING_COMPLETION
      );

    expect(result.map((u) => u.id)).not.toContain(user.id);
  });

  it('excludes a company admin coach even without finishing elearning', async () => {
    const user = await userFactory.create({
      role: UserRoles.COACH,
      onboardingCompletedAt: onboardingCompletedDaysAgo(
        DAYS_AFTER_ONBOARDING_COMPLETION
      ),
      elearningCompletedAt: null,
    });
    const company = await companyFactory.create();
    await companyFactory.linkAdminToCompany(company, user.id, {
      isAdmin: true,
      role: CompanyUserRole.EXECUTIVE,
    });

    const result =
      await usersService.getUsersEligibleForElearningCompletionReminder(
        DAYS_AFTER_ONBOARDING_COMPLETION
      );

    expect(result.map((u) => u.id)).not.toContain(user.id);
  });

  it('excludes a referer or admin role regardless of elearning status', async () => {
    const referer = await userFactory.create({
      role: UserRoles.REFERER,
      onboardingCompletedAt: onboardingCompletedDaysAgo(
        DAYS_AFTER_ONBOARDING_COMPLETION
      ),
      elearningCompletedAt: null,
    });

    const result =
      await usersService.getUsersEligibleForElearningCompletionReminder(
        DAYS_AFTER_ONBOARDING_COMPLETION
      );

    expect(result.map((u) => u.id)).not.toContain(referer.id);
  });

  it('excludes a user whose onboarding completed at a different delay', async () => {
    const user = await userFactory.create({
      role: UserRoles.CANDIDATE,
      onboardingCompletedAt: onboardingCompletedDaysAgo(1),
      elearningCompletedAt: null,
    });

    const result =
      await usersService.getUsersEligibleForElearningCompletionReminder(
        DAYS_AFTER_ONBOARDING_COMPLETION
      );

    expect(result.map((u) => u.id)).not.toContain(user.id);
  });
});
