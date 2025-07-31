import { Server } from 'http';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { BusinessSector } from 'src/common/business-sectors/models';
import { Nudge } from 'src/common/nudge/models';
import { PublicCVsController } from 'src/public-cv/public-cvs.controller';
import { QueuesService } from 'src/queues/producers/queues.service';
import { User } from 'src/users/models';
import { UserRoles } from 'src/users/users.types';
import { AdminZones, APIResponse } from 'src/utils/types';
import { BusinessSectorHelper } from 'tests/business-sectors/business-sector.helper';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import { LanguageHelper } from 'tests/languages/language.helper';
import { NudgesHelper } from 'tests/nudges/nudges.helper';
import { QueuesServiceMock } from 'tests/queues/queues.service.mock';
import { UserFactory } from 'tests/users/user.factory';

describe('PublicCVs', () => {
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
      .overrideProvider(QueuesService)
      .useClass(QueuesServiceMock)
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

  describe('GET /users/public-cvs', () => {
    it('should return all public cvs', async () => {
      const response: APIResponse<PublicCVsController['getPublicCVs']> =
        await request(server).get(`/users/public-cvs`);
      expect(response.status).toBe(200);
    });

    it('should return only candidate public cvs', async () => {
      const response: APIResponse<PublicCVsController['getPublicCVs']> =
        await request(server).get(`/users/public-cvs`);
      expect(response.status).toBe(200);
      expect(response.body.length).toBe(3);
      expect(
        response.body.every((profile) => profile.role === UserRoles.CANDIDATE)
      ).toBe(true);
    });

    it('should return public cvs with correct fields', async () => {
      const response: APIResponse<PublicCVsController['getPublicCVs']> =
        await request(server).get(`/users/public-cvs`);
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
      expect(response.body[0].userProfile).toHaveProperty('sectorOccupations');
      expect(response.body[0].userProfile).toHaveProperty('nudges');
    });

    it('should be able to limit public cvs', async () => {
      const response: APIResponse<PublicCVsController['getPublicCVs']> =
        await request(server).get(`/users/public-cvs`).query({ limit: 2 });
      expect(response.status).toBe(200);
      expect(response.body.length).toBe(2);
    });

    it('should be able to paginate public cvs', async () => {
      const response: APIResponse<PublicCVsController['getPublicCVs']> =
        await request(server)
          .get(`/users/public-cvs`)
          .query({ limit: 1, offset: 1 });
      expect(response.status).toBe(200);
      expect(response.body.length).toBe(1);
      expect(response.body[0].id).toBeDefined();
    });
  });

  describe('GET /users/public-cvs/:id', () => {
    it('should return a public cv by ID', async () => {
      const user = userCandidates[0];
      const response: APIResponse<PublicCVsController['getPublicCVsByUserId']> =
        await request(server).get(`/users/public-cvs/${user.id}`);
      expect(response.status).toBe(200);
      expect(response.body.firstName).toBe(user.firstName);
      expect(response.body.lastName).toBe(user.lastName);
      expect(response.body.role).toBe(user.role);
      expect(response.body.id).toBe(user.id);
      expect(response.body.userProfile).toBeDefined();
      expect(response.body.userProfile.department).toBe(
        user.userProfile.department
      );
      expect(response.body.userProfile.description).toBe(
        user.userProfile.description
      );
      expect(response.body.userProfile.introduction).toBe(
        user.userProfile.introduction
      );
      expect(response.body.userProfile.linkedinUrl).toBe(
        user.userProfile.linkedinUrl
      );
      expect(response.body.userProfile.sectorOccupations).toBeDefined();
      expect(response.body.userProfile.sectorOccupations.length).toBe(2);
      expect(
        response.body.userProfile.sectorOccupations[0].businessSector
      ).toBeDefined();
      expect(
        response.body.userProfile.sectorOccupations[0].businessSector.id
      ).toBe(businessSector1.id);
      expect(
        response.body.userProfile.sectorOccupations[1].businessSector
      ).toBeDefined();
      expect(
        response.body.userProfile.sectorOccupations[1].businessSector.id
      ).toBe(businessSector2.id);
      expect(response.body.userProfile.nudges).toBeDefined();
      expect(response.body.userProfile.nudges.length).toBe(3);
      expect(response.body.userProfile.nudges[0].id).toBe(nudgeTips.id);
      expect(response.body.userProfile.nudges[1].id).toBe(nudgeInterview.id);
      expect(response.body.userProfile.nudges[2].id).toBe(nudgeNetwork.id);
      expect(response.body.userProfile.experiences).toBeDefined();
      expect(response.body.userProfile.experiences.length).toBe(0);
      expect(response.body.userProfile.formations).toBeDefined();
      expect(response.body.userProfile.formations.length).toBe(0);
      expect(response.body.userProfile.skills).toBeDefined();
      expect(response.body.userProfile.skills.length).toBe(0);
      expect(response.body.userProfile.contracts).toBeDefined();
      expect(response.body.userProfile.contracts.length).toBe(0);
      expect(response.body.userProfile.reviews).toBeDefined();
      expect(response.body.userProfile.reviews.length).toBe(0);
      expect(response.body.userProfile.interests).toBeDefined();
      expect(response.body.userProfile.interests.length).toBe(0);
    });

    it('should return 404 if public cv not found', async () => {
      const response: APIResponse<PublicCVsController['getPublicCVsByUserId']> =
        await request(server).get(
          `/users/public-cvs/fdeb3d5e-8f3b-4dde-89be-277b233f7f30` // non-existing ID
        );
      expect(response.status).toBe(404);
    });

    it('should return public cv with correct fields', async () => {
      const user = userCandidates[0];
      const response: APIResponse<PublicCVsController['getPublicCVsByUserId']> =
        await request(server).get(`/users/public-cvs/${user.id}`);
      expect(response.status).toBe(200);
      // Direct Attributes
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('firstName');
      expect(response.body).toHaveProperty('lastName');
      expect(response.body).toHaveProperty('role');

      // Direct Relationships
      // expect(response.body.candidat).toBeDefined();
      expect(response.body.userProfile).toBeDefined();

      // User Profile Attributes
      expect(response.body.userProfile).toHaveProperty('department');
      expect(response.body.userProfile).toHaveProperty('description');
      expect(response.body.userProfile).toHaveProperty('introduction');
      expect(response.body.userProfile).toHaveProperty('linkedinUrl');
      expect(response.body.userProfile).toHaveProperty('userProfileLanguages');
      expect(response.body.userProfile).toHaveProperty('contracts');
      expect(response.body.userProfile).toHaveProperty('skills');
      expect(response.body.userProfile).toHaveProperty('experiences');
      expect(response.body.userProfile).toHaveProperty('formations');
      expect(response.body.userProfile).toHaveProperty('reviews');
      expect(response.body.userProfile).toHaveProperty('interests');
      expect(response.body.userProfile).toHaveProperty('sectorOccupations');
    });
  });
});
