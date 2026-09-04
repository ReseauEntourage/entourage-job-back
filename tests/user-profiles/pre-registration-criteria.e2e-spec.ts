import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { BusinessSector } from 'src/business-sectors/models';
import { Nudge } from 'src/nudge/models';
import { QueuesService } from 'src/queues/producers/queues.service';
import { UserProfilesService } from 'src/user-profiles/user-profiles.service';
import { UserRoles } from 'src/users/users.types';
import { BusinessSectorHelper } from 'tests/business-sectors/business-sector.helper';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import { NudgesHelper } from 'tests/nudges/nudges.helper';
import { QueuesServiceMock } from 'tests/queues/queues.service.mock';
import { UserFactory } from 'tests/users/user.factory';

describe('UserProfilesService.getPreRegistrationCriteriaForUser', () => {
  let app: INestApplication;
  let databaseHelper: DatabaseHelper;
  let userFactory: UserFactory;
  let userProfilesService: UserProfilesService;
  let businessSectorsHelper: BusinessSectorHelper;
  let nudgesHelper: NudgesHelper;

  let businessSector1: BusinessSector;
  let nudgeInterview: Nudge;

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

    await businessSectorsHelper.deleteAllBusinessSectors();
    await businessSectorsHelper.seedBusinessSectors();
    businessSector1 = await businessSectorsHelper.findOne({
      name: 'Sector 1',
    });

    await nudgesHelper.deleteAllNudges();
    await nudgesHelper.seedNudges();
    nudgeInterview = await nudgesHelper.findOne({ value: 'interview' });
  });

  afterAll(async () => {
    await databaseHelper.resetTestDB();
    await app.close();
  });

  it('returns the business sectors and nudges persisted on the user profile', async () => {
    const user = await userFactory.create(
      { role: UserRoles.CANDIDATE },
      {
        userProfile: {
          sectorOccupations: [
            {
              businessSectorId: businessSector1.id,
              occupation: { name: 'menuisier' },
            },
          ],
          nudges: [{ id: nudgeInterview.id }],
        },
      }
    );

    const criteria =
      await userProfilesService.getPreRegistrationCriteriaForUser(user.id);

    expect(criteria.businessSectorIds).toEqual([businessSector1.id]);
    expect(criteria.nudgeIds).toEqual([nudgeInterview.id]);
  });

  it('returns empty arrays when no criterion is set on the user profile', async () => {
    const user = await userFactory.create({ role: UserRoles.CANDIDATE });

    const criteria =
      await userProfilesService.getPreRegistrationCriteriaForUser(user.id);

    expect(criteria.businessSectorIds).toEqual([]);
    expect(criteria.nudgeIds).toEqual([]);
  });
});
