/* eslint-disable no-console */
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';
import request from 'supertest';
import { QueueMocks, S3Mocks } from '../mocks.types';
import { BusinessSector } from 'src/business-sectors/models';
import { S3Service } from 'src/external-services/aws/s3.service';
import { Nudge } from 'src/nudge/models';
import { QueuesService } from 'src/queues/producers/queues.service';
import { UserRoles } from 'src/users/users.types';
import { UsersCreationController } from 'src/users-creation/users-creation.controller';
import { APIResponse } from 'src/utils/types';
import { BusinessSectorHelper } from 'tests/business-sectors/business-sector.helper';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import { NudgesHelper } from 'tests/nudges/nudges.helper';
import { QueuesServiceMock } from 'tests/queues/queues.service.mock';
import { UserFactory } from 'tests/users/user.factory';

describe('UsersCreation - GET /user/registration/compatible-profiles', () => {
  let app: INestApplication;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let server: any;

  let databaseHelper: DatabaseHelper;
  let userFactory: UserFactory;
  let businessSectorsHelper: BusinessSectorHelper;
  let nudgesHelper: NudgesHelper;
  let throttlerStorage: ThrottlerStorageService;

  let businessSector1: BusinessSector;
  let businessSector2: BusinessSector;
  let nudgeCv: Nudge;
  let nudgeTips: Nudge;
  let nudgeNetwork: Nudge;

  const route = '/user/registration/compatible-profiles';

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
    server = app.getHttpServer();

    databaseHelper = moduleFixture.get<DatabaseHelper>(DatabaseHelper);
    businessSectorsHelper =
      moduleFixture.get<BusinessSectorHelper>(BusinessSectorHelper);
    nudgesHelper = moduleFixture.get<NudgesHelper>(NudgesHelper);
    userFactory = moduleFixture.get<UserFactory>(UserFactory);
    throttlerStorage =
      moduleFixture.get<ThrottlerStorageService>(ThrottlerStorage);
  });

  beforeAll(async () => {
    // Reset the test database
    await databaseHelper.resetTestDB();

    // Initialize the business sectors
    await businessSectorsHelper.deleteAllBusinessSectors();
    await businessSectorsHelper.seedBusinessSectors();

    businessSector1 = await businessSectorsHelper.findOne({
      name: 'Sector 1',
    });
    businessSector2 = await businessSectorsHelper.findOne({
      name: 'Sector 2',
    });

    // Initialize the nudges
    await nudgesHelper.deleteAllNudges();
    await nudgesHelper.seedNudges();

    nudgeCv = await nudgesHelper.findOne({ value: 'cv' });
    nudgeTips = await nudgesHelper.findOne({ value: 'tips' });
    nudgeNetwork = await nudgesHelper.findOne({ value: 'network' });
  });

  afterAll(async () => {
    // Réinitialisation de la base de données pour ne pas polluer les suites suivantes
    await databaseHelper.resetTestDB();

    // Fermeture de l'application NestJS
    await app.close();

    // Fermeture du serveur HTTP avec une Promise
    await new Promise<void>((resolve) => {
      server.close(() => {
        console.log('Serveur HTTP fermé');
        resolve();
      });
    });

    // Fermeture des files d'attente
    if (QueueMocks.close) {
      await QueueMocks.close();
      console.log("Files d'attente fermées");
    }

    console.log('Toutes les connexions ont été fermées');
  });

  beforeEach(async () => {
    // Reset rate limiting between tests so the throttle quota applies per test, not per file
    throttlerStorage.storage.clear();
    try {
      await databaseHelper.resetTestDB();
    } catch (error) {
      console.error(
        'Erreur lors de la réinitialisation de la base de données:',
        error
      );
      throw error;
    }
  });

  const getCompatibleProfiles = (
    query: string
  ): Promise<
    APIResponse<UsersCreationController['getPreRegistrationCompatibleProfiles']>
  > => request(server).get(`${route}?${query}`);

  describe('Validation', () => {
    it('Should return 400 when role is missing', async () => {
      const response = await getCompatibleProfiles('');
      expect(response.status).toBe(400);
    });

    it('Should return 400 when role is invalid', async () => {
      const response = await getCompatibleProfiles('role=NotARole');
      expect(response.status).toBe(400);
    });

    it('Should return 200 without any authentication (public route)', async () => {
      const response = await getCompatibleProfiles(
        `role=${UserRoles.CANDIDATE}`
      );
      expect(response.status).toBe(200);
    });
  });

  describe('When no nudges or businessSectors filters are provided', () => {
    it('Should return only available profiles of the opposite role', async () => {
      const availableCoaches = await databaseHelper.createEntities(
        userFactory,
        3,
        { role: UserRoles.COACH },
        { userProfile: { unavailableAt: null } }
      );
      await databaseHelper.createEntities(
        userFactory,
        1,
        { role: UserRoles.COACH },
        { userProfile: { unavailableAt: new Date() } }
      );
      await databaseHelper.createEntities(
        userFactory,
        2,
        { role: UserRoles.CANDIDATE },
        { userProfile: { unavailableAt: null } }
      );

      const response = await getCompatibleProfiles(
        `role=${UserRoles.CANDIDATE}`
      );

      expect(response.status).toBe(200);
      expect(response.body.count).toBe(3);
      expect(response.body.broadened).toBe(false);
      expect(response.body.profiles.length).toBe(3);
      expect(
        response.body.profiles.every((profile) =>
          availableCoaches.some((coach) => coach.id === profile.id)
        )
      ).toBe(true);
    });

    it('Should return only available profiles of the opposite role, inverted', async () => {
      const availableCandidates = await databaseHelper.createEntities(
        userFactory,
        2,
        { role: UserRoles.CANDIDATE },
        { userProfile: { unavailableAt: null } }
      );
      await databaseHelper.createEntities(
        userFactory,
        2,
        { role: UserRoles.COACH },
        { userProfile: { unavailableAt: null } }
      );

      const response = await getCompatibleProfiles(`role=${UserRoles.COACH}`);

      expect(response.status).toBe(200);
      expect(response.body.count).toBe(2);
      expect(
        response.body.profiles.every((profile) =>
          availableCandidates.some((candidate) => candidate.id === profile.id)
        )
      ).toBe(true);
    });

    it('Should never return more than 6 profiles, but should report the real total count', async () => {
      await databaseHelper.createEntities(
        userFactory,
        8,
        { role: UserRoles.COACH },
        { userProfile: { unavailableAt: null } }
      );

      const response = await getCompatibleProfiles(
        `role=${UserRoles.CANDIDATE}`
      );

      expect(response.status).toBe(200);
      expect(response.body.count).toBe(8);
      expect(response.body.profiles.length).toBe(6);
    });

    it('Should return an empty result when there is no available profile of the opposite role', async () => {
      await databaseHelper.createEntities(
        userFactory,
        2,
        { role: UserRoles.COACH },
        { userProfile: { unavailableAt: new Date() } }
      );

      const response = await getCompatibleProfiles(
        `role=${UserRoles.CANDIDATE}`
      );

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        count: 0,
        profiles: [],
        broadened: false,
      });
    });

    it('Should return profiles without leaking sensitive user fields', async () => {
      await databaseHelper.createEntities(
        userFactory,
        1,
        { role: UserRoles.COACH },
        { userProfile: { unavailableAt: null } }
      );

      const response = await getCompatibleProfiles(
        `role=${UserRoles.CANDIDATE}`
      );

      expect(response.status).toBe(200);
      const [profile] = response.body.profiles;
      expect(profile).toHaveProperty('averageDelayResponse');
      expect(profile).not.toHaveProperty('email');
      expect(profile).not.toHaveProperty('password');
    });
  });

  describe('When filtering by nudges only', () => {
    it('Should only return profiles matching at least one of the requested nudges', async () => {
      const [matchingCoach] = await databaseHelper.createEntities(
        userFactory,
        1,
        { role: UserRoles.COACH },
        { userProfile: { nudges: [{ id: nudgeCv.id }] } }
      );
      await databaseHelper.createEntities(
        userFactory,
        2,
        { role: UserRoles.COACH },
        { userProfile: { nudges: [{ id: nudgeTips.id }] } }
      );

      const response = await getCompatibleProfiles(
        `role=${UserRoles.CANDIDATE}&nudgeIds=${nudgeCv.id}`
      );

      expect(response.status).toBe(200);
      expect(response.body.count).toBe(1);
      expect(response.body.profiles.map(({ id }) => id)).toEqual([
        matchingCoach.id,
      ]);
    });

    it('Should not return duplicate profiles when a profile matches several of the requested nudges', async () => {
      const [matchingCoach] = await databaseHelper.createEntities(
        userFactory,
        1,
        { role: UserRoles.COACH },
        {
          userProfile: {
            nudges: [{ id: nudgeCv.id }, { id: nudgeNetwork.id }],
          },
        }
      );

      const response = await getCompatibleProfiles(
        `role=${UserRoles.CANDIDATE}&nudgeIds=${nudgeCv.id}&nudgeIds=${nudgeNetwork.id}`
      );

      expect(response.status).toBe(200);
      expect(response.body.count).toBe(1);
      expect(response.body.profiles.length).toBe(1);
      expect(response.body.profiles[0].id).toBe(matchingCoach.id);
    });

    it('Should accept a single nudgeId sent without array brackets', async () => {
      const [matchingCoach] = await databaseHelper.createEntities(
        userFactory,
        1,
        { role: UserRoles.COACH },
        { userProfile: { nudges: [{ id: nudgeCv.id }] } }
      );

      const response = await getCompatibleProfiles(
        `role=${UserRoles.CANDIDATE}&nudgeIds=${nudgeCv.id}`
      );

      expect(response.status).toBe(200);
      expect(response.body.count).toBe(1);
      expect(response.body.profiles[0].id).toBe(matchingCoach.id);
    });

    it('Should return an empty result when no profile matches the requested nudges', async () => {
      await databaseHelper.createEntities(
        userFactory,
        2,
        { role: UserRoles.COACH },
        { userProfile: { nudges: [{ id: nudgeTips.id }] } }
      );

      const response = await getCompatibleProfiles(
        `role=${UserRoles.CANDIDATE}&nudgeIds=${nudgeCv.id}`
      );

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        count: 0,
        profiles: [],
        broadened: false,
      });
    });
  });

  describe('When filtering by businessSectors only', () => {
    it('Should only return profiles matching at least one of the requested businessSectors', async () => {
      const [matchingCoach] = await databaseHelper.createEntities(
        userFactory,
        1,
        { role: UserRoles.COACH },
        {
          userProfile: {
            sectorOccupations: [{ businessSectorId: businessSector1.id }],
          },
        }
      );
      await databaseHelper.createEntities(
        userFactory,
        2,
        { role: UserRoles.COACH },
        {
          userProfile: {
            sectorOccupations: [{ businessSectorId: businessSector2.id }],
          },
        }
      );

      const response = await getCompatibleProfiles(
        `role=${UserRoles.CANDIDATE}&businessSectorIds=${businessSector1.id}`
      );

      expect(response.status).toBe(200);
      expect(response.body.count).toBe(1);
      expect(response.body.profiles.map(({ id }) => id)).toEqual([
        matchingCoach.id,
      ]);
    });

    it('Should not return duplicate profiles when a profile matches several of the requested businessSectors', async () => {
      const [matchingCoach] = await databaseHelper.createEntities(
        userFactory,
        1,
        { role: UserRoles.COACH },
        {
          userProfile: {
            sectorOccupations: [
              { businessSectorId: businessSector1.id },
              { businessSectorId: businessSector2.id },
            ],
          },
        }
      );

      const response = await getCompatibleProfiles(
        `role=${UserRoles.CANDIDATE}&businessSectorIds=${businessSector1.id}&businessSectorIds=${businessSector2.id}`
      );

      expect(response.status).toBe(200);
      expect(response.body.count).toBe(1);
      expect(response.body.profiles.length).toBe(1);
      expect(response.body.profiles[0].id).toBe(matchingCoach.id);
    });
  });

  describe('When filtering by nudges AND businessSectors', () => {
    it('Should only return profiles matching at least one nudge AND at least one businessSector', async () => {
      const [bothMatch] = await databaseHelper.createEntities(
        userFactory,
        1,
        { role: UserRoles.COACH },
        {
          userProfile: {
            nudges: [{ id: nudgeCv.id }],
            sectorOccupations: [{ businessSectorId: businessSector1.id }],
          },
        }
      );
      // Matches the nudge only
      await databaseHelper.createEntities(
        userFactory,
        1,
        { role: UserRoles.COACH },
        {
          userProfile: {
            nudges: [{ id: nudgeCv.id }],
            sectorOccupations: [{ businessSectorId: businessSector2.id }],
          },
        }
      );
      // Matches the businessSector only
      await databaseHelper.createEntities(
        userFactory,
        1,
        { role: UserRoles.COACH },
        {
          userProfile: {
            nudges: [{ id: nudgeTips.id }],
            sectorOccupations: [{ businessSectorId: businessSector1.id }],
          },
        }
      );

      const response = await getCompatibleProfiles(
        `role=${UserRoles.CANDIDATE}&nudgeIds=${nudgeCv.id}&businessSectorIds=${businessSector1.id}`
      );

      expect(response.status).toBe(200);
      expect(response.body.broadened).toBe(false);
      expect(response.body.count).toBe(1);
      expect(response.body.profiles.map(({ id }) => id)).toEqual([
        bothMatch.id,
      ]);
    });

    it('Should broaden to businessSector-only matches when no profile matches both criteria', async () => {
      const [sectorOnlyMatch] = await databaseHelper.createEntities(
        userFactory,
        1,
        { role: UserRoles.COACH },
        {
          userProfile: {
            nudges: [{ id: nudgeTips.id }],
            sectorOccupations: [{ businessSectorId: businessSector1.id }],
          },
        }
      );

      const response = await getCompatibleProfiles(
        `role=${UserRoles.CANDIDATE}&nudgeIds=${nudgeCv.id}&businessSectorIds=${businessSector1.id}`
      );

      expect(response.status).toBe(200);
      expect(response.body.broadened).toBe(true);
      expect(response.body.count).toBe(1);
      expect(response.body.profiles.map(({ id }) => id)).toEqual([
        sectorOnlyMatch.id,
      ]);
    });

    it('Should return an empty result when there is no match, even broadened', async () => {
      await databaseHelper.createEntities(
        userFactory,
        1,
        { role: UserRoles.COACH },
        {
          userProfile: {
            nudges: [{ id: nudgeTips.id }],
            sectorOccupations: [{ businessSectorId: businessSector2.id }],
          },
        }
      );

      const response = await getCompatibleProfiles(
        `role=${UserRoles.CANDIDATE}&nudgeIds=${nudgeCv.id}&businessSectorIds=${businessSector1.id}`
      );

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        count: 0,
        profiles: [],
        broadened: false,
      });
    });
  });
});
