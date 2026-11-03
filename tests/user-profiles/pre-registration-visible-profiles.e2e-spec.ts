import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { BusinessSector } from 'src/business-sectors/models';
import { Nudge } from 'src/nudge/models';
import { QueuesService } from 'src/queues/producers/queues.service';
import { UserProfilesService } from 'src/user-profiles/user-profiles.service';
import { OnboardingStatus, UserRoles } from 'src/users/users.types';
import { BusinessSectorHelper } from 'tests/business-sectors/business-sector.helper';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import { NudgesHelper } from 'tests/nudges/nudges.helper';
import { QueuesServiceMock } from 'tests/queues/queues.service.mock';
import { UserFactory } from 'tests/users/user.factory';

describe('UserProfilesService.findPreRegistrationCompatibleProfiles - onlyVisibleProfiles', () => {
  let app: INestApplication;
  let databaseHelper: DatabaseHelper;
  let userFactory: UserFactory;
  let userProfilesService: UserProfilesService;
  let businessSectorsHelper: BusinessSectorHelper;
  let nudgesHelper: NudgesHelper;

  let businessSector1: BusinessSector;
  let businessSector2: BusinessSector;
  let nudgeCv: Nudge;
  let nudgeTips: Nudge;

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
    userProfilesService =
      moduleFixture.get<UserProfilesService>(UserProfilesService);
    businessSectorsHelper =
      moduleFixture.get<BusinessSectorHelper>(BusinessSectorHelper);
    nudgesHelper = moduleFixture.get<NudgesHelper>(NudgesHelper);

    await databaseHelper.resetTestDB();
    await businessSectorsHelper.deleteAllBusinessSectors();
    await businessSectorsHelper.seedBusinessSectors();
    businessSector1 = await businessSectorsHelper.findOne({
      name: 'Sector 1',
    });
    businessSector2 = await businessSectorsHelper.findOne({
      name: 'Sector 2',
    });

    await nudgesHelper.deleteAllNudges();
    await nudgesHelper.seedNudges();
    nudgeCv = await nudgesHelper.findOne({ value: 'cv' });
    nudgeTips = await nudgesHelper.findOne({ value: 'tips' });
  });

  afterAll(async () => {
    await databaseHelper.resetTestDB();
    await app.close();
  });

  // The database is reset between tests, so the sectors and nudges are
  // re-seeded in `beforeEach` through the helpers' ids captured above.
  afterEach(async () => {
    await databaseHelper.resetTestDB();
    await businessSectorsHelper.deleteAllBusinessSectors();
    await businessSectorsHelper.seedBusinessSectors();
    businessSector1 = await businessSectorsHelper.findOne({
      name: 'Sector 1',
    });
    businessSector2 = await businessSectorsHelper.findOne({
      name: 'Sector 2',
    });
    await nudgesHelper.deleteAllNudges();
    await nudgesHelper.seedNudges();
    nudgeCv = await nudgesHelper.findOne({ value: 'cv' });
    nudgeTips = await nudgesHelper.findOne({ value: 'tips' });
  });

  // One coach per reason a profile can be hidden, plus visible ones.
  const createCoaches = async (
    visibleCount: number,
    userProfile: Record<string, unknown> = {}
  ) => {
    const visible = await databaseHelper.createEntities(
      userFactory,
      visibleCount,
      { role: UserRoles.COACH },
      { userProfile: { unavailableAt: null, ...userProfile } }
    );
    const unavailable = await databaseHelper.createEntities(
      userFactory,
      1,
      { role: UserRoles.COACH },
      { userProfile: { unavailableAt: new Date(), ...userProfile } }
    );
    const onboardingNotCompleted = await databaseHelper.createEntities(
      userFactory,
      1,
      { role: UserRoles.COACH, onboardingStatus: OnboardingStatus.IN_PROGRESS },
      { userProfile: { unavailableAt: null, ...userProfile } }
    );
    const elearningNotCompleted = await databaseHelper.createEntities(
      userFactory,
      1,
      { role: UserRoles.COACH, elearningCompletedAt: null },
      { userProfile: { unavailableAt: null, ...userProfile } }
    );
    return {
      visible,
      unavailable,
      onboardingNotCompleted,
      elearningNotCompleted,
    };
  };

  it('keeps counting profiles whose onboarding or eLearning is not completed when the flag is omitted', async () => {
    const { visible } = await createCoaches(3);

    const result =
      await userProfilesService.findPreRegistrationCompatibleProfiles(
        UserRoles.CANDIDATE
      );

    // 3 visible + onboarding not completed + eLearning not completed;
    // only the unavailable one is excluded, as before.
    expect(result.count).toBe(visible.length + 2);
  });

  it('excludes unavailable profiles and profiles whose onboarding or eLearning is not completed when no criteria are given', async () => {
    const { visible } = await createCoaches(3);

    const result =
      await userProfilesService.findPreRegistrationCompatibleProfiles(
        UserRoles.CANDIDATE,
        [],
        [],
        true
      );

    expect(result.count).toBe(3);
    expect(result.broadened).toBe(false);
    expect(result.profiles.map(({ id }) => id).sort()).toEqual(
      visible.map(({ id }) => id).sort()
    );
  });

  it('applies the same filter when matching on sectors and nudges', async () => {
    const { visible } = await createCoaches(2, {
      nudges: [{ id: nudgeCv.id }],
      sectorOccupations: [{ businessSectorId: businessSector1.id }],
    });

    const result =
      await userProfilesService.findPreRegistrationCompatibleProfiles(
        UserRoles.CANDIDATE,
        [nudgeCv.id],
        [businessSector1.id],
        true
      );

    expect(result.count).toBe(2);
    expect(result.broadened).toBe(false);
    expect(result.profiles.map(({ id }) => id).sort()).toEqual(
      visible.map(({ id }) => id).sort()
    );
  });

  it('broadens to the sectors alone, still only among visible profiles', async () => {
    const { visible } = await createCoaches(3, {
      nudges: [{ id: nudgeTips.id }],
      sectorOccupations: [{ businessSectorId: businessSector1.id }],
    });

    const result =
      await userProfilesService.findPreRegistrationCompatibleProfiles(
        UserRoles.CANDIDATE,
        [nudgeCv.id],
        [businessSector1.id],
        true
      );

    expect(result.broadened).toBe(true);
    expect(result.count).toBe(3);
    expect(result.profiles.map(({ id }) => id).sort()).toEqual(
      visible.map(({ id }) => id).sort()
    );
  });

  it('does not broaden to profiles of another sector', async () => {
    await createCoaches(3, {
      nudges: [{ id: nudgeTips.id }],
      sectorOccupations: [{ businessSectorId: businessSector2.id }],
    });

    const result =
      await userProfilesService.findPreRegistrationCompatibleProfiles(
        UserRoles.CANDIDATE,
        [nudgeCv.id],
        [businessSector1.id],
        true
      );

    expect(result.count).toBe(0);
    expect(result.profiles).toEqual([]);
  });

  it('applies the same filter to candidates shown to a coach', async () => {
    const visibleCandidates = await databaseHelper.createEntities(
      userFactory,
      3,
      { role: UserRoles.CANDIDATE },
      { userProfile: { unavailableAt: null } }
    );
    await databaseHelper.createEntities(
      userFactory,
      1,
      { role: UserRoles.CANDIDATE, elearningCompletedAt: null },
      { userProfile: { unavailableAt: null } }
    );

    const result =
      await userProfilesService.findPreRegistrationCompatibleProfiles(
        UserRoles.COACH,
        [],
        [],
        true
      );

    expect(result.count).toBe(3);
    expect(result.profiles.map(({ id }) => id).sort()).toEqual(
      visibleCandidates.map(({ id }) => id).sort()
    );
  });
});
