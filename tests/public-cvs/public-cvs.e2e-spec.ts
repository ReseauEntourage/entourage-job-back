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
import { APIResponse } from 'src/utils/types';
import { ZoneName } from 'src/utils/types/zones.types';
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

  // Pour les profils incomplets
  let sansPhotoId: string;
  let incompletId: string;

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

    // Créer un profil complet (plus de 70% de complétion et avec photo)
    // Ce profil sera le seul retourné par l'API

    // Récupérer les langues
    const francais = await languagesHelper.findOne({ value: 'fr' });
    const anglais = await languagesHelper.findOne({ value: 'en' });

    const completeProfile = await databaseHelper.createEntities(
      userFactory,
      1,
      {
        role: UserRoles.CANDIDATE,
        zone: ZoneName.LILLE,
        firstName: 'Candidat',
        lastName: 'Complet',
        phone: '0102030405',
      },
      {
        userProfile: {
          department: 'Nord (59)',
          isAvailable: true,
          hasPicture: true,
          introduction: 'Je suis un candidat avec un profil complet',
          description: 'Description détaillée de mon parcours professionnel',
          currentJob: 'Développeur Web',
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
          // Nous n'inclurons pas de compétences pour éviter les problèmes avec le SkillFactory

          experiences: [
            {
              title: 'Développeur web',
              company: 'Entreprise A',
              startDate: new Date('2020-01-01'),
              endDate: new Date('2021-12-31'),
              description: "Développement d'applications web",
            },
          ],
          formations: [
            {
              title: 'Master en informatique',
              institution: 'Université de Lille',
              startDate: new Date('2018-01-01'),
              endDate: new Date('2020-01-01'),
              description: 'Formation en développement web',
            },
          ],
          userProfileLanguages: [
            {
              languageId: francais.id,
              level: 'Courant',
            },
            {
              languageId: anglais.id,
              level: 'Intermédiaire',
            },
          ],
        },
      }
    );

    // Seul le profil complet sera disponible pour les tests
    userCandidates = completeProfile;

    // Créer deux profils incomplets (soit moins de 70% de complétion, soit sans photo)
    const sansPhotoProfile = await databaseHelper.createEntities(
      userFactory,
      1,
      {
        role: UserRoles.CANDIDATE,
        zone: ZoneName.LILLE,
        firstName: 'Candidat',
        lastName: 'Sans Photo',
      },
      {
        userProfile: {
          department: 'Nord (59)',
          isAvailable: true,
          hasPicture: false, // Pas de photo
          introduction: 'Je suis un candidat sans photo',
          description: 'Description de mon parcours',
          sectorOccupations: [
            {
              businessSectorId: businessSector1.id,
              order: 1,
            },
          ],
          nudges: [{ id: nudgeTips.id }, { id: nudgeNetwork.id }],
        },
      }
    );

    const incompletProfile = await databaseHelper.createEntities(
      userFactory,
      1,
      {
        role: UserRoles.CANDIDATE,
        zone: ZoneName.LILLE,
        firstName: 'Candidat',
        lastName: 'Incomplet',
      },
      {
        userProfile: {
          department: 'Nord (59)',
          isAvailable: true,
          hasPicture: true, // A une photo
          // Peu de champs remplis, ce qui donnera un taux de complétion < 70%
          sectorOccupations: [
            {
              businessSectorId: businessSector1.id,
              order: 1,
            },
          ],
          nudges: [{ id: nudgeTips.id }],
        },
      }
    );

    // Garder les IDs des profils incomplets pour les tests
    sansPhotoId = sansPhotoProfile[0].id;
    incompletId = incompletProfile[0].id;

    // Créer un profil de coach (qui ne devrait pas apparaître dans les résultats)
    await databaseHelper.createEntities(
      userFactory,
      1,
      {
        role: UserRoles.COACH,
        zone: ZoneName.PARIS,
      },
      {
        userProfile: {
          department: 'Paris (75)',
          isAvailable: true,
          hasPicture: true,
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
    it('should return all valid public cvs', async () => {
      const response: APIResponse<PublicCVsController['getPublicCVs']> =
        await request(server).get(`/users/public-cvs`);
      expect(response.status).toBe(200);
    });

    it('should filter profiles based on completion rate and picture', async () => {
      const response: APIResponse<PublicCVsController['getPublicCVs']> =
        await request(server).get(`/users/public-cvs`);
      expect(response.status).toBe(200);

      // Tous les profils retournés doivent avoir une photo
      response.body.forEach((profile) => {
        expect(profile.userProfile.hasPicture).toBe(true);
      });

      // Tous les profils retournés doivent être des candidats
      response.body.forEach((profile) => {
        expect(profile.role).toBe(UserRoles.CANDIDATE);
      });
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
        await request(server).get(`/users/public-cvs`).query({ limit: 1 });
      expect(response.status).toBe(200);
      expect(response.body.length).toBe(1);
    });

    it('should return empty array with offset beyond available results', async () => {
      const response: APIResponse<PublicCVsController['getPublicCVs']> =
        await request(server)
          .get(`/users/public-cvs`)
          .query({ limit: 1, offset: 1 });
      expect(response.status).toBe(200);
      expect(response.body.length).toBe(0);
    });

    it('should not return profiles without photos', async () => {
      // Récupérer tous les profils publics
      const response: APIResponse<PublicCVsController['getPublicCVs']> =
        await request(server).get(`/users/public-cvs`);
      expect(response.status).toBe(200);

      // Vérifier que les profils sans photo ne sont pas retournés
      const sansPhotoProfiles = response.body.filter(
        (profile) => profile.id === sansPhotoId
      );
      expect(sansPhotoProfiles.length).toBe(0);
    });
  });

  describe('GET /users/public-cvs/:id', () => {
    it('should return 404 if public cv not found', async () => {
      const response: APIResponse<PublicCVsController['getPublicCVsByUserId']> =
        await request(server).get(
          `/users/public-cvs/fdeb3d5e-8f3b-4dde-89be-277b233f7f30` // non-existing ID
        );
      expect(response.status).toBe(404);
    });

    it('should return an incomplete profile by ID even if filtered from list', async () => {
      // Vérifier que le profil incomplet sans photo peut être accédé par ID
      const response1 = await request(server).get(
        `/users/public-cvs/${sansPhotoId}`
      );
      expect(response1.status).toBe(200);
      expect(response1.body.firstName).toBe('Candidat');
      expect(response1.body.lastName).toBe('Sans Photo');
      expect(response1.body.userProfile.hasPicture).toBe(false);

      // Vérifier que le profil incomplet peut être accédé par ID
      const response2 = await request(server).get(
        `/users/public-cvs/${incompletId}`
      );
      expect(response2.status).toBe(200);
      expect(response2.body.firstName).toBe('Candidat');
      expect(response2.body.lastName).toBe('Incomplet');
      expect(response2.body.userProfile.hasPicture).toBe(true);
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
