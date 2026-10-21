import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { QueuesService } from 'src/queues/producers/queues.service';
import { UserProfileRecommendationsLegacyService } from 'src/user-profile-recommendations/user-profile-recommendations-legacy.service';
import { UserRoles } from 'src/users/users.types';
import { ZoneName } from 'src/utils/types/zones.types';
import { BusinessSectorHelper } from 'tests/business-sectors/business-sector.helper';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import { NudgesHelper } from 'tests/nudges/nudges.helper';
import { QueuesServiceMock } from 'tests/queues/queues.service.mock';
import { UsersHelper } from 'tests/users/users.helper';

// The legacy recommendation engine: same region, role mirror, ordered by the match of the
// nudges and of the business sectors, then by creation date.
describe('UserProfileRecommendationsLegacyService', () => {
  let app: INestApplication;
  let databaseHelper: DatabaseHelper;
  let usersHelper: UsersHelper;
  let service: UserProfileRecommendationsLegacyService;
  let businessSectorsHelper: BusinessSectorHelper;
  let nudgesHelper: NudgesHelper;

  let sectorId: string;
  let otherSectorId: string;
  let nudgeId: string;
  let otherNudgeId: string;

  type ProfileOptions = {
    department?: string;
    lastConnection?: Date | null;
    nudgeIds?: string[];
    role: (typeof UserRoles)[keyof typeof UserRoles];
    sectorIds?: string[];
    unavailable?: boolean;
  };

  const createUser = (options: ProfileOptions) =>
    usersHelper.createLoggedInUser(
      {
        role: options.role,
        zone: ZoneName.IDF,
        lastConnection:
          options.lastConnection === undefined
            ? new Date()
            : options.lastConnection,
      },
      {
        userProfile: {
          department: (options.department ?? 'Paris (75)') as never,
          unavailableAt: options.unavailable ? new Date() : null,
          nudges: (options.nudgeIds ?? []).map((id) => ({ id })),
          sectorOccupations: (options.sectorIds ?? []).map(
            (businessSectorId) => ({ businessSectorId })
          ),
        },
      }
    );

  const recommendedIds = async (userId: string) =>
    (await service.findRecommendationsByUserId(userId)).map(
      ({ recommendedUserId }) => recommendedUserId
    );

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [CustomTestingModule],
    })
      .overrideProvider(QueuesService)
      .useClass(QueuesServiceMock)
      .compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    databaseHelper = moduleFixture.get(DatabaseHelper);
    usersHelper = moduleFixture.get(UsersHelper);
    service = moduleFixture.get(UserProfileRecommendationsLegacyService);
    businessSectorsHelper = moduleFixture.get(BusinessSectorHelper);
    nudgesHelper = moduleFixture.get(NudgesHelper);
  });

  afterAll(async () => {
    await databaseHelper.resetTestDB();
    await app.close();
  });

  beforeEach(async () => {
    await databaseHelper.resetTestDB();
    await businessSectorsHelper.deleteAllBusinessSectors();
    await businessSectorsHelper.seedBusinessSectors();
    await nudgesHelper.deleteAllNudges();
    await nudgesHelper.seedNudges();
    sectorId = (await businessSectorsHelper.findOne({ name: 'Sector 1' })).id;
    otherSectorId = (await businessSectorsHelper.findOne({ name: 'Sector 2' }))
      .id;
    nudgeId = (await nudgesHelper.findOne({ value: 'interview' })).id;
    otherNudgeId = (await nudgesHelper.findOne({ value: 'tips' })).id;
  });

  it('recommends the coaches of the same region, best nudge and sector match first', async () => {
    const candidate = await createUser({
      role: UserRoles.CANDIDATE,
      nudgeIds: [nudgeId],
      sectorIds: [sectorId],
    });
    const both = await createUser({
      role: UserRoles.COACH,
      nudgeIds: [nudgeId],
      sectorIds: [sectorId],
    });
    const nudgeOnly = await createUser({
      role: UserRoles.COACH,
      nudgeIds: [nudgeId],
      sectorIds: [otherSectorId],
    });
    const noMatch = await createUser({
      role: UserRoles.COACH,
      nudgeIds: [otherNudgeId],
    });
    await createUser({ role: UserRoles.COACH, department: 'Rhône (69)' });
    await createUser({ role: UserRoles.COACH, unavailable: true });
    await createUser({ role: UserRoles.COACH, lastConnection: null });
    await createUser({ role: UserRoles.CANDIDATE, nudgeIds: [nudgeId] });

    const created = await service.updateRecommendationsByUserId(
      candidate.user.id,
      2
    );

    expect(created).toHaveLength(2);
    expect(new Set(await recommendedIds(candidate.user.id))).toEqual(
      new Set([both.user.id, nudgeOnly.user.id])
    );
    expect(await recommendedIds(candidate.user.id)).not.toContain(
      noMatch.user.id
    );
  });

  it('recommends candidates to a coach, with a default pool of three', async () => {
    const coach = await createUser({
      role: UserRoles.COACH,
      nudgeIds: [nudgeId],
    });
    for (let index = 0; index < 4; index += 1) {
      await createUser({ role: UserRoles.CANDIDATE, nudgeIds: [nudgeId] });
    }
    await createUser({ role: UserRoles.COACH });

    const created = await service.updateRecommendationsByUserId(coach.user.id);

    expect(created).toHaveLength(3);
  });

  it('looks in every department when the user has none', async () => {
    const candidate = await usersHelper.createLoggedInUser(
      { role: UserRoles.CANDIDATE },
      { userProfile: { department: null } }
    );
    const farCoach = await createUser({
      role: UserRoles.COACH,
      department: 'Rhône (69)',
    });

    await service.updateRecommendationsByUserId(candidate.user.id);

    expect(await recommendedIds(candidate.user.id)).toEqual([farCoach.user.id]);
  });

  it('removes the stored recommendations of a user', async () => {
    const candidate = await createUser({ role: UserRoles.CANDIDATE });
    await createUser({ role: UserRoles.COACH });
    await service.updateRecommendationsByUserId(candidate.user.id);
    expect(await service.countRecommendationsByUserId(candidate.user.id)).toBe(
      1
    );

    await service.removeRecommendationsByUserId(candidate.user.id);

    expect(await service.countRecommendationsByUserId(candidate.user.id)).toBe(
      0
    );
  });
});
