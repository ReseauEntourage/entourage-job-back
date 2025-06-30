import { Server } from 'http';
import { getQueueToken } from '@nestjs/bull';
import { CACHE_MANAGER, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { BusinessSector } from 'src/common/business-sectors/models';
import { Nudge } from 'src/common/nudge/models';
import { PublicProfilesController } from 'src/public-profiles/public-profiles.controller';
import { Queues } from 'src/queues/queues.types';
import { User } from 'src/users/models';
import { UserRoles } from 'src/users/users.types';
import { AdminZones, APIResponse } from 'src/utils/types';
import { BusinessSectorHelper } from 'tests/business-sectors/business-sector.helper';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import { LanguageHelper } from 'tests/languages/language.helper';
import { CacheMocks, QueueMocks } from 'tests/mocks.types';
import { NudgesHelper } from 'tests/nudges/nudges.helper';
import { UserFactory } from 'tests/users/user.factory';

describe('PublicProfiles', () => {
  let app: INestApplication;
  let server: Server;

  let userFactory: UserFactory;

  let databaseHelper: DatabaseHelper;
  let nudgesHelper: NudgesHelper;
  let languagesHelper: LanguageHelper;
  let businessSectorsHelper: BusinessSectorHelper;

  let businessSector1: BusinessSector;
  let businessSector2: BusinessSector;
  let businessSector3: BusinessSector;

  let nudgeTips: Nudge;
  let nudgeInterview: Nudge;
  let nudgeNetwork: Nudge;

  let userCandidates: User[];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [CustomTestingModule],
    })
      .overrideProvider(getQueueToken(Queues.WORK))
      .useValue(QueueMocks)
      .overrideProvider(CACHE_MANAGER)
      .useValue(CacheMocks)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    server = app.getHttpServer();

    userFactory = moduleFixture.get<UserFactory>(UserFactory);

    databaseHelper = moduleFixture.get<DatabaseHelper>(DatabaseHelper);
    nudgesHelper = moduleFixture.get<NudgesHelper>(NudgesHelper);
    languagesHelper = moduleFixture.get<LanguageHelper>(LanguageHelper);
    businessSectorsHelper =
      moduleFixture.get<BusinessSectorHelper>(BusinessSectorHelper);

    // Seed nudges before each test
    await nudgesHelper.deleteAllNudges();
    await nudgesHelper.seedNudges();

    nudgeTips = await nudgesHelper.findOne({ value: 'tips' });
    nudgeInterview = await nudgesHelper.findOne({ value: 'interview' });
    nudgeNetwork = await nudgesHelper.findOne({ value: 'network' });

    // Seed languages before each test
    await languagesHelper.deleteAllLanguages();
    await languagesHelper.seedLanguages();

    // Seed business sectors before each test
    await businessSectorsHelper.deleteAllBusinessSectors();
    await businessSectorsHelper.seedBusinessSectors();

    businessSector1 = await businessSectorsHelper.findOne({
      name: 'Sector 1',
    });

    businessSector2 = await businessSectorsHelper.findOne({
      name: 'Sector 2',
    });

    businessSector3 = await businessSectorsHelper.findOne({
      name: 'Sector 3',
    });
  });

  afterAll(async () => {
    await databaseHelper.resetTestDB();
    await app.close();
    server.close();
  });

  beforeEach(async () => {
    await databaseHelper.resetTestDB();

    userCandidates = await databaseHelper.createEntities(
      userFactory,
      3,
      {
        role: UserRoles.CANDIDATE,
        zone: AdminZones.LILLE,
      },
      {
        userProfile: {
          department: 'Nord (59)',
          isAvailable: true,
          sectorOccupations: [
            {
              businessSectorId: businessSector1.id,
              order: 1,
            },
            {
              businessSectorId: businessSector2.id,
              order: 2,
            },
            {
              businessSectorId: businessSector3.id,
              order: 3,
            },
          ],
          nudges: [
            { id: nudgeTips.id },
            { id: nudgeNetwork.id },
            { id: nudgeInterview.id },
          ],
        },
      }
    );

    await databaseHelper.createEntities(
      userFactory,
      1,
      {
        role: UserRoles.COACH,
        zone: AdminZones.PARIS,
      },
      {
        userProfile: {
          department: 'Paris (75)',
          isAvailable: true,
          currentJob: 'Développeur',
          sectorOccupations: [
            {
              businessSectorId: businessSector1.id,
              order: 1,
            },
            {
              businessSectorId: businessSector2.id,
              order: 2,
            },
            {
              businessSectorId: businessSector3.id,
              order: 3,
            },
          ],
          nudges: [
            { id: nudgeTips.id },
            { id: nudgeNetwork.id },
            { id: nudgeInterview.id },
          ],
        },
      }
    );
  });

  describe('GET /users/public-profiles', () => {
    it('should return all public profiles', async () => {
      const response: APIResponse<
        PublicProfilesController['getPublicProfiles']
      > = await request(server).get(`/users/public-profiles`);
      expect(response.status).toBe(200);
    });

    it('should return only candidate public profiles', async () => {
      const response: APIResponse<
        PublicProfilesController['getPublicProfiles']
      > = await request(server).get(`/users/public-profiles`);
      expect(response.status).toBe(200);
      expect(response.body.length).toBe(3);
      expect(
        response.body.every((profile) => profile.role === UserRoles.CANDIDATE)
      ).toBe(true);
    });

    it('should return public profiles with correct fields', async () => {
      const response: APIResponse<
        PublicProfilesController['getPublicProfiles']
      > = await request(server).get(`/users/public-profiles`);
      expect(response.status).toBe(200);
      // Direct Attributes
      expect(response.body[0]).toHaveProperty('id');
      expect(response.body[0]).toHaveProperty('firstName');
      expect(response.body[0]).toHaveProperty('lastName');
      expect(response.body[0]).toHaveProperty('role');

      // Direct Relationships
      expect(response.body[0].candidat).toBeDefined();
      expect(response.body[0].userProfile).toBeDefined();

      // User Profile Attributes
      expect(response.body[0].userProfile).toHaveProperty('department');
      expect(response.body[0].userProfile).toHaveProperty('description');
      expect(response.body[0].userProfile).toHaveProperty('introduction');
      expect(response.body[0].userProfile).toHaveProperty('isAvailable');
      expect(response.body[0].userProfile).toHaveProperty('linkedinUrl');
      expect(response.body[0].userProfile).toHaveProperty('customNudges');
      expect(response.body[0].userProfile).toHaveProperty(
        'userProfileLanguages'
      );
      expect(response.body[0].userProfile).toHaveProperty('contracts');
      expect(response.body[0].userProfile).toHaveProperty('skills');
      expect(response.body[0].userProfile).toHaveProperty('experiences');
      expect(response.body[0].userProfile).toHaveProperty('formations');
      expect(response.body[0].userProfile).toHaveProperty('reviews');
      expect(response.body[0].userProfile).toHaveProperty('interests');
      expect(response.body[0].userProfile).toHaveProperty('sectorOccupations');
      expect(response.body[0].userProfile).toHaveProperty('nudges');
    });

    it('should be able to limit public profiles', async () => {
      const response: APIResponse<
        PublicProfilesController['getPublicProfiles']
      > = await request(server)
        .get(`/users/public-profiles`)
        .query({ limit: 2 });
      expect(response.status).toBe(200);
      expect(response.body.length).toBe(2);
    });

    it('should be able to paginate public profiles', async () => {
      const response: APIResponse<
        PublicProfilesController['getPublicProfiles']
      > = await request(server)
        .get(`/users/public-profiles`)
        .query({ limit: 1, offset: 1 });
      expect(response.status).toBe(200);
      expect(response.body.length).toBe(1);
      expect(response.body[0].id).toBeDefined();
    });
  });

  describe('GET /users/public-profiles/:id', () => {
    it('should return a public profile by ID', async () => {
      const user = userCandidates[0];
      const response: APIResponse<
        PublicProfilesController['getPublicProfileByCandidateId']
      > = await request(server).get(`/users/public-profiles/${user.id}`);
      expect(response.status).toBe(200);
      expect(response.body.firstName).toBe(user.firstName);
      expect(response.body.lastName).toBe(user.lastName);
    });

    it('should return 404 if public profile not found', async () => {
      const response: APIResponse<
        PublicProfilesController['getPublicProfileByCandidateId']
      > = await request(server).get(
        `/users/public-profiles/fdeb3d5e-8f3b-4dde-89be-277b233f7f30` // non-existing ID
      );
      expect(response.status).toBe(404);
    });
  });
});
