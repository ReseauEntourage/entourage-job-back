import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { QueueMocks, S3Mocks } from '../mocks.types';
import { S3Service } from 'src/external-services/aws/s3.service';
import { QueuesService } from 'src/queues/producers/queues.service';
import { UserProfilesService } from 'src/user-profiles/user-profiles.service';
import { User } from 'src/users/models';
import { UsersService } from 'src/users/users.service';
import { OnboardingStatus, UserRoles } from 'src/users/users.types';
import { ExperienceFactory } from 'tests/common/experiences/experience.factory';
import { FormationFactory } from 'tests/common/formations/formation.factory';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import { QueuesServiceMock } from 'tests/queues/queues.service.mock';
import { UserFactory } from './user.factory';

describe('UsersService.getUsersStuckBeforeOnboardingCompletion', () => {
  let app: INestApplication;
  let databaseHelper: DatabaseHelper;
  let userFactory: UserFactory;
  let usersService: UsersService;
  let userProfilesService: UserProfilesService;
  let experienceFactory: ExperienceFactory;
  let formationFactory: FormationFactory;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [CustomTestingModule],
    })
      .overrideProvider(QueuesService)
      .useClass(QueuesServiceMock)
      .overrideProvider(S3Service)
      .useValue(S3Mocks)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    databaseHelper = moduleFixture.get<DatabaseHelper>(DatabaseHelper);
    userFactory = moduleFixture.get<UserFactory>(UserFactory);
    usersService = moduleFixture.get<UsersService>(UsersService);
    userProfilesService =
      moduleFixture.get<UserProfilesService>(UserProfilesService);
    experienceFactory = moduleFixture.get<ExperienceFactory>(ExperienceFactory);
    formationFactory = moduleFixture.get<FormationFactory>(FormationFactory);
  });

  afterAll(async () => {
    await app.close();
    if (QueueMocks.close) {
      await QueueMocks.close();
    }
  });

  beforeEach(async () => {
    await databaseHelper.resetTestDB();
  });

  // A candidate or coach who has done every step before the webinar
  async function createUserBeforeWebinar(
    props: Partial<User> = {},
    options: {
      withExperience?: boolean;
      withFormation?: boolean;
      withPresentation?: boolean;
      withSurvey?: boolean;
    } = {}
  ): Promise<string> {
    const {
      withExperience = true,
      withFormation = true,
      withPresentation = true,
      withSurvey = true,
    } = options;
    const user = await userFactory.create(
      {
        role: UserRoles.COACH,
        onboardingStatus: OnboardingStatus.IN_PROGRESS,
        onboardingCompletedAt: null,
        elearningCompletedAt: new Date(),
        ...props,
      },
      {
        userProfile: {
          hasPicture: true,
          description: withPresentation ? 'Une présentation' : '',
        },
        userSocialCondition: withSurvey ? { hasCompletedSurvey: true } : {},
      }
    );
    const profile = await userProfilesService.findOneByUserId(user.id);
    if (withExperience) {
      await experienceFactory.create({ userProfileId: profile.id });
    }
    if (withFormation) {
      await formationFactory.create({ userProfileId: profile.id });
    }
    return user.id;
  }

  it('selects an account that skipped the webinar, as evidence', async () => {
    const user = await userFactory.create(
      {
        role: UserRoles.CANDIDATE,
        onboardingStatus: OnboardingStatus.IN_PROGRESS,
        onboardingCompletedAt: null,
        onboardingWebinarSkippedAt: new Date(),
      },
      { userProfile: {} }
    );

    const stuck = await usersService.getUsersStuckBeforeOnboardingCompletion();

    expect(stuck).toEqual([
      { id: user.id, role: UserRoles.CANDIDATE, category: 'evidence' },
    ]);
  });

  it('selects an account that has done every step before the webinar, as inferred', async () => {
    const id = await createUserBeforeWebinar();

    const stuck = await usersService.getUsersStuckBeforeOnboardingCompletion();

    expect(stuck).toEqual([
      { id, role: UserRoles.COACH, category: 'inferred' },
    ]);
  });

  it('does not select an account whose onboarding is already completed', async () => {
    await createUserBeforeWebinar({
      onboardingStatus: OnboardingStatus.COMPLETED,
      onboardingCompletedAt: new Date(),
    });

    await expect(
      usersService.getUsersStuckBeforeOnboardingCompletion()
    ).resolves.toEqual([]);
  });

  it.each([
    ['the e-learning is not completed', { elearningCompletedAt: null }, {}],
    ['there is no formation', {}, { withFormation: false }],
    ['there is no experience', {}, { withExperience: false }],
    ['there is no presentation', {}, { withPresentation: false }],
  ])(
    'does not select an account that did not reach the webinar: %s',
    async (_label, props, options) => {
      await createUserBeforeWebinar(props, options);

      await expect(
        usersService.getUsersStuckBeforeOnboardingCompletion()
      ).resolves.toEqual([]);
    }
  );

  it('does not select an account without a picture', async () => {
    const user = await userFactory.create(
      {
        role: UserRoles.COACH,
        onboardingStatus: OnboardingStatus.IN_PROGRESS,
        onboardingCompletedAt: null,
        elearningCompletedAt: new Date(),
      },
      { userProfile: { hasPicture: false, description: 'Une présentation' } }
    );
    const profile = await userProfilesService.findOneByUserId(user.id);
    await experienceFactory.create({ userProfileId: profile.id });
    await formationFactory.create({ userProfileId: profile.id });

    await expect(
      usersService.getUsersStuckBeforeOnboardingCompletion()
    ).resolves.toEqual([]);
  });

  it('requires the social situation survey for a candidate only', async () => {
    const candidateWithoutSurvey = await createUserBeforeWebinar(
      { role: UserRoles.CANDIDATE },
      { withSurvey: false }
    );
    const coachWithoutSurvey = await createUserBeforeWebinar(
      { role: UserRoles.COACH },
      { withSurvey: false }
    );
    const candidateWithSurvey = await createUserBeforeWebinar({
      role: UserRoles.CANDIDATE,
    });

    const stuck = await usersService.getUsersStuckBeforeOnboardingCompletion();

    const ids = stuck.map(({ id }) => id);
    expect(ids).toEqual(
      expect.arrayContaining([coachWithoutSurvey, candidateWithSurvey])
    );
    expect(ids).not.toContain(candidateWithoutSurvey);
  });

  it('does not select other roles', async () => {
    await createUserBeforeWebinar({ role: UserRoles.REFERER });
    await createUserBeforeWebinar({ role: UserRoles.ADMIN });

    await expect(
      usersService.getUsersStuckBeforeOnboardingCompletion()
    ).resolves.toEqual([]);
  });
});
