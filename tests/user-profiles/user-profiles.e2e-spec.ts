/* eslint-disable no-console */
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import moment from 'moment';
import request from 'supertest';
import { QueueMocks, S3Mocks } from '../mocks.types';
import { UserProfilesHelper } from '../user-profiles/user-profiles.helper';
import { LoggedUser } from 'src/auth/auth.types';
import { BusinessSector } from 'src/common/business-sectors/models';
import { Contract } from 'src/common/contracts/models';
import { Language } from 'src/common/languages/models';
import { Nudge } from 'src/common/nudge/models';
import { S3Service } from 'src/external-services/aws/s3.service';
import { QueuesService } from 'src/queues/producers/queues.service';
import {
  UserProfile,
  UserProfileWithPartialAssociations,
} from 'src/user-profiles/models';
import { UserProfilesController } from 'src/user-profiles/user-profiles.controller';
import { User } from 'src/users/models';
import { UserRoles } from 'src/users/users.types';
import { AdminZones, APIResponse } from 'src/utils/types';
import { BusinessSectorHelper } from 'tests/business-sectors/business-sector.helper';
import { ExperienceFactory } from 'tests/common/experiences/experience.factory';
import { FormationFactory } from 'tests/common/formations/formation.factory';
import { SkillFactory } from 'tests/common/skills/skill.factory';
import { ContractHelper } from 'tests/contracts/contract.helper';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import { LanguageHelper } from 'tests/languages/language.helper';
import { InternalMessageFactory } from 'tests/messages/internal-message.factory';
import { NudgesHelper } from 'tests/nudges/nudges.helper';
import { QueuesServiceMock } from 'tests/queues/queues.service.mock';
import { UserCandidatsHelper } from 'tests/users/user-candidats.helper';
import { UserFactory } from 'tests/users/user.factory';
import { UsersHelper } from 'tests/users/users.helper';

describe('UserProfiles', () => {
  let app: INestApplication;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let server: any;

  let databaseHelper: DatabaseHelper;
  let userFactory: UserFactory;
  let usersHelper: UsersHelper;
  let experienceFactory: ExperienceFactory;
  let formationFactory: FormationFactory;
  let skillFactory: SkillFactory;
  let userCandidatsHelper: UserCandidatsHelper;
  let userProfilesHelper: UserProfilesHelper;
  let internalMessageFactory: InternalMessageFactory;
  let businessSectorsHelper: BusinessSectorHelper;
  let nudgesHelper: NudgesHelper;
  let contractHelper: ContractHelper;
  let languageHelper: LanguageHelper;

  let businessSector1: BusinessSector;
  let businessSector2: BusinessSector;
  let businessSector3: BusinessSector;
  let businessSector4: BusinessSector;
  let businessSector5: BusinessSector;
  let businessSector6: BusinessSector;

  let nudgeCv: Nudge;
  let nudgeTips: Nudge;
  let nudgeNetwork: Nudge;
  let nudgeInterview: Nudge;
  let nudgeEvent: Nudge;

  let contractCdi: Contract;
  let contractCdd: Contract;

  let languageFrench: Language;
  let languageEnglish: Language;

  const route = '/user';

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
    usersHelper = moduleFixture.get<UsersHelper>(UsersHelper);
    userCandidatsHelper =
      moduleFixture.get<UserCandidatsHelper>(UserCandidatsHelper);
    userProfilesHelper =
      moduleFixture.get<UserProfilesHelper>(UserProfilesHelper);
    businessSectorsHelper =
      moduleFixture.get<BusinessSectorHelper>(BusinessSectorHelper);
    nudgesHelper = moduleFixture.get<NudgesHelper>(NudgesHelper);
    contractHelper = moduleFixture.get<ContractHelper>(ContractHelper);
    languageHelper = moduleFixture.get<LanguageHelper>(LanguageHelper);
    userFactory = moduleFixture.get<UserFactory>(UserFactory);
    internalMessageFactory = moduleFixture.get<InternalMessageFactory>(
      InternalMessageFactory
    );
    experienceFactory = moduleFixture.get<ExperienceFactory>(ExperienceFactory);
    formationFactory = moduleFixture.get<FormationFactory>(FormationFactory);
    skillFactory = moduleFixture.get<SkillFactory>(SkillFactory);
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
    businessSector3 = await businessSectorsHelper.findOne({
      name: 'Sector 3',
    });
    businessSector4 = await businessSectorsHelper.findOne({
      name: 'Sector 4',
    });
    businessSector5 = await businessSectorsHelper.findOne({
      name: 'Sector 5',
    });
    businessSector6 = await businessSectorsHelper.findOne({
      name: 'Sector 6',
    });

    // Intialize the nudges
    await nudgesHelper.deleteAllNudges();
    await nudgesHelper.seedNudges();

    nudgeCv = await nudgesHelper.findOne({ value: 'cv' });
    nudgeTips = await nudgesHelper.findOne({ value: 'tips' });
    nudgeNetwork = await nudgesHelper.findOne({ value: 'network' });
    nudgeInterview = await nudgesHelper.findOne({ value: 'interview' });
    nudgeEvent = await nudgesHelper.findOne({ value: 'event' });

    // Initialize the contracts
    await contractHelper.deleteAllContracts();
    await contractHelper.seedContracts();

    contractCdi = await contractHelper.findOne({
      name: 'CDI',
    });
    contractCdd = await contractHelper.findOne({
      name: 'CDD',
    });

    // Initialize the languages
    await languageHelper.deleteAllLanguages();
    await languageHelper.seedLanguages();

    languageFrench = await languageHelper.findOne({
      value: 'fr',
    });
    languageEnglish = await languageHelper.findOne({
      value: 'en',
    });
  });

  afterAll(async () => {
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

  describe('UserProfiles General Tests', () => {
    describe('READ', () => {
      describe('GET /user/profile', () => {
        describe('/profile?limit=&offset= - Read all profiles', () => {
          it('Should return 401 if user is not logged in', async () => {
            const response: APIResponse<UserProfilesController['findAll']> =
              await request(server).get(
                `${route}/profile?offset=0&limit=25&role[]=${UserRoles.CANDIDATE}`
              );
            expect(response.status).toBe(401);
          });
          it('Should return 400 if no role parameter', async () => {
            const loggedInCandidate = await usersHelper.createLoggedInUser({
              role: UserRoles.CANDIDATE,
            });
            const response: APIResponse<UserProfilesController['findAll']> =
              await request(server)
                .get(`${route}/profile`)
                .set('authorization', `Bearer ${loggedInCandidate.token}`);
            expect(response.status).toBe(400);
          });
          it('Should return 200 if user is logged in as admin', async () => {
            const loggedInAdmin = await usersHelper.createLoggedInUser({
              role: UserRoles.ADMIN,
            });
            const response: APIResponse<UserProfilesController['findAll']> =
              await request(server)
                .get(
                  `${route}/profile?offset=0&limit=25&role[]=${UserRoles.CANDIDATE}`
                )
                .set('authorization', `Bearer ${loggedInAdmin.token}`);
            expect(response.status).toBe(200);
          });
          it('Should return 200 if user is logged in as candidate', async () => {
            const loggedInCandidate = await usersHelper.createLoggedInUser({
              role: UserRoles.CANDIDATE,
            });
            const response: APIResponse<UserProfilesController['findAll']> =
              await request(server)
                .get(
                  `${route}/profile?offset=0&limit=25&role[]=${UserRoles.CANDIDATE}`
                )
                .set('authorization', `Bearer ${loggedInCandidate.token}`);
            expect(response.status).toBe(200);
          });
          it('Should return 200 if user is logged in as coach', async () => {
            const loggedInCoach = await usersHelper.createLoggedInUser({
              role: UserRoles.COACH,
            });
            const response: APIResponse<UserProfilesController['findAll']> =
              await request(server)
                .get(
                  `${route}/profile?offset=0&limit=25&role[]=${UserRoles.CANDIDATE}`
                )
                .set('authorization', `Bearer ${loggedInCoach.token}`);
            expect(response.status).toBe(200);
          });
          it('Should return 200 if user is logged in as referer', async () => {
            const loggedInReferer = await usersHelper.createLoggedInUser({
              role: UserRoles.REFERER,
            });
            const response: APIResponse<UserProfilesController['findAll']> =
              await request(server)
                .get(
                  `${route}/profile?offset=0&limit=25&role[]=${UserRoles.CANDIDATE}`
                )
                .set('authorization', `Bearer ${loggedInReferer.token}`);
            expect(response.status).toBe(200);
          });
          it('Should return 400 if no offset or limit parameter', async () => {
            const loggedInCandidate = await usersHelper.createLoggedInUser({
              role: UserRoles.CANDIDATE,
            });
            const response: APIResponse<UserProfilesController['findAll']> =
              await request(server)
                .get(`${route}/profile?role[]=${UserRoles.CANDIDATE}`)
                .set('authorization', `Bearer ${loggedInCandidate.token}`);
            expect(response.status).toBe(400);
          });
          it('Should return 400 if no role parameter', async () => {
            const loggedInCandidate = await usersHelper.createLoggedInUser({
              role: UserRoles.CANDIDATE,
            });
            const response: APIResponse<UserProfilesController['findAll']> =
              await request(server)
                .get(`${route}/profile?offset=0&limit=25`)
                .set('authorization', `Bearer ${loggedInCandidate.token}`);
            expect(response.status).toBe(400);
          });
        });
        describe('/profile?limit=&offset=&role[]= - Get paginated and creation date sorted users filtered by role', () => {
          let loggedInCandidate: LoggedUser;

          let secondCreatedCandidate: User;
          let thirdCreatedCandidate: User;
          let fourthCreatedCandidate: User;
          let fifthCreatedCandidate: User;

          let secondCreatedCoach: User;
          let thirdCreatedCoach: User;
          let fourthCreatedCoach: User;
          let fifthCreatedCoach: User;

          beforeEach(async () => {
            loggedInCandidate = await usersHelper.createLoggedInUser({
              role: UserRoles.CANDIDATE,
              lastConnection: moment().subtract(15, 'day').toDate(),
            });

            const userProfileCandidate: UserProfileWithPartialAssociations = {
              sectorOccupations: [
                {
                  businessSectorId: businessSector1.id,
                  occupation: { name: 'menuisier' },
                },
              ],
              nudges: [{ id: nudgeInterview.id }],
              description: 'hello',
              introduction: 'hello',
              department: 'Paris (75)',
            };
            const userProfileCoach: UserProfileWithPartialAssociations = {
              currentJob: 'peintre',
              businessSectors: [{ name: 'bat' }] as BusinessSector[],
              description: 'hello',
              introduction: 'hello',
              department: 'Paris (75)',
            };
            await userFactory.create(
              {
                role: UserRoles.CANDIDATE,
                lastConnection: moment().subtract(5, 'day').toDate(),
              },
              { userProfile: userProfileCandidate }
            );
            secondCreatedCandidate = await userFactory.create(
              {
                role: UserRoles.CANDIDATE,
                lastConnection: moment().subtract(4, 'day').toDate(),
              },
              { userProfile: userProfileCandidate }
            );
            thirdCreatedCandidate = await userFactory.create(
              {
                role: UserRoles.CANDIDATE,
                lastConnection: moment().subtract(3, 'day').toDate(),
              },
              { userProfile: userProfileCandidate }
            );
            fourthCreatedCandidate = await userFactory.create(
              {
                role: UserRoles.CANDIDATE,
                lastConnection: moment().subtract(2, 'day').toDate(),
              },
              { userProfile: userProfileCandidate }
            );
            fifthCreatedCandidate = await userFactory.create(
              {
                role: UserRoles.CANDIDATE,
                lastConnection: moment().subtract(1, 'day').toDate(),
              },
              { userProfile: userProfileCandidate }
            );
            await userFactory.create(
              {
                role: UserRoles.COACH,
                lastConnection: moment().subtract(5, 'day').toDate(),
              },
              { userProfile: userProfileCoach }
            );
            secondCreatedCoach = await userFactory.create(
              {
                role: UserRoles.COACH,
                lastConnection: moment().subtract(4, 'day').toDate(),
              },
              { userProfile: userProfileCoach }
            );
            thirdCreatedCoach = await userFactory.create(
              {
                role: UserRoles.COACH,
                lastConnection: moment().subtract(3, 'day').toDate(),
              },
              { userProfile: userProfileCoach }
            );
            fourthCreatedCoach = await userFactory.create(
              {
                role: UserRoles.COACH,
                lastConnection: moment().subtract(2, 'day').toDate(),
              },
              { userProfile: userProfileCoach }
            );
            fifthCreatedCoach = await userFactory.create(
              {
                role: UserRoles.COACH,
                lastConnection: moment().subtract(1, 'day').toDate(),
              },
              { userProfile: userProfileCoach }
            );
          });

          it('Should return 200 and contains own profile', async () => {
            const response: APIResponse<UserProfilesController['findAll']> =
              await request(server)
                .get(
                  `${route}/profile?limit=1&offset=5&role[]=${UserRoles.CANDIDATE}`
                )
                .set('authorization', `Bearer ${loggedInCandidate.token}`);
            expect(response.status).toBe(200);
            expect(response.body.length).toBe(1);
            expect(response.body.map(({ role }) => role)).toStrictEqual([
              UserRoles.CANDIDATE,
            ]);
            expect(response.body[0].id).toEqual(loggedInCandidate.user.id);
          });

          it('Should return 200 and 2 first candidates profiles', async () => {
            const response: APIResponse<UserProfilesController['findAll']> =
              await request(server)
                .get(
                  `${route}/profile?limit=2&offset=0&role[]=${UserRoles.CANDIDATE}`
                )
                .set('authorization', `Bearer ${loggedInCandidate.token}`);
            expect(response.status).toBe(200);
            expect(response.body.length).toBe(2);
            expect(response.body.map(({ role }) => role)).toStrictEqual([
              UserRoles.CANDIDATE,
              UserRoles.CANDIDATE,
            ]);
            expect(response.body[0]).toEqual(
              expect.objectContaining(
                userProfilesHelper.mapUserProfileFromUser(fifthCreatedCandidate)
              )
            );
            expect(response.body[1]).toEqual(
              expect.objectContaining(
                userProfilesHelper.mapUserProfileFromUser(
                  fourthCreatedCandidate
                )
              )
            );
          });
          it('Should return 400, if search for referer profile', async () => {
            const response: APIResponse<UserProfilesController['findAll']> =
              await request(server)
                .get(
                  `${route}/profile?limit=2&offset=0&role[]=${UserRoles.REFERER}`
                )
                .set('authorization', `Bearer ${loggedInCandidate.token}`);
            expect(response.status).toBe(400);
          });
          it('Should return 200 and 3 first coaches', async () => {
            const response: APIResponse<UserProfilesController['findAll']> =
              await request(server)
                .get(
                  `${route}/profile?limit=3&offset=0&role[]=${UserRoles.COACH}`
                )
                .set('authorization', `Bearer ${loggedInCandidate.token}`);
            expect(response.status).toBe(200);
            expect(response.body.length).toBe(3);
            expect(response.body.map(({ role }) => role)).toStrictEqual([
              UserRoles.COACH,
              UserRoles.COACH,
              UserRoles.COACH,
            ]);
            expect(response.body[0]).toEqual(
              expect.objectContaining(
                userProfilesHelper.mapUserProfileFromUser(fifthCreatedCoach)
              )
            );
            expect(response.body[1]).toEqual(
              expect.objectContaining(
                userProfilesHelper.mapUserProfileFromUser(fourthCreatedCoach)
              )
            );
            expect(response.body[2]).toEqual(
              expect.objectContaining(
                userProfilesHelper.mapUserProfileFromUser(thirdCreatedCoach)
              )
            );
          });
          it('Should return 200 and the 3rd and 4th candidate', async () => {
            const response: APIResponse<UserProfilesController['findAll']> =
              await request(server)
                .get(
                  `${route}/profile?limit=2&offset=2&role[]=${UserRoles.CANDIDATE}`
                )
                .set('authorization', `Bearer ${loggedInCandidate.token}`);
            expect(response.status).toBe(200);
            expect(response.body.length).toBe(2);
            expect(response.body.map(({ role }) => role)).toStrictEqual([
              UserRoles.CANDIDATE,
              UserRoles.CANDIDATE,
            ]);

            expect(response.body[0]).toEqual(
              expect.objectContaining(
                userProfilesHelper.mapUserProfileFromUser(thirdCreatedCandidate)
              )
            );
            expect(response.body[1]).toEqual(
              expect.objectContaining(
                userProfilesHelper.mapUserProfileFromUser(
                  secondCreatedCandidate
                )
              )
            );
          });
          it('Should return 200 and the 3rd and 4th coach', async () => {
            const response: APIResponse<UserProfilesController['findAll']> =
              await request(server)
                .get(
                  `${route}/profile?limit=2&offset=2&role[]=${UserRoles.COACH}`
                )
                .set('authorization', `Bearer ${loggedInCandidate.token}`);
            expect(response.status).toBe(200);
            expect(response.body.length).toBe(2);
            expect(response.body.map(({ role }) => role)).toStrictEqual([
              UserRoles.COACH,
              UserRoles.COACH,
            ]);
            expect(response.body[0]).toEqual(
              expect.objectContaining(
                userProfilesHelper.mapUserProfileFromUser(thirdCreatedCoach)
              )
            );
            expect(response.body[1]).toEqual(
              expect.objectContaining(
                userProfilesHelper.mapUserProfileFromUser(secondCreatedCoach)
              )
            );
          });
        });
        describe('/profile?search= - Read all profiles with search query', () => {
          let loggedInAdmin: LoggedUser;

          beforeEach(async () => {
            loggedInAdmin = await usersHelper.createLoggedInUser({
              role: UserRoles.ADMIN,
            });
          });

          it('Should return 200 and candidates matching search query', async () => {
            const candidate1 = await userFactory.create({
              role: UserRoles.CANDIDATE,
              firstName: 'XXX',
            });
            await userFactory.create({
              role: UserRoles.CANDIDATE,
              firstName: 'YYYY',
            });
            const candidate2 = await userFactory.create({
              role: UserRoles.CANDIDATE,
              firstName: 'XXX',
            });
            await userFactory.create({
              role: UserRoles.CANDIDATE,
              firstName: 'YYY',
            });

            const expectedCandidates = [candidate1, candidate2];

            const response: APIResponse<UserProfilesController['findAll']> =
              await request(server)
                .get(
                  `${route}/profile?limit=50&offset=0&role[]=${UserRoles.CANDIDATE}&search=XXX`
                )
                .set('authorization', `Bearer ${loggedInAdmin.token}`);
            expect(response.status).toBe(200);
            expect(response.body.length).toBe(2);
            expect(expectedCandidates.map(({ id }) => id)).toEqual(
              expect.arrayContaining(response.body.map(({ id }) => id))
            );
          });
          it('Should return 200 and coaches matching search query', async () => {
            const coaches1 = await userFactory.create({
              role: UserRoles.COACH,
              firstName: 'XXX',
            });
            await userFactory.create({
              role: UserRoles.COACH,
              firstName: 'YYY',
            });
            const coaches2 = await userFactory.create({
              role: UserRoles.COACH,
              firstName: 'XXX',
            });
            await userFactory.create({
              role: UserRoles.COACH,
              firstName: 'YYY',
            });
            const expectedCoaches = [coaches1, coaches2];

            const response: APIResponse<UserProfilesController['findAll']> =
              await request(server)
                .get(
                  `${route}/profile?limit=50&offset=0&role[]=${UserRoles.COACH}&search=XXX`
                )
                .set('authorization', `Bearer ${loggedInAdmin.token}`);
            expect(response.status).toBe(200);
            expect(response.body.length).toBe(2);
            expect(expectedCoaches.map(({ id }) => id)).toEqual(
              expect.arrayContaining(response.body.map(({ id }) => id))
            );
          });
        });
        describe('/profile?departments[]=&businessSectors[]=&helps[]= - Read all profiles with filters', () => {
          let loggedInAdmin: LoggedUser;
          beforeEach(async () => {
            loggedInAdmin = await usersHelper.createLoggedInUser({
              role: UserRoles.ADMIN,
            });
          });
          it('Should return 200, and all the candidates that matches the department filter', async () => {
            const lyonCandidates = await databaseHelper.createEntities(
              userFactory,
              2,
              {
                role: UserRoles.CANDIDATE,
              },
              {
                userProfile: { department: 'Rhône (69)' },
              }
            );
            const parisCandidates = await databaseHelper.createEntities(
              userFactory,
              2,
              {
                role: UserRoles.CANDIDATE,
              },
              {
                userProfile: { department: 'Paris (75)' },
              }
            );
            await databaseHelper.createEntities(
              userFactory,
              2,
              {
                role: UserRoles.CANDIDATE,
              },
              {
                userProfile: { department: 'Nord (59)' },
              }
            );

            await databaseHelper.createEntities(
              userFactory,
              2,
              {
                role: UserRoles.COACH,
              },
              {
                userProfile: { department: 'Nord (59)' },
              }
            );

            const expectedCandidatesIds = [
              ...lyonCandidates.map(({ id }) => id),
              ...parisCandidates.map(({ id }) => id),
            ];

            const response: APIResponse<UserProfilesController['findAll']> =
              await request(server)
                .get(
                  `${route}/profile?limit=50&offset=0&role[]=${
                    UserRoles.CANDIDATE
                  }&departments[]=${encodeURIComponent(
                    'Rhône (69)'
                  )}&departments[]=${encodeURIComponent('Paris (75)')}`
                )
                .set('authorization', `Bearer ${loggedInAdmin.token}`);
            expect(response.status).toBe(200);
            expect(response.body.length).toBe(4);
            expect(expectedCandidatesIds).toEqual(
              expect.arrayContaining(response.body.map(({ id }) => id))
            );
          });
          it('Should return 200, and all the coaches that matches the department filter', async () => {
            const lyonCoaches = await databaseHelper.createEntities(
              userFactory,
              2,
              {
                role: UserRoles.COACH,
              },
              {
                userProfile: { department: 'Rhône (69)' },
              }
            );
            const parisCoaches = await databaseHelper.createEntities(
              userFactory,
              2,
              {
                role: UserRoles.COACH,
              },
              {
                userProfile: {
                  department: 'Paris (75)',
                },
              }
            );
            await databaseHelper.createEntities(
              userFactory,
              2,
              {
                role: UserRoles.COACH,
              },
              {
                userProfile: {
                  department: 'Nord (59)',
                },
              }
            );

            await databaseHelper.createEntities(
              userFactory,
              2,
              {
                role: UserRoles.CANDIDATE,
              },
              {
                userProfile: { department: 'Rhône (69)' },
              }
            );

            const expectedCoachesIds = [
              ...lyonCoaches.map(({ id }) => id),
              ...parisCoaches.map(({ id }) => id),
            ];

            const response: APIResponse<UserProfilesController['findAll']> =
              await request(server)
                .get(
                  `${route}/profile?limit=50&offset=0&role[]=${
                    UserRoles.COACH
                  }&departments[]=${encodeURIComponent(
                    'Rhône (69)'
                  )}&departments[]=${encodeURIComponent('Paris (75)')}`
                )
                .set('authorization', `Bearer ${loggedInAdmin.token}`);
            expect(response.status).toBe(200);
            expect(response.body.length).toBe(4);
            expect(expectedCoachesIds).toEqual(
              expect.arrayContaining(response.body.map(({ id }) => id))
            );
          });

          it('Should return 200, and all the candidates that matches the businessSectors filters', async () => {
            // bat
            const businessSector1 = await businessSectorsHelper.findOne({
              name: 'Sector 1',
            });
            // asp
            const businessSector2 = await businessSectorsHelper.findOne({
              name: 'Sector 2',
            });
            // rh
            const businessSector3 = await businessSectorsHelper.findOne({
              name: 'Sector 3',
            });
            // aa
            const businessSector4 = await businessSectorsHelper.findOne({
              name: 'Sector 4',
            });
            // pr
            const businessSector5 = await businessSectorsHelper.findOne({
              name: 'Sector 5',
            });

            const batCandidates = await databaseHelper.createEntities(
              userFactory,
              2,
              {
                role: UserRoles.CANDIDATE,
              },
              {
                userProfile: {
                  sectorOccupations: [
                    {
                      businessSectorId: businessSector1.id,
                    },
                    {
                      businessSectorId: businessSector2.id,
                    },
                  ],
                },
              }
            );

            const rhCandidates = await databaseHelper.createEntities(
              userFactory,
              2,
              {
                role: UserRoles.CANDIDATE,
              },
              {
                userProfile: {
                  sectorOccupations: [
                    {
                      businessSectorId: businessSector3.id,
                    },
                    {
                      businessSectorId: businessSector4.id,
                    },
                  ],
                },
              }
            );

            await databaseHelper.createEntities(
              userFactory,
              2,
              {
                role: UserRoles.CANDIDATE,
              },
              {
                userProfile: {
                  sectorOccupations: [
                    {
                      businessSectorId: businessSector4.id,
                    },
                    {
                      businessSectorId: businessSector5.id,
                    },
                  ],
                },
              }
            );

            await databaseHelper.createEntities(
              userFactory,
              2,
              {
                role: UserRoles.COACH,
              },
              {
                userProfile: {
                  sectorOccupations: [
                    {
                      businessSectorId: businessSector1.id,
                    },
                    {
                      businessSectorId: businessSector2.id,
                    },
                  ],
                },
              }
            );

            await databaseHelper.createEntities(
              userFactory,
              2,
              {
                role: UserRoles.COACH,
              },
              {
                userProfile: {
                  sectorOccupations: [
                    {
                      businessSectorId: businessSector3.id,
                    },
                    {
                      businessSectorId: businessSector4.id,
                    },
                  ],
                },
              }
            );

            await databaseHelper.createEntities(
              userFactory,
              2,
              {
                role: UserRoles.COACH,
              },
              {
                userProfile: {
                  sectorOccupations: [
                    {
                      businessSectorId: businessSector4.id,
                    },
                    {
                      businessSectorId: businessSector5.id,
                    },
                  ],
                },
              }
            );

            const expectedCandidatesIds = [
              ...batCandidates.map(({ id }) => id),
              ...rhCandidates.map(({ id }) => id),
            ];

            const response: APIResponse<UserProfilesController['findAll']> =
              await request(server)
                .get(
                  `${route}/profile?limit=50&offset=0&role[]=${UserRoles.CANDIDATE}&businessSectorIds[]=${businessSector1.id}&businessSectorIds[]=${businessSector3.id}`
                )
                .set('authorization', `Bearer ${loggedInAdmin.token}`);
            expect(response.status).toBe(200);
            expect(response.body.length).toBe(4);
            expect(expectedCandidatesIds).toEqual(
              expect.arrayContaining(response.body.map(({ id }) => id))
            );
          });
          it('Should return 200, and all the coaches that matches the businessSectors filters', async () => {
            const businessSector1 = await businessSectorsHelper.findOne({
              name: 'Sector 1',
            });
            const businessSector2 = await businessSectorsHelper.findOne({
              name: 'Sector 2',
            });
            const businessSector3 = await businessSectorsHelper.findOne({
              name: 'Sector 3',
            });
            const businessSector4 = await businessSectorsHelper.findOne({
              name: 'Sector 4',
            });
            const businessSector5 = await businessSectorsHelper.findOne({
              name: 'Sector 5',
            });

            await databaseHelper.createEntities(
              userFactory,
              2,
              {
                role: UserRoles.CANDIDATE,
              },
              {
                userProfile: {
                  sectorOccupations: [
                    {
                      businessSectorId: businessSector1.id,
                    },
                    {
                      businessSectorId: businessSector2.id,
                    },
                  ],
                },
              }
            );

            await databaseHelper.createEntities(
              userFactory,
              2,
              {
                role: UserRoles.CANDIDATE,
              },
              {
                userProfile: {
                  sectorOccupations: [
                    {
                      businessSectorId: businessSector3.id,
                    },
                    {
                      businessSectorId: businessSector4.id,
                    },
                  ],
                },
              }
            );

            await databaseHelper.createEntities(
              userFactory,
              2,
              {
                role: UserRoles.CANDIDATE,
              },
              {
                userProfile: {
                  sectorOccupations: [
                    {
                      businessSectorId: businessSector4.id,
                    },
                    {
                      businessSectorId: businessSector5.id,
                    },
                  ],
                },
              }
            );

            const batCoaches = await databaseHelper.createEntities(
              userFactory,
              2,
              {
                role: UserRoles.COACH,
              },
              {
                userProfile: {
                  sectorOccupations: [
                    {
                      businessSectorId: businessSector1.id,
                    },
                    {
                      businessSectorId: businessSector2.id,
                    },
                  ],
                },
              }
            );

            const rhCoaches = await databaseHelper.createEntities(
              userFactory,
              2,
              {
                role: UserRoles.COACH,
              },
              {
                userProfile: {
                  sectorOccupations: [
                    {
                      businessSectorId: businessSector3.id,
                    },
                    {
                      businessSectorId: businessSector4.id,
                    },
                  ],
                },
              }
            );

            await databaseHelper.createEntities(
              userFactory,
              2,
              {
                role: UserRoles.COACH,
              },
              {
                userProfile: {
                  sectorOccupations: [
                    {
                      businessSectorId: businessSector4.id,
                    },
                    {
                      businessSectorId: businessSector5.id,
                    },
                  ],
                },
              }
            );

            const expectedCoachesIds = [
              ...batCoaches.map(({ id }) => id),
              ...rhCoaches.map(({ id }) => id),
            ];

            const response: APIResponse<UserProfilesController['findAll']> =
              await request(server)
                .get(
                  `${route}/profile?limit=50&offset=0&role[]=${UserRoles.COACH}&businessSectorIds[]=${businessSector1.id}&businessSectorIds[]=${businessSector3.id}`
                )
                .set('authorization', `Bearer ${loggedInAdmin.token}`);
            expect(response.status).toBe(200);
            expect(response.body.length).toBe(4);
            expect(expectedCoachesIds).toEqual(
              expect.arrayContaining(response.body.map(({ id }) => id))
            );
          });

          it('Should return 200, and all the candidates that matches the nudges filters', async () => {
            const cvCandidates = await databaseHelper.createEntities(
              userFactory,
              2,
              {
                role: UserRoles.CANDIDATE,
              },
              {
                userProfile: {
                  nudges: [{ id: nudgeCv.id }, { id: nudgeNetwork.id }],
                },
              }
            );

            const interviewCandidates = await databaseHelper.createEntities(
              userFactory,
              2,
              {
                role: UserRoles.CANDIDATE,
              },
              {
                userProfile: {
                  nudges: [{ id: nudgeInterview.id }, { id: nudgeEvent.id }],
                },
              }
            );

            await databaseHelper.createEntities(
              userFactory,
              2,
              {
                role: UserRoles.CANDIDATE,
              },
              {
                userProfile: {
                  nudges: [{ id: nudgeTips.id }],
                },
              }
            );

            await databaseHelper.createEntities(
              userFactory,
              2,
              {
                role: UserRoles.COACH,
              },
              {
                userProfile: {
                  nudges: [{ id: nudgeCv.id }, { id: nudgeNetwork.id }],
                },
              }
            );

            await databaseHelper.createEntities(
              userFactory,
              2,
              {
                role: UserRoles.COACH,
              },
              {
                userProfile: {
                  nudges: [{ id: nudgeInterview.id }, { id: nudgeEvent.id }],
                },
              }
            );

            await databaseHelper.createEntities(
              userFactory,
              2,
              {
                role: UserRoles.COACH,
              },
              {
                userProfile: {
                  nudges: [{ id: nudgeTips.id }],
                },
              }
            );

            const expectedCandidatesIds = [
              ...interviewCandidates.map(({ id }) => id),
              ...cvCandidates.map(({ id }) => id),
            ];

            const response: APIResponse<UserProfilesController['findAll']> =
              await request(server)
                .get(
                  `${route}/profile?limit=50&offset=0&role[]=${UserRoles.CANDIDATE}&nudgeIds[]=${nudgeCv.id}&nudgeIds[]=${nudgeInterview.id}`
                )
                .set('authorization', `Bearer ${loggedInAdmin.token}`);
            expect(response.status).toBe(200);
            expect(response.body.length).toBe(4);
            expect(expectedCandidatesIds).toEqual(
              expect.arrayContaining(response.body.map(({ id }) => id))
            );
          });
          it('Should return 200, and all the coaches that matches the nudges filters', async () => {
            await databaseHelper.createEntities(
              userFactory,
              2,
              {
                role: UserRoles.CANDIDATE,
              },
              {
                userProfile: {
                  nudges: [{ id: nudgeCv.id }, { id: nudgeNetwork.id }],
                },
              }
            );

            await databaseHelper.createEntities(
              userFactory,
              2,
              {
                role: UserRoles.CANDIDATE,
              },
              {
                userProfile: {
                  nudges: [{ id: nudgeInterview.id }, { id: nudgeEvent.id }],
                },
              }
            );

            await databaseHelper.createEntities(
              userFactory,
              2,
              {
                role: UserRoles.CANDIDATE,
              },
              {
                userProfile: {
                  nudges: [{ id: nudgeTips.id }],
                },
              }
            );

            const cvCoaches = await databaseHelper.createEntities(
              userFactory,
              2,
              {
                role: UserRoles.COACH,
              },
              {
                userProfile: {
                  nudges: [{ id: nudgeCv.id }, { id: nudgeNetwork.id }],
                },
              }
            );

            const interviewCoaches = await databaseHelper.createEntities(
              userFactory,
              2,
              {
                role: UserRoles.COACH,
              },
              {
                userProfile: {
                  nudges: [{ id: nudgeInterview.id }, { id: nudgeEvent.id }],
                },
              }
            );

            await databaseHelper.createEntities(
              userFactory,
              2,
              {
                role: UserRoles.COACH,
              },
              {
                userProfile: {
                  nudges: [{ id: nudgeTips.id }],
                },
              }
            );

            const expectedCoachesIds = [
              ...interviewCoaches.map(({ id }) => id),
              ...cvCoaches.map(({ id }) => id),
            ];

            const response: APIResponse<UserProfilesController['findAll']> =
              await request(server)
                .get(
                  `${route}/profile?limit=50&offset=0&role[]=${UserRoles.COACH}&nudgeIds[]=${nudgeCv.id}&nudgeIds[]=${nudgeInterview.id}`
                )
                .set('authorization', `Bearer ${loggedInAdmin.token}`);
            expect(response.status).toBe(200);
            expect(response.body.length).toBe(4);
            expect(expectedCoachesIds).toEqual(
              expect.arrayContaining(response.body.map(({ id }) => id))
            );
          });
        });
        describe('/profile - Read all profiles with all filters', () => {
          let loggedInAdmin: LoggedUser;
          beforeEach(async () => {
            loggedInAdmin = await usersHelper.createLoggedInUser({
              role: UserRoles.ADMIN,
            });
          });
          it('Should return 200, and all the candidates that match all the filters', async () => {
            const businessSector1 = await businessSectorsHelper.findOne({
              name: 'Sector 1',
            });
            const businessSector2 = await businessSectorsHelper.findOne({
              name: 'Sector 2',
            });
            const lyonAssociatedCoaches = await databaseHelper.createEntities(
              userFactory,
              2,
              {
                firstName: 'XXX',
                role: UserRoles.COACH,
              },
              {
                userProfile: {
                  department: 'Rhône (69)',
                  sectorOccupations: [
                    {
                      businessSectorId: businessSector1.id,
                    },
                    {
                      businessSectorId: businessSector2.id,
                    },
                  ],
                  nudges: [{ id: nudgeCv.id }, { id: nudgeNetwork.id }],
                },
              }
            );

            const lyonAssociatedCandidates =
              await databaseHelper.createEntities(
                userFactory,
                2,
                {
                  firstName: 'XXX',
                  role: UserRoles.CANDIDATE,
                },
                {
                  userProfile: {
                    department: 'Rhône (69)',
                    sectorOccupations: [
                      {
                        businessSectorId: businessSector1.id,
                      },
                      {
                        businessSectorId: businessSector2.id,
                      },
                    ],
                    nudges: [{ id: nudgeCv.id }, { id: nudgeNetwork.id }],
                  },
                }
              );

            await Promise.all(
              lyonAssociatedCandidates.map(async (candidate, index) => {
                return userCandidatsHelper.associateCoachAndCandidate(
                  lyonAssociatedCoaches[index],
                  candidate
                );
              })
            );

            const expectedCandidatesIds = [
              ...lyonAssociatedCandidates.map(({ id }) => id),
            ];

            const response: APIResponse<UserProfilesController['findAll']> =
              await request(server)
                .get(
                  `${route}/profile?limit=50&offset=0&role[]=${
                    UserRoles.CANDIDATE
                  }&query=XXX&departments[]=${encodeURIComponent(
                    'Rhône (69)'
                  )}&businessSectorIds[]=${businessSector1.id}&nudgeIds[]=${
                    nudgeCv.id
                  }&nudgeIds[]=${nudgeNetwork.id}`
                )
                .set('authorization', `Bearer ${loggedInAdmin.token}`);
            expect(response.status).toBe(200);
            expect(response.body.length).toBe(2);
            expect(expectedCandidatesIds).toEqual(
              expect.arrayContaining(response.body.map(({ id }) => id))
            );
          });
          it('Should return 200, and all the coaches that match all the filters', async () => {
            const businessSector1 = await businessSectorsHelper.findOne({
              name: 'Sector 1',
            });
            const businessSector2 = await businessSectorsHelper.findOne({
              name: 'Sector 2',
            });

            const lyonAssociatedCoaches = await databaseHelper.createEntities(
              userFactory,
              2,
              {
                firstName: 'XXX',
                role: UserRoles.COACH,
              },
              {
                userProfile: {
                  department: 'Rhône (69)',
                  sectorOccupations: [
                    {
                      businessSectorId: businessSector1.id,
                    },
                    {
                      businessSectorId: businessSector2.id,
                    },
                  ],
                  nudges: [{ id: nudgeCv.id }, { id: nudgeNetwork.id }],
                },
              }
            );

            const lyonAssociatedCandidates =
              await databaseHelper.createEntities(
                userFactory,
                2,
                {
                  firstName: 'XXX',
                  role: UserRoles.CANDIDATE,
                },
                {
                  userProfile: {
                    department: 'Rhône (69)',
                    sectorOccupations: [
                      {
                        businessSectorId: businessSector1.id,
                      },
                      {
                        businessSectorId: businessSector2.id,
                      },
                    ],
                    nudges: [{ id: nudgeCv.id }, { id: nudgeNetwork.id }],
                  },
                }
              );

            await Promise.all(
              lyonAssociatedCandidates.map(async (candidate, index) => {
                return userCandidatsHelper.associateCoachAndCandidate(
                  lyonAssociatedCoaches[index],
                  candidate
                );
              })
            );

            const expectedCoachesIds = [
              ...lyonAssociatedCoaches.map(({ id }) => id),
            ];

            const response: APIResponse<UserProfilesController['findAll']> =
              await request(server)
                .get(
                  `${route}/profile?limit=50&offset=0&role[]=${
                    UserRoles.COACH
                  }&query=XXX&departments[]=${encodeURIComponent(
                    'Rhône (69)'
                  )}&businessSectorIds[]=${businessSector1.id}&nudgeIds[]=${
                    nudgeNetwork.id
                  }`
                )
                .set('authorization', `Bearer ${loggedInAdmin.token}`);

            expect(response.status).toBe(200);
            expect(response.body.length).toBe(2);
            expect(expectedCoachesIds).toEqual(
              expect.arrayContaining(response.body.map(({ id }) => id))
            );
          });
        });
      });

      describe('GET /user/profile/:userId - Get user profile', () => {
        let loggedInUser: LoggedUser;
        let randomUser: User;
        beforeEach(async () => {
          loggedInUser = await usersHelper.createLoggedInUser();

          randomUser = await userFactory.create(
            {},
            {
              userProfile: {
                department: 'Paris (75)',
                sectorOccupations: [
                  {
                    businessSectorId: businessSector1.id,
                    occupation: { name: 'développeur' },
                  },
                ],
                nudges: [{ id: nudgeNetwork.id }],
                contracts: [{ id: contractCdd.id }, { id: contractCdi.id }],
                skills: [{ name: 'JavaScript', order: 0 }],
                userProfileLanguages: [
                  {
                    languageId: languageFrench.id,
                  },
                  {
                    languageId: languageEnglish.id,
                  },
                ],
                interests: [
                  { name: 'Photographie', order: 0 },
                  { name: 'Voyage', order: 1 },
                ],
                customNudges: [
                  {
                    content: 'Nudge personnalisé 1',
                  },
                  {
                    content: 'Nudge personnalisé 2',
                  },
                ],
                reviews: [
                  {
                    authorName: 'John Doe',
                    authorLabel: 'CEO',
                    content: 'Great candidate!',
                  },
                ],
              },
            }
          );
          // Create 3 experiences for the random user
          await databaseHelper.createEntities(experienceFactory, 3, {
            userProfileId: randomUser.userProfile.id,
          });

          // Create 2 formations for the random user
          await databaseHelper.createEntities(formationFactory, 2, {
            userProfileId: randomUser.userProfile.id,
          });

          // Re fetch the random user to ensure the profile is up-to-date
          randomUser = await usersHelper.findUser(randomUser.id, true);
        });
        it('Should return 401, if user not logged in', async () => {
          const response: APIResponse<UserProfilesController['findByUserId']> =
            await request(server).get(`${route}/profile/${randomUser.id}`);
          expect(response.status).toBe(401);
        });
        it('Should return 200, if user logged in', async () => {
          const response: APIResponse<UserProfilesController['findByUserId']> =
            await request(server)
              .get(`${route}/profile/${randomUser.id}`)
              .set('authorization', `Bearer ${loggedInUser.token}`);
          expect(response.status).toBe(200);
          expect(response.body).toEqual(
            expect.objectContaining(
              userProfilesHelper.mapUserProfileFromUser(randomUser, true)
            )
          );
        });
        it('Should return 200, and last contacted dates if user has contacted other user', async () => {
          const internalMessageReceived = await internalMessageFactory.create({
            senderUserId: randomUser.id,
            addresseeUserId: loggedInUser.user.id,
          });

          const internalMessageSent = await internalMessageFactory.create({
            senderUserId: loggedInUser.user.id,
            addresseeUserId: randomUser.id,
          });

          const response: APIResponse<UserProfilesController['findByUserId']> =
            await request(server)
              .get(`${route}/profile/${randomUser.id}`)
              .set('authorization', `Bearer ${loggedInUser.token}`);
          expect(response.status).toBe(200);
          expect(response.body).toEqual(
            expect.objectContaining({
              ...userProfilesHelper.mapUserProfileFromUser(randomUser, true),
              lastReceivedMessage:
                internalMessageReceived.createdAt.toISOString(),
              lastSentMessage: internalMessageSent.createdAt.toISOString(),
            })
          );
        });
      });
    });

    describe('UPDATE', () => {
      describe('PUT /profile/:userId - Update user profile', () => {
        let loggedInAdmin: LoggedUser;
        let loggedInCandidate: LoggedUser;
        let loggedInCoach: LoggedUser;
        let loggedInReferer: LoggedUser;

        beforeEach(async () => {
          loggedInAdmin = await usersHelper.createLoggedInUser({
            role: UserRoles.ADMIN,
          });
          loggedInCandidate = await usersHelper.createLoggedInUser(
            {
              role: UserRoles.CANDIDATE,
              zone: AdminZones.LYON,
            },
            {
              userProfile: {
                department: 'Rhône (69)',
                isAvailable: true,
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
          loggedInCoach = await usersHelper.createLoggedInUser(
            {
              role: UserRoles.COACH,
              zone: AdminZones.LYON,
            },
            {
              userProfile: {
                department: 'Rhône (69)',
                currentJob: 'peintre',
                isAvailable: true,
                nudges: [{ id: nudgeInterview.id }],
                sectorOccupations: [
                  {
                    businessSectorId: businessSector1.id,
                  },
                ],
              },
            }
          );

          loggedInReferer = await usersHelper.createLoggedInUser({
            role: UserRoles.REFERER,
          });

          ({ loggedInCoach, loggedInCandidate } =
            await userCandidatsHelper.associateCoachAndCandidate(
              loggedInCoach,
              loggedInCandidate,
              true
            ));
        });

        it('Should return 401, if user not logged in', async () => {
          const response: APIResponse<
            UserProfilesController['updateByUserId']
          > = await request(server).put(
            `${route}/profile/${loggedInCandidate.user.id}`
          );

          expect(response.status).toBe(401);
        });
        it('Should return 403, if admin updates his user profile', async () => {
          const response: APIResponse<
            UserProfilesController['updateByUserId']
          > = await request(server)
            .put(`${route}/profile/${loggedInAdmin.user.id}`)
            .set('authorization', `Bearer ${loggedInAdmin.token}`)
            .send({
              description: 'hello',
              introduction: 'hello',
              isAvailable: false,
              department: 'Paris (75)',
            });
          expect(response.status).toBe(403);
        });
        it('Should return 403, if admin updates a profile for another user', async () => {
          const response: APIResponse<
            UserProfilesController['updateByUserId']
          > = await request(server)
            .put(`${route}/profile/${loggedInCandidate.user.id}`)
            .set('authorization', `Bearer ${loggedInAdmin.token}`)
            .send({
              description: 'hello',
              introduction: 'hello',
              isAvailable: false,
              department: 'Paris (75)',
            });
          expect(response.status).toBe(403);
        });
        it('Should return 403, if referer updates a profile for another user', async () => {
          const response: APIResponse<
            UserProfilesController['updateByUserId']
          > = await request(server)
            .put(`${route}/profile/${loggedInCandidate.user.id}`)
            .set('authorization', `Bearer ${loggedInReferer.token}`)
            .send({
              description: 'hello',
              introduction: 'hello',
              isAvailable: false,
              department: 'Paris (75)',
            });
          expect(response.status).toBe(403);
        });
        it('Should return 403, if coach updates a profile for another user', async () => {
          const response: APIResponse<
            UserProfilesController['updateByUserId']
          > = await request(server)
            .put(`${route}/profile/${loggedInCandidate.user.id}`)
            .set('authorization', `Bearer ${loggedInCoach.token}`)
            .send({
              description: 'hello',
              introduction: 'hello',
              isAvailable: false,
              department: 'Paris (75)',
            });
          expect(response.status).toBe(403);
        });
        it('Should return 403, if candidate updates a profile for another user', async () => {
          const response: APIResponse<
            UserProfilesController['updateByUserId']
          > = await request(server)
            .put(`${route}/profile/${loggedInCoach.user.id}`)
            .set('authorization', `Bearer ${loggedInCandidate.token}`)
            .send({
              description: 'hello',
              introduction: 'hello',
              isAvailable: false,
              department: 'Paris (75)',
            });
          expect(response.status).toBe(403);
        });
        it('Should return 200, if candidate updates his profile candidate properties', async () => {
          const businessSector = await businessSectorsHelper.findOne({
            name: 'Sector 1',
          });
          const updatedProfile = {
            description: 'hello',
            introduction: 'hello',
            department: 'Paris (75)',
            isAvailable: false,
            sectorOccupations: [
              {
                businessSectorId: businessSector.id,
                occupation: {
                  name: 'Développeur',
                },
              },
            ],
            nudges: [{ id: nudgeNetwork.id }],
            linkedinUrl: 'https://www.linkedin.com/in/jean-dupont',
          };

          const response: APIResponse<
            UserProfilesController['updateByUserId']
          > = await request(server)
            .put(`${route}/profile/${loggedInCandidate.user.id}`)
            .set('authorization', `Bearer ${loggedInCandidate.token}`)
            .send(updatedProfile);

          const updatedUser = await usersHelper.findUser(
            loggedInCandidate.user.id
          );

          const {
            nudges: updatedNudges,
            sectorOccupations: updatedSectorOccupation,
            ...restUpdatedUserProfile
          } = updatedUser.userProfile;

          expect(response.status).toBe(200);
          expect(response.body).toEqual(
            expect.objectContaining({
              ...restUpdatedUserProfile,
              sectorOccupations: [
                expect.objectContaining({
                  businessSector: expect.objectContaining({ name: 'Sector 1' }),
                  occupation: expect.objectContaining({ name: 'Développeur' }),
                }),
              ],
              nudges: [
                expect.objectContaining({
                  id: nudgeNetwork.id,
                  nameRequest: nudgeNetwork.nameRequest,
                  nameOffer: nudgeNetwork.nameOffer,
                  value: nudgeNetwork.value,
                  order: nudgeNetwork.order,
                }),
              ],
            })
          );
          expect(updatedUser.zone).toMatch(AdminZones.PARIS);
        });
        it('Should return 400, if linkedinUrl does not match the regex pattern', async () => {
          const updatedProfile: UserProfileWithPartialAssociations = {
            description: 'hello',
            introduction: 'hello',
            department: 'Paris (75)',
            isAvailable: false,
            sectorOccupations: [
              {
                businessSectorId: businessSector1.id,
                occupation: { name: 'développeur' },
              },
            ],
            nudges: [{ id: nudgeNetwork.id }],
            linkedinUrl: 'https://www.linkdin.com/in/jean-dupont',
          };

          const response: APIResponse<
            UserProfilesController['updateByUserId']
          > = await request(server)
            .put(`${route}/profile/${loggedInCandidate.user.id}`)
            .set('authorization', `Bearer ${loggedInCandidate.token}`)
            .send(updatedProfile);
          expect(response.status).toBe(400);
        });
        it('Should return 400, if candidate updates his profile with coach properties', async () => {
          const updatedProfile: Partial<UserProfile> = {
            description: 'hello',
            introduction: 'hello',
            currentJob: 'mécanicien',
            department: 'Paris (75)',
            isAvailable: false,
            businessSectors: [{ name: 'id' }] as BusinessSector[],
            // helpOffers: [{ name: 'network' }] as HelpOffer[],
          };
          const response: APIResponse<
            UserProfilesController['updateByUserId']
          > = await request(server)
            .put(`${route}/profile/${loggedInCandidate.user.id}`)
            .set('authorization', `Bearer ${loggedInCandidate.token}`)
            .send(updatedProfile);
          expect(response.status).toBe(400);
        });
        it('Should return 200, if coach updates his profile coach properties', async () => {
          const businessSector = await businessSectorsHelper.findOne({
            name: 'Sector 1',
          });
          const updatedProfile = {
            description: 'hello',
            introduction: 'hello',
            currentJob: 'mécanicien',
            department: 'Paris (75)',
            isAvailable: false,
            sectorOccupations: [
              {
                businessSectorId: businessSector.id,
              },
            ],
            linkedinUrl: 'https://www.linkedin.com/in/jean-dupont',
          };

          const response: APIResponse<
            UserProfilesController['updateByUserId']
          > = await request(server)
            .put(`${route}/profile/${loggedInCoach.user.id}`)
            .set('authorization', `Bearer ${loggedInCoach.token}`)
            .send(updatedProfile);

          const updatedUser = await usersHelper.findUser(loggedInCoach.user.id);

          expect(response.status).toBe(200);
          expect(response.body).toEqual(
            expect.objectContaining({
              ...updatedProfile,
              sectorOccupations: [
                expect.objectContaining({
                  businessSector: expect.objectContaining({ name: 'Sector 1' }),
                }),
              ],
            })
          );

          expect(updatedUser.zone).toMatch(AdminZones.PARIS);
        });
        it('Should return 403, if referer updates his profile referer properties', async () => {
          const updatedProfile: Partial<UserProfile> = {
            description: 'hello',
            introduction: 'hello',
            department: 'Paris (75)',
            isAvailable: false,
          };

          const response: APIResponse<
            UserProfilesController['updateByUserId']
          > = await request(server)
            .put(`${route}/profile/${loggedInReferer.user.id}`)
            .set('authorization', `Bearer ${loggedInReferer.token}`)
            .send(updatedProfile);

          expect(response.status).toBe(403);
        });

        it('Should return 200 and valid data if candidate update his contracts', async () => {
          const updatedProfile: UserProfileWithPartialAssociations = {
            contracts: [
              { id: contractCdd.id, name: contractCdd.name },
              { id: contractCdi.id, name: contractCdi.name },
            ],
          };

          const response: APIResponse<
            UserProfilesController['updateByUserId']
          > = await request(server)
            .put(`${route}/profile/${loggedInCandidate.user.id}`)
            .set('authorization', `Bearer ${loggedInCandidate.token}`)
            .send(updatedProfile);

          expect(response.status).toBe(200);
          expect(response.body.contracts).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                id: contractCdd.id,
                name: contractCdd.name,
              }),
              expect.objectContaining({
                id: contractCdi.id,
                name: contractCdi.name,
              }),
            ])
          );
        });

        it('Should return 200 and valid data if candidate update his interests', async () => {
          const updatedProfile: UserProfileWithPartialAssociations = {
            interests: [
              { name: 'Photographie', order: 0 },
              { name: 'Voyage', order: 1 },
            ],
          };

          const response: APIResponse<
            UserProfilesController['updateByUserId']
          > = await request(server)
            .put(`${route}/profile/${loggedInCandidate.user.id}`)
            .set('authorization', `Bearer ${loggedInCandidate.token}`)
            .send(updatedProfile);

          expect(response.status).toBe(200);
          expect(response.body.interests).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ name: 'Photographie', order: 0 }),
              expect.objectContaining({ name: 'Voyage', order: 1 }),
            ])
          );
        });

        it('Should return 200 and valid data if candidate update his customNudges', async () => {
          const updatedProfile: UserProfileWithPartialAssociations = {
            customNudges: [
              { content: 'Nudge personnalisé 1' },
              { content: 'Nudge personnalisé 2' },
            ],
          };

          const response: APIResponse<
            UserProfilesController['updateByUserId']
          > = await request(server)
            .put(`${route}/profile/${loggedInCandidate.user.id}`)
            .set('authorization', `Bearer ${loggedInCandidate.token}`)
            .send(updatedProfile);

          expect(response.status).toBe(200);
          expect(response.body.customNudges).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ content: 'Nudge personnalisé 1' }),
              expect.objectContaining({ content: 'Nudge personnalisé 2' }),
            ])
          );
        });

        it('Should return 200 and valid data if candidate update his experiences', async () => {
          const experiences = await databaseHelper.createEntities(
            experienceFactory,
            2,
            {
              userProfileId: loggedInCandidate.user.userProfile.id,
            }
          );

          const updatedProfile: UserProfileWithPartialAssociations = {
            experiences: experiences.map((experience) => ({
              id: experience.id,
              title: experience.title,
              description: experience.description,
              company: experience.company,
              startDate: experience.startDate,
              endDate: experience.endDate,
              location: experience.location,
            })),
          };

          const response: APIResponse<
            UserProfilesController['updateByUserId']
          > = await request(server)
            .put(`${route}/profile/${loggedInCandidate.user.id}`)
            .set('authorization', `Bearer ${loggedInCandidate.token}`)
            .send(updatedProfile);

          expect(response.status).toBe(200);
          expect(response.body.experiences).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                id: experiences[0].id,
                company: experiences[0].company,
                title: experiences[0].title,
              }),
              expect.objectContaining({
                id: experiences[1].id,
                company: experiences[1].company,
                title: experiences[1].title,
              }),
            ])
          );
        });

        it('Should return 200 and valid data if candidate update his formations', async () => {
          const formations = await databaseHelper.createEntities(
            formationFactory,
            2,
            {
              userProfileId: loggedInCandidate.user.userProfile.id,
            }
          );
          const sortedFormations = formations.sort(
            (a, b) => a.startDate.getTime() - b.startDate.getTime()
          );
          const updatedProfile: UserProfileWithPartialAssociations = {
            formations: sortedFormations.map((formation) => ({
              id: formation.id,
              title: formation.title,
              description: formation.description,
              institution: formation.institution,
              startDate: formation.startDate,
              endDate: formation.endDate,
              location: formation.location,
            })),
          };

          const response: APIResponse<
            UserProfilesController['updateByUserId']
          > = await request(server)
            .put(`${route}/profile/${loggedInCandidate.user.id}`)
            .set('authorization', `Bearer ${loggedInCandidate.token}`)
            .send(updatedProfile);

          expect(response.status).toBe(200);
          expect(response.body.formations).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                id: sortedFormations[0].id,
                title: sortedFormations[0].title,
                description: sortedFormations[0].description,
                location: sortedFormations[0].location,
              }),
              expect.objectContaining({
                id: sortedFormations[1].id,
                title: sortedFormations[1].title,
                description: sortedFormations[1].description,
                location: sortedFormations[1].location,
              }),
            ])
          );
        });

        it('Should return 200 and valid data if candidate update his skills', async () => {
          const skills = await databaseHelper.createEntities(skillFactory, 2, {
            userProfileId: loggedInCandidate.user.userProfile.id,
          });
          const updatedProfile: UserProfileWithPartialAssociations = {
            skills: skills.map((skill) => ({
              name: skill.name,
            })),
          };
          const sortedSkills = updatedProfile.skills.sort(
            (a, b) => a.order - b.order
          );
          const response: APIResponse<
            UserProfilesController['updateByUserId']
          > = await request(server)
            .put(`${route}/profile/${loggedInCandidate.user.id}`)
            .set('authorization', `Bearer ${loggedInCandidate.token}`)
            .send(updatedProfile);
          expect(response.status).toBe(200);
          expect(response.body.skills).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                name: sortedSkills[0].name,
              }),
              expect.objectContaining({
                name: sortedSkills[1].name,
              }),
            ])
          );
        });

        // Skills
        /// ... ?
      });
      describe('PUT /profile/uploadImage/:id - Upload user profile picture', () => {
        let path: string;

        let loggedInAdmin: LoggedUser;
        let loggedInCandidate: LoggedUser;
        let loggedInCoach: LoggedUser;
        let loggedInReferer: LoggedUser;

        beforeEach(async () => {
          path = userProfilesHelper.getTestImagePath();

          loggedInAdmin = await usersHelper.createLoggedInUser({
            role: UserRoles.ADMIN,
          });
          loggedInCandidate = await usersHelper.createLoggedInUser({
            role: UserRoles.CANDIDATE,
          });
          loggedInCoach = await usersHelper.createLoggedInUser({
            role: UserRoles.COACH,
          });
          loggedInReferer = await usersHelper.createLoggedInUser({
            role: UserRoles.REFERER,
          });

          ({ loggedInCoach, loggedInCandidate } =
            await userCandidatsHelper.associateCoachAndCandidate(
              loggedInCoach,
              loggedInCandidate,
              true
            ));
        });

        it('Should return 401, if user not logged in', async () => {
          const response: APIResponse<
            UserProfilesController['uploadProfileImage']
          > = await request(server)
            .post(`${route}/profile/uploadImage/${loggedInCandidate.user.id}`)
            .set('Content-Type', 'multipart/form-data')
            .attach('profileImage', path);

          expect(response.status).toBe(401);
        });
        it('Should return 201, if admin uploads his profile picture', async () => {
          const response: APIResponse<
            UserProfilesController['uploadProfileImage']
          > = await request(server)
            .post(`${route}/profile/uploadImage/${loggedInAdmin.user.id}`)
            .set('authorization', `Bearer ${loggedInAdmin.token}`)
            .set('Content-Type', 'multipart/form-data')
            .attach('profileImage', path);
          expect(response.status).toBe(201);
        });
        it('Should return 403, if admin uploads a profile picture for another user', async () => {
          const response: APIResponse<
            UserProfilesController['uploadProfileImage']
          > = await request(server)
            .post(`${route}/profile/uploadImage/${loggedInCandidate.user.id}`)
            .set('authorization', `Bearer ${loggedInAdmin.token}`)
            .set('Content-Type', 'multipart/form-data')
            .attach('profileImage', path);
          expect(response.status).toBe(403);
        });
        it('Should return 403, if referer uploads a profile picture for another user', async () => {
          const response: APIResponse<
            UserProfilesController['uploadProfileImage']
          > = await request(server)
            .post(`${route}/profile/uploadImage/${loggedInCandidate.user.id}`)
            .set('authorization', `Bearer ${loggedInReferer.token}`)
            .set('Content-Type', 'multipart/form-data')
            .attach('profileImage', path);
          expect(response.status).toBe(403);
        });
        it('Should return 403, if coach uploads profile picture for another user', async () => {
          const response: APIResponse<
            UserProfilesController['uploadProfileImage']
          > = await request(server)
            .post(`${route}/profile/uploadImage/${loggedInCandidate.user.id}`)
            .set('authorization', `Bearer ${loggedInCoach.token}`)
            .set('Content-Type', 'multipart/form-data')
            .attach('profileImage', path);
          expect(response.status).toBe(403);
        });
        it('Should return 403, if candidate uploads profile picture for another user', async () => {
          const response: APIResponse<
            UserProfilesController['uploadProfileImage']
          > = await request(server)
            .post(`${route}/profile/uploadImage/${loggedInCoach.user.id}`)
            .set('authorization', `Bearer ${loggedInCandidate.token}`)
            .set('Content-Type', 'multipart/form-data')
            .attach('profileImage', path);
          expect(response.status).toBe(403);
        });
        it('Should return 201, if candidate uploads his profile picture', async () => {
          const response: APIResponse<
            UserProfilesController['uploadProfileImage']
          > = await request(server)
            .post(`${route}/profile/uploadImage/${loggedInCandidate.user.id}`)
            .set('authorization', `Bearer ${loggedInCandidate.token}`)
            .set('Content-Type', 'multipart/form-data')
            .attach('profileImage', path);
          expect(response.status).toBe(201);
        });
        it('Should return 201, if referer uploads his profile picture', async () => {
          const response: APIResponse<
            UserProfilesController['uploadProfileImage']
          > = await request(server)
            .post(`${route}/profile/uploadImage/${loggedInReferer.user.id}`)
            .set('authorization', `Bearer ${loggedInReferer.token}`)
            .set('Content-Type', 'multipart/form-data')
            .attach('profileImage', path);
          expect(response.status).toBe(201);
        });
        it('Should return 400, if candidate uploads empty profile picture', async () => {
          const response: APIResponse<
            UserProfilesController['uploadProfileImage']
          > = await request(server)
            .post(`${route}/profile/uploadImage/${loggedInCandidate.user.id}`)
            .set('authorization', `Bearer ${loggedInCandidate.token}`)
            .set('Content-Type', 'multipart/form-data');
          expect(response.status).toBe(400);
        });
        it('Should return 201, if coach uploads his profile picture', async () => {
          const response: APIResponse<
            UserProfilesController['uploadProfileImage']
          > = await request(server)
            .post(`${route}/profile/uploadImage/${loggedInCoach.user.id}`)
            .set('authorization', `Bearer ${loggedInCoach.token}`)
            .set('Content-Type', 'multipart/form-data')
            .attach('profileImage', path);
          expect(response.status).toBe(201);
        });
        it('Should return 400, if coach uploads empty profile picture', async () => {
          const response: APIResponse<
            UserProfilesController['uploadProfileImage']
          > = await request(server)
            .post(`${route}/profile/uploadImage/${loggedInCoach.user.id}`)
            .set('authorization', `Bearer ${loggedInCoach.token}`)
            .set('Content-Type', 'multipart/form-data');
          expect(response.status).toBe(400);
        });
      });
    });
  });

  describe('UserProfiles Refering Context', () => {
    describe('GET /user/profile/refered', () => {
      describe('/profile/refered?limit=&offset= - Read only candidates that current user refered', () => {
        let loggedInReferer: LoggedUser;
        beforeEach(async () => {
          loggedInReferer = await usersHelper.createLoggedInUser({
            role: UserRoles.REFERER,
          });
        });

        it('Should return 401 if user is not logged in', async () => {
          const response: APIResponse<
            UserProfilesController['findReferedCandidates']
          > = await request(server).get(
            `${route}/profile/refered?limit=25&offset=0`
          );
          expect(response.status).toBe(401);
        });

        it('Should return 200 and empty list if user is logged in as referer but has no candidate refered', async () => {
          const loggedInReferer = await usersHelper.createLoggedInUser({
            role: UserRoles.REFERER,
          });
          const response: APIResponse<
            UserProfilesController['findReferedCandidates']
          > = await request(server)
            .get(`${route}/profile/refered?limit=25&offset=0`)
            .set('authorization', `Bearer ${loggedInReferer.token}`);
          expect(response.status).toBe(200);
          expect(response.body).toEqual([]);
        });

        it('Should return 200 and sorted list of candidates refered by current user', async () => {
          // Initialize referableCandidates
          const referedCandidates = await databaseHelper.createEntities(
            userFactory,
            3,
            {
              role: UserRoles.CANDIDATE,
              zone: AdminZones.LILLE,
              refererId: loggedInReferer.user.id,
            },
            {}
          );

          const response: APIResponse<
            UserProfilesController['findReferedCandidates']
          > = await request(server)
            .get(`${route}/profile/refered?limit=25&offset=0`)
            .set('authorization', `Bearer ${loggedInReferer.token}`);
          expect(response.status).toBe(200);
          expect(response.body.length).toBe(referedCandidates.length);
          expect(response.body).toEqual(
            referedCandidates
              .sort((userA, userB) =>
                moment(userB.createdAt).diff(userA.createdAt)
              )
              .map((user) =>
                expect.objectContaining(
                  userProfilesHelper.mapUserProfileFromUser(user)
                )
              )
          );
        });

        it('Should return 200 and sorted list of candidates refered by current user with limit = 1 and offset = 1', async () => {
          // Initialize referableCandidates
          const referedCandidates = await databaseHelper.createEntities(
            userFactory,
            3,
            {
              role: UserRoles.CANDIDATE,
              zone: AdminZones.LILLE,
              refererId: loggedInReferer.user.id,
            },
            {}
          );

          const response: APIResponse<
            UserProfilesController['findReferedCandidates']
          > = await request(server)
            .get(`${route}/profile/refered?limit=1&offset=1`)
            .set('authorization', `Bearer ${loggedInReferer.token}`);
          const sortedReferedCandidates = referedCandidates.sort(
            (userA, userB) => moment(userB.createdAt).diff(userA.createdAt)
          );
          expect(response.status).toBe(200);
          expect(response.body.length).toBe(1);
          expect(response.body).toEqual(
            [sortedReferedCandidates[1]].map((user) =>
              expect.objectContaining(
                userProfilesHelper.mapUserProfileFromUser(user)
              )
            )
          );
        });

        it('Should return 200 and only own refered candidates', async () => {
          // Candidates of referer
          const referedCandidates = await databaseHelper.createEntities(
            userFactory,
            3,
            {
              role: UserRoles.CANDIDATE,
              zone: AdminZones.LILLE,
              refererId: loggedInReferer.user.id,
            },
            {}
          );

          // Create other referer and his candidates
          const otherLoggedInReferer = await usersHelper.createLoggedInUser({
            role: UserRoles.REFERER,
          });
          await databaseHelper.createEntities(
            userFactory,
            5,
            {
              role: UserRoles.CANDIDATE,
              zone: AdminZones.PARIS,
              refererId: otherLoggedInReferer.user.id,
            },
            {}
          );

          const response: APIResponse<
            UserProfilesController['findReferedCandidates']
          > = await request(server)
            .get(`${route}/profile/refered?limit=25&offset=0`)
            .set('authorization', `Bearer ${loggedInReferer.token}`);
          expect(response.status).toBe(200);
          expect(response.body.length).toBe(referedCandidates.length);
          expect(response.body).toEqual(
            referedCandidates
              .sort((userA, userB) =>
                moment(userB.createdAt).diff(userA.createdAt)
              )
              .map((user) =>
                expect.objectContaining(
                  userProfilesHelper.mapUserProfileFromUser(user)
                )
              )
          );
        });

        it('Should return 403 if user is logged in as candidate', async () => {
          const loggedInCandidate = await usersHelper.createLoggedInUser({
            role: UserRoles.CANDIDATE,
          });
          const response: APIResponse<
            UserProfilesController['findReferedCandidates']
          > = await request(server)
            .get(`${route}/profile/refered?limit=25&offset=0`)
            .set('authorization', `Bearer ${loggedInCandidate.token}`);
          expect(response.status).toBe(403);
        });

        it('Should return 403 if user is logged in as coach', async () => {
          const loggedInCoach = await usersHelper.createLoggedInUser({
            role: UserRoles.COACH,
          });
          const response: APIResponse<
            UserProfilesController['findReferedCandidates']
          > = await request(server)
            .get(`${route}/profile/refered?limit=25&offset=0`)
            .set('authorization', `Bearer ${loggedInCoach.token}`);
          expect(response.status).toBe(403);
        });

        it('Should return 403 if user is logged in as admin', async () => {
          const loggedInAdmin = await usersHelper.createLoggedInUser({
            role: UserRoles.ADMIN,
          });
          const response: APIResponse<
            UserProfilesController['findReferedCandidates']
          > = await request(server)
            .get(`${route}/profile/refered?limit=25&offset=0`)
            .set('authorization', `Bearer ${loggedInAdmin.token}`);
          expect(response.status).toBe(403);
        });
      });
    });
  });

  describe('UserProfiles Recommendations Context', () => {
    describe('GET /user/profile/recommendations/:userId - Get user recommendations', () => {
      let loggedInAdmin: LoggedUser;
      let loggedInCandidate: LoggedUser;
      let loggedInCoach: LoggedUser;
      let loggedInReferer: LoggedUser;

      beforeEach(async () => {
        loggedInAdmin = await usersHelper.createLoggedInUser({
          role: UserRoles.ADMIN,
        });
        loggedInCandidate = await usersHelper.createLoggedInUser({
          role: UserRoles.CANDIDATE,
        });
        loggedInCoach = await usersHelper.createLoggedInUser({
          role: UserRoles.COACH,
        });
        loggedInReferer = await usersHelper.createLoggedInUser({
          role: UserRoles.REFERER,
        });

        ({ loggedInCoach, loggedInCandidate } =
          await userCandidatsHelper.associateCoachAndCandidate(
            loggedInCoach,
            loggedInCandidate,
            true
          ));
      });

      it('Should return 401, if user not logged in', async () => {
        const response: APIResponse<
          UserProfilesController['findRecommendationsByUserId']
        > = await request(server).get(
          `${route}/profile/recommendations/${loggedInCandidate.user.id}`
        );

        expect(response.status).toBe(401);
      });

      it('Should return 403, if admin gets recommendations for another user', async () => {
        const response: APIResponse<
          UserProfilesController['findRecommendationsByUserId']
        > = await request(server)
          .get(`${route}/profile/recommendations/${loggedInCandidate.user.id}`)
          .set('authorization', `Bearer ${loggedInAdmin.token}`);
        expect(response.status).toBe(403);
      });

      it('Should return 403, if admin gets his recommendations', async () => {
        const response: APIResponse<
          UserProfilesController['findRecommendationsByUserId']
        > = await request(server)
          .get(`${route}/profile/recommendations/${loggedInAdmin.user.id}`)
          .set('authorization', `Bearer ${loggedInAdmin.token}`);
        expect(response.status).toBe(403);
      });

      it('Should return 403, if coach gets recommendations for another user', async () => {
        const response: APIResponse<
          UserProfilesController['findRecommendationsByUserId']
        > = await request(server)
          .get(`${route}/profile/recommendations/${loggedInCandidate.user.id}`)
          .set('authorization', `Bearer ${loggedInCoach.token}`);
        expect(response.status).toBe(403);
      });

      it('Should return 403, if referer gets recommendations for another user', async () => {
        const response: APIResponse<
          UserProfilesController['findRecommendationsByUserId']
        > = await request(server)
          .get(`${route}/profile/recommendations/${loggedInCandidate.user.id}`)
          .set('authorization', `Bearer ${loggedInReferer.token}`);
        expect(response.status).toBe(403);
      });

      it('Should return 403, if candidate gets recommendations for another user', async () => {
        const response: APIResponse<
          UserProfilesController['findRecommendationsByUserId']
        > = await request(server)
          .get(`${route}/profile/recommendations/${loggedInCoach.user.id}`)
          .set('authorization', `Bearer ${loggedInCandidate.token}`);
        expect(response.status).toBe(403);
      });

      it('Should return 200 and actual recommendations, if coach gets his recent recommendations', async () => {
        loggedInCoach = await usersHelper.createLoggedInUser(
          {
            role: UserRoles.COACH,
            zone: AdminZones.LYON,
          },
          {
            userProfile: {
              department: 'Rhône (69)',
              currentJob: 'peintre',
              isAvailable: true,
              sectorOccupations: [
                {
                  businessSectorId: businessSector1.id,
                },
              ],
              nudges: [{ id: nudgeInterview.id }],
              lastRecommendationsDate: moment().subtract(2, 'day').toDate(),
            },
          }
        );

        const usersToRecommend = await databaseHelper.createEntities(
          userFactory,
          3,
          {
            role: UserRoles.CANDIDATE,
            zone: AdminZones.LYON,
          },
          {
            userProfile: {
              department: 'Rhône (69)',
              isAvailable: true,
              sectorOccupations: [
                {
                  businessSectorId: businessSector1.id,
                  occupation: { name: 'peintre' },
                },
              ],
              nudges: [{ id: nudgeInterview.id }],
            },
          }
        );

        await userProfilesHelper.createUserProfileRecommendations(
          loggedInCoach.user.id,
          usersToRecommend.map(({ id }) => id)
        );

        const response: APIResponse<
          UserProfilesController['findRecommendationsByUserId']
        > = await request(server)
          .get(`${route}/profile/recommendations/${loggedInCoach.user.id}`)
          .set('authorization', `Bearer ${loggedInCoach.token}`);
        expect(response.status).toBe(200);
        expect(response.body).toEqual(
          usersToRecommend.map((user) =>
            expect.objectContaining(
              userProfilesHelper.mapUserProfileFromUser(user)
            )
          )
        );
      });

      it('Should return 200 and new recommendations, if coach gets his recent recommendations and one of the candidates is not available anymore', async () => {
        loggedInCoach = await usersHelper.createLoggedInUser(
          {
            role: UserRoles.COACH,
            zone: AdminZones.LYON,
          },
          {
            userProfile: {
              department: 'Rhône (69)',
              currentJob: 'peintre',
              isAvailable: true,
              sectorOccupations: [
                {
                  businessSectorId: businessSector1.id,
                },
              ],
              nudges: [{ id: nudgeInterview.id }],
              lastRecommendationsDate: moment().subtract(2, 'day').toDate(),
            },
          }
        );

        const stillAvailableUsers = await databaseHelper.createEntities(
          userFactory,
          2,
          {
            role: UserRoles.CANDIDATE,
            zone: AdminZones.LYON,
          },
          {
            userProfile: {
              department: 'Rhône (69)',
              isAvailable: true,
              sectorOccupations: [
                {
                  businessSectorId: businessSector1.id,
                  occupation: { name: 'peintre' },
                },
              ],
              nudges: [{ id: nudgeInterview.id }],
            },
          }
        );

        const userNotAvailable = await userFactory.create(
          {
            role: UserRoles.CANDIDATE,
            zone: AdminZones.LYON,
          },
          {
            userProfile: {
              department: 'Rhône (69)',
              isAvailable: false,
              sectorOccupations: [
                {
                  businessSectorId: businessSector1.id,
                  occupation: { name: 'peintre' },
                },
              ],
              nudges: [{ id: nudgeInterview.id }],
            },
          }
        );

        const oldRecommendedUsers = [
          ...stillAvailableUsers,
          userNotAvailable,
        ].sort((userA, userB) => moment(userB.createdAt).diff(userA.createdAt));

        const userAvailable = await userFactory.create(
          {
            role: UserRoles.CANDIDATE,
            zone: AdminZones.LYON,
          },
          {
            userProfile: {
              department: 'Rhône (69)',
              isAvailable: true,
              sectorOccupations: [
                {
                  businessSectorId: businessSector1.id,
                  occupation: { name: 'peintre' },
                },
              ],
              nudges: [{ id: nudgeInterview.id }],
            },
          }
        );

        const usersToRecommend = [...stillAvailableUsers, userAvailable];

        await userProfilesHelper.createUserProfileRecommendations(
          loggedInCoach.user.id,
          oldRecommendedUsers.map(({ id }) => id)
        );

        const response: APIResponse<
          UserProfilesController['findRecommendationsByUserId']
        > = await request(server)
          .get(`${route}/profile/recommendations/${loggedInCoach.user.id}`)
          .set('authorization', `Bearer ${loggedInCoach.token}`);
        expect(response.status).toBe(200);
        expect(response.body).toEqual(
          usersToRecommend.map((user) =>
            expect.objectContaining(
              userProfilesHelper.mapUserProfileFromUser(user)
            )
          )
        );
      });

      it('Should return 200 and new recommendations, if coach gets his old recommendations', async () => {
        loggedInCoach = await usersHelper.createLoggedInUser(
          {
            role: UserRoles.COACH,
            zone: AdminZones.LILLE,
          },
          {
            userProfile: {
              department: 'Nord (59)',
              currentJob: 'Développeur',
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
                { id: nudgeEvent.id },
              ],

              lastRecommendationsDate: moment().subtract(2, 'week').toDate(),
            },
          }
        );

        const candidateSameRegion = await userFactory.create(
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
                  occupation: { name: 'Développeur' },
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
                { id: nudgeEvent.id },
              ],
            },
          }
        );

        const candidate2BusinessSectorsInCommon = await userFactory.create(
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
                  occupation: { name: 'Développeur' },
                  order: 1,
                },
                {
                  businessSectorId: businessSector2.id,
                  order: 2,
                },
                {
                  businessSectorId: businessSector4.id,
                  order: 3,
                },
              ],
              nudges: [
                { id: nudgeTips.id },
                { id: nudgeNetwork.id },
                { id: nudgeEvent.id },
              ],
            },
          }
        );

        const candidate2HelpsInCommon = await userFactory.create(
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
                  occupation: { name: 'Développeur' },
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
                { id: nudgeCv.id },
                { id: nudgeNetwork.id },
              ],
            },
          }
        );

        const newUsersToRecommend = [
          candidateSameRegion,
          candidate2BusinessSectorsInCommon,
          candidate2HelpsInCommon,
        ];

        // Candidate wrong departement
        await userFactory.create(
          {
            role: UserRoles.CANDIDATE,
            zone: AdminZones.PARIS,
          },
          {
            userProfile: {
              department: 'Paris (75)',
              isAvailable: true,
              sectorOccupations: [
                {
                  businessSectorId: businessSector1.id,
                  occupation: { name: 'Développeur' },
                },
                {
                  businessSectorId: businessSector2.id,
                },
                {
                  businessSectorId: businessSector3.id,
                },
              ],
              nudges: [
                { id: nudgeTips.id },
                { id: nudgeNetwork.id },
                { id: nudgeEvent.id },
              ],
            },
          }
        );

        // Candidate no helps in common
        await userFactory.create(
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
                  occupation: { name: 'Développeur' },
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
              nudges: [{ id: nudgeInterview.id }, { id: nudgeCv.id }],
            },
          }
        );

        // Candidate 1 help in common
        await userFactory.create(
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
                  occupation: { name: 'Développeur' },
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
                { id: nudgeInterview.id },
                { id: nudgeCv.id },
                { id: nudgeNetwork.id },
              ],
            },
          }
        );

        // Candidate no business lines in common
        await userFactory.create(
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
                  businessSectorId: businessSector2.id,
                  occupation: { name: 'Développeur' },
                },
                {
                  businessSectorId: businessSector4.id,
                },
                {
                  businessSectorId: businessSector5.id,
                },
              ],
              nudges: [
                { id: nudgeTips.id },
                { id: nudgeNetwork.id },
                { id: nudgeEvent.id },
              ],
            },
          }
        );

        // Candidate 1 business line in common
        await userFactory.create(
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
                  occupation: { name: 'Développeur' },
                  order: 1,
                },
                {
                  businessSectorId: businessSector5.id,
                  order: 2,
                },
                {
                  businessSectorId: businessSector6.id,
                  order: 3,
                },
              ],
              nudges: [
                { id: nudgeTips.id },
                { id: nudgeNetwork.id },
                { id: nudgeEvent.id },
              ],
            },
          }
        );

        // Candidate not available
        await userFactory.create(
          {
            role: UserRoles.CANDIDATE,
            zone: AdminZones.LILLE,
          },
          {
            userProfile: {
              department: 'Nord (59)',
              isAvailable: false,
              sectorOccupations: [
                {
                  businessSectorId: businessSector1.id,
                  occupation: { name: 'Développeur' },
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
                { id: nudgeEvent.id },
              ],
            },
          }
        );

        // Coach same profile
        await userFactory.create(
          {
            role: UserRoles.COACH,
            zone: AdminZones.LILLE,
          },
          {
            userProfile: {
              department: 'Nord (59)',
              currentJob: 'Développeur',
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
                { id: nudgeEvent.id },
              ],
            },
          }
        );

        const oldRecommendedCandidatesWithOnly2BusinessSectorsAndHelpsInCommon =
          await databaseHelper.createEntities(
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
                    occupation: { name: 'Développeur' },
                    order: 1,
                  },
                  {
                    businessSectorId: businessSector2.id,
                    order: 2,
                  },
                  {
                    businessSectorId: businessSector6.id,
                    order: 3,
                  },
                ],
                nudges: [
                  { id: nudgeTips.id },
                  { id: nudgeInterview.id },
                  { id: nudgeNetwork.id },
                ],
              },
            }
          );

        await userProfilesHelper.createUserProfileRecommendations(
          loggedInCoach.user.id,
          oldRecommendedCandidatesWithOnly2BusinessSectorsAndHelpsInCommon.map(
            ({ id }) => id
          )
        );

        const response: APIResponse<
          UserProfilesController['findRecommendationsByUserId']
        > = await request(server)
          .get(`${route}/profile/recommendations/${loggedInCoach.user.id}`)
          .set('authorization', `Bearer ${loggedInCoach.token}`);
        expect(response.status).toBe(200);
        expect(response.body).toEqual(
          newUsersToRecommend.map((user) =>
            expect.objectContaining(
              userProfilesHelper.mapUserProfileFromUser(user)
            )
          )
        );
      });

      it('Should return 200, and actual recommendations, if candidate gets his recent recommendations', async () => {
        loggedInCandidate = await usersHelper.createLoggedInUser(
          {
            role: UserRoles.CANDIDATE,
            zone: AdminZones.LYON,
          },
          {
            userProfile: {
              department: 'Rhône (69)',
              isAvailable: true,
              sectorOccupations: [
                {
                  businessSectorId: businessSector1.id,
                  occupation: { name: 'menuisier' },
                },
              ],
              nudges: [{ id: nudgeInterview.id }],
              lastRecommendationsDate: moment().subtract(2, 'day').toDate(),
            },
          }
        );

        const usersToRecommend = await databaseHelper.createEntities(
          userFactory,
          3,
          {
            role: UserRoles.COACH,
            zone: AdminZones.LYON,
          },
          {
            userProfile: {
              department: 'Rhône (69)',
              isAvailable: true,
              currentJob: 'menuisier',
              sectorOccupations: [
                {
                  businessSectorId: businessSector1.id, // id
                },
              ],
              nudges: [{ id: nudgeInterview.id }],
            },
          }
        );

        await userProfilesHelper.createUserProfileRecommendations(
          loggedInCandidate.user.id,
          usersToRecommend.map(({ id }) => id)
        );

        const response: APIResponse<
          UserProfilesController['findRecommendationsByUserId']
        > = await request(server)
          .get(`${route}/profile/recommendations/${loggedInCandidate.user.id}`)
          .set('authorization', `Bearer ${loggedInCandidate.token}`);
        expect(response.status).toBe(200);
        expect(response.body).toEqual(
          usersToRecommend.map((user) =>
            expect.objectContaining(
              userProfilesHelper.mapUserProfileFromUser(user)
            )
          )
        );
      });

      it('Should return 200, and new recommendations, if candidate gets his recent recommendations and on of the coaches is not available anymore', async () => {
        loggedInCandidate = await usersHelper.createLoggedInUser(
          {
            role: UserRoles.CANDIDATE,
            zone: AdminZones.LYON,
          },
          {
            userProfile: {
              department: 'Rhône (69)',
              isAvailable: true,
              sectorOccupations: [
                {
                  businessSectorId: businessSector1.id,
                  occupation: { name: 'menuisier' },
                },
              ],
              nudges: [{ id: nudgeInterview.id }],
              lastRecommendationsDate: moment().subtract(2, 'day').toDate(),
            },
          }
        );

        const stillAvailableUsers = await databaseHelper.createEntities(
          userFactory,
          2,
          {
            role: UserRoles.COACH,
            zone: AdminZones.LYON,
          },
          {
            userProfile: {
              department: 'Rhône (69)',
              isAvailable: true,
              currentJob: 'menuisier',
              sectorOccupations: [
                {
                  businessSectorId: businessSector1.id, // id
                },
              ],
              nudges: [{ id: nudgeInterview.id }],
            },
          }
        );

        const userNotAvailable = await userFactory.create(
          {
            role: UserRoles.COACH,
            zone: AdminZones.LYON,
          },
          {
            userProfile: {
              department: 'Rhône (69)',
              isAvailable: false,
              currentJob: 'menuisier',
              sectorOccupations: [
                {
                  businessSectorId: businessSector1.id,
                },
              ],
              nudges: [{ id: nudgeInterview.id }],
            },
          }
        );

        const oldRecommendedUsers = [
          ...stillAvailableUsers,
          userNotAvailable,
        ].sort((userA, userB) => moment(userB.createdAt).diff(userA.createdAt));

        await userProfilesHelper.createUserProfileRecommendations(
          loggedInCandidate.user.id,
          oldRecommendedUsers.map(({ id }) => id)
        );

        const userAvailable = await userFactory.create(
          {
            role: UserRoles.COACH,
            zone: AdminZones.LYON,
          },
          {
            userProfile: {
              department: 'Rhône (69)',
              isAvailable: true,
              currentJob: 'menuisier',
              sectorOccupations: [
                {
                  businessSectorId: businessSector1.id,
                },
              ],
              nudges: [{ id: nudgeInterview.id }],
            },
          }
        );

        const usersToRecommend = [...stillAvailableUsers, userAvailable].sort(
          (userA, userB) => moment(userA.createdAt).diff(userB.createdAt)
        );

        const response: APIResponse<
          UserProfilesController['findRecommendationsByUserId']
        > = await request(server)
          .get(`${route}/profile/recommendations/${loggedInCandidate.user.id}`)
          .set('authorization', `Bearer ${loggedInCandidate.token}`);
        expect(response.status).toBe(200);
        expect(response.body).toEqual(
          usersToRecommend.map((user) =>
            expect.objectContaining(
              userProfilesHelper.mapUserProfileFromUser(user)
            )
          )
        );
      });

      it('Should return 200, and new recommendations, if candidate gets his old recommendations', async () => {
        loggedInCandidate = await usersHelper.createLoggedInUser(
          {
            firstName: 'me',
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
                  occupation: { name: 'Développeur' },
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
                { id: nudgeEvent.id },
              ],
              lastRecommendationsDate: moment().subtract(2, 'week').toDate(),
            },
          }
        );

        const coachSameRegion = await userFactory.create(
          {
            role: UserRoles.COACH,
            zone: AdminZones.LILLE,
          },
          {
            userProfile: {
              department: 'Nord (59)',
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
                { id: nudgeEvent.id },
              ],
            },
          }
        );

        const coach2BusinessSectorsInCommon = await userFactory.create(
          {
            role: UserRoles.COACH,
            zone: AdminZones.LILLE,
          },
          {
            userProfile: {
              department: 'Nord (59)',
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
                  businessSectorId: businessSector4.id,
                  order: 3,
                },
              ],
              nudges: [
                { id: nudgeTips.id },
                { id: nudgeNetwork.id },
                { id: nudgeEvent.id },
              ],
            },
          }
        );

        const coach2HelpsInCommon = await userFactory.create(
          {
            firstName: 'coach2HelpsInCommon',
            role: UserRoles.COACH,
            zone: AdminZones.LILLE,
          },
          {
            userProfile: {
              department: 'Nord (59)',
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
                { id: nudgeCv.id },
                { id: nudgeNetwork.id },
              ],
            },
          }
        );

        const newUsersToRecommend = [
          coachSameRegion,
          coach2BusinessSectorsInCommon,
          coach2HelpsInCommon,
        ];

        // Coach wrong department
        await userFactory.create(
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
                { id: nudgeEvent.id },
              ],
            },
          }
        );

        // Coach no helps in common
        await userFactory.create(
          {
            role: UserRoles.COACH,
            zone: AdminZones.LILLE,
          },
          {
            userProfile: {
              department: 'Nord (59)',
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
              nudges: [{ id: nudgeInterview.id }, { id: nudgeCv.id }],
            },
          }
        );

        // Coach 1 help in common
        await userFactory.create(
          {
            firstName: 'oneHelpInCommon',
            role: UserRoles.COACH,
            zone: AdminZones.LILLE,
          },
          {
            userProfile: {
              department: 'Nord (59)',
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
                { id: nudgeInterview.id },
                { id: nudgeCv.id },
                { id: nudgeNetwork.id },
              ],
            },
          }
        );

        // Coach no business lines in common
        await userFactory.create(
          {
            role: UserRoles.COACH,
            zone: AdminZones.LILLE,
          },
          {
            userProfile: {
              department: 'Nord (59)',
              isAvailable: true,
              currentJob: 'Développeur',
              sectorOccupations: [
                {
                  businessSectorId: businessSector2.id,
                  order: 1,
                },
                {
                  businessSectorId: businessSector4.id,
                  order: 2,
                },
                {
                  businessSectorId: businessSector5.id,
                  order: 3,
                },
              ],
              nudges: [
                { id: nudgeTips.id },
                { id: nudgeNetwork.id },
                { id: nudgeEvent.id },
              ],
            },
          }
        );

        // Coach 1 business line in common
        await userFactory.create(
          {
            role: UserRoles.COACH,
            zone: AdminZones.LILLE,
          },
          {
            userProfile: {
              department: 'Nord (59)',
              isAvailable: true,
              currentJob: 'Développeur',
              sectorOccupations: [
                {
                  businessSectorId: businessSector1.id,
                  order: 1,
                },
                {
                  businessSectorId: businessSector5.id,
                  order: 2,
                },
                {
                  businessSectorId: businessSector6.id,
                  order: 3,
                },
              ],
              nudges: [
                { id: nudgeTips.id },
                { id: nudgeNetwork.id },
                { id: nudgeEvent.id },
              ],
            },
          }
        );

        // Coach not available
        await userFactory.create(
          {
            role: UserRoles.COACH,
            zone: AdminZones.LILLE,
          },
          {
            userProfile: {
              department: 'Nord (59)',
              isAvailable: false,
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
                { id: nudgeEvent.id },
              ],
            },
          }
        );

        // Candidate same profile
        await userFactory.create(
          {
            firstName: 'sameProfile',
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
                  occupation: { name: 'Développeur' },
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
                { id: nudgeEvent.id },
              ],
            },
          }
        );

        const oldRecommendedCoachesWithOnly2BusinessSectorsAndHelpsInCommon =
          await databaseHelper.createEntities(
            userFactory,
            3,
            {
              role: UserRoles.COACH,
              zone: AdminZones.LILLE,
            },
            {
              userProfile: {
                department: 'Nord (59)',
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
                    businessSectorId: businessSector6.id,
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

        await userProfilesHelper.createUserProfileRecommendations(
          loggedInCandidate.user.id,
          oldRecommendedCoachesWithOnly2BusinessSectorsAndHelpsInCommon.map(
            ({ id }) => id
          )
        );

        const response: APIResponse<
          UserProfilesController['findRecommendationsByUserId']
        > = await request(server)
          .get(`${route}/profile/recommendations/${loggedInCandidate.user.id}`)
          .set('authorization', `Bearer ${loggedInCandidate.token}`);
        expect(response.status).toBe(200);
        expect(response.body.length).toBe(newUsersToRecommend.length);
        expect(response.body).toEqual(
          newUsersToRecommend.map((user) =>
            expect.objectContaining(
              userProfilesHelper.mapUserProfileFromUser(user)
            )
          )
        );
      });
    });
  });
});
