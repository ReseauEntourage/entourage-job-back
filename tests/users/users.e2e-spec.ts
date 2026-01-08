/* eslint-disable no-console */
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { v4 as uuid } from 'uuid';
import { QueueMocks, S3Mocks } from '../mocks.types';
import { LoggedUser } from 'src/auth/auth.types';
import { BusinessSector } from 'src/common/business-sectors/models';
import { S3Service } from 'src/external-services/aws/s3.service';
import { QueuesService } from 'src/queues/producers/queues.service';
import { UsersController } from 'src/users/users.controller';
import { UserRoles } from 'src/users/users.types';
import { APIResponse } from 'src/utils/types';
import { ZoneName } from 'src/utils/types/zones.types';
import { BusinessSectorHelper } from 'tests/business-sectors/business-sector.helper';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import { OrganizationFactory } from 'tests/organizations/organization.factory';
import { QueuesServiceMock } from 'tests/queues/queues.service.mock';
import { UserFactory } from './user.factory';
import { UsersHelper } from './users.helper';

describe('Users', () => {
  let app: INestApplication;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let server: any;

  let databaseHelper: DatabaseHelper;
  let userFactory: UserFactory;
  let usersHelper: UsersHelper;
  let organizationFactory: OrganizationFactory;
  let businessSectorsHelper: BusinessSectorHelper;

  let businessSector1: BusinessSector;
  let businessSector2: BusinessSector;

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
    businessSectorsHelper =
      moduleFixture.get<BusinessSectorHelper>(BusinessSectorHelper);
    userFactory = moduleFixture.get<UserFactory>(UserFactory);
    organizationFactory =
      moduleFixture.get<OrganizationFactory>(OrganizationFactory);
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

  describe('CRUD User', () => {
    describe('R - Read 1 User', () => {
      describe('/:id - Get a user by id or email', () => {
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
        });
        it('Should return 401 when the user is not logged in', async () => {
          const candidate = await userFactory.create(
            {
              role: UserRoles.CANDIDATE,
            },
            {},
            true
          );
          const response: APIResponse<UsersController['findUser']> =
            await request(server).get(`${route}/${candidate.email}`);
          expect(response.status).toBe(401);
        });
        it('Should return 200 when logged in candidate gets himself', async () => {
          const response: APIResponse<UsersController['findUser']> =
            await request(server)
              .get(`${route}/${loggedInCandidate.user.email}`)
              .set('authorization', `Bearer ${loggedInCandidate.token}`);
          expect(response.status).toBe(200);
          expect(response.body.email).toEqual(loggedInCandidate.user.email);
        });
        it('Should return 200 when logged in coach get himself', async () => {
          const response: APIResponse<UsersController['findUser']> =
            await request(server)
              .get(`${route}/${loggedInCoach.user.email}`)
              .set('authorization', `Bearer ${loggedInCoach.token}`);
          expect(response.status).toBe(200);
          expect(response.body.email).toEqual(loggedInCoach.user.email);
        });
        it('Should return 200 when logged in referer gets himself', async () => {
          const response: APIResponse<UsersController['findUser']> =
            await request(server)
              .get(`${route}/${loggedInReferer.user.email}`)
              .set('authorization', `Bearer ${loggedInReferer.token}`);
          expect(response.status).toBe(200);
          expect(response.body.email).toEqual(loggedInReferer.user.email);
        });
        it('Should return 403 when logged in coach get a candidate', async () => {
          const response: APIResponse<UsersController['findUser']> =
            await request(server)
              .get(`${route}/${loggedInCandidate.user.email}`)
              .set('authorization', `Bearer ${loggedInCoach.token}`);
          expect(response.status).toBe(403);
        });
        it('Should return 403 when logged in referer get a candidate', async () => {
          const response: APIResponse<UsersController['findUser']> =
            await request(server)
              .get(`${route}/${loggedInCandidate.user.email}`)
              .set('authorization', `Bearer ${loggedInReferer.token}`);
          expect(response.status).toBe(403);
        });
        it('Should return 200 and get a user by email when logged in as admin', async () => {
          const response: APIResponse<UsersController['findUser']> =
            await request(server)
              .get(`${route}/${loggedInCandidate.user.email}`)
              .set('authorization', `Bearer ${loggedInAdmin.token}`);
          expect(response.status).toBe(200);
          const receivedUser = response.body;
          expect(receivedUser.email).toEqual(loggedInCandidate.user.email);
        });
        it('Should return 200 and get a user by id when logged in as admin', async () => {
          const response: APIResponse<UsersController['findUser']> =
            await request(server)
              .get(`${route}/${loggedInCandidate.user.id}`)
              .set('authorization', `Bearer ${loggedInAdmin.token}`);
          expect(response.status).toBe(200);
          expect(response.body.id).toEqual(loggedInCandidate.user.id);
        });
        it('Should return 404 if user not found', async () => {
          const response: APIResponse<UsersController['findUser']> =
            await request(server)
              .get(`${route}/${uuid()}`)
              .set('authorization', `Bearer ${loggedInAdmin.token}`);
          expect(response.status).toBe(404);
        });
      });
    });

    describe('R - Read many Users', () => {
      describe('/members - Read all members', () => {
        it('Should return 401 if user is not logged in', async () => {
          const response: APIResponse<UsersController['findMembers']> =
            await request(server).get(`${route}/members`);
          expect(response.status).toBe(401);
        });
        it('Should return 403 if user is not a logged in admin', async () => {
          const loggedInCandidate = await usersHelper.createLoggedInUser({
            role: UserRoles.CANDIDATE,
          });

          const response: APIResponse<UsersController['findMembers']> =
            await request(server)
              .get(`${route}/members`)
              .set('authorization', `Bearer ${loggedInCandidate.token}`);
          expect(response.status).toBe(403);
        });
        describe('/members?limit=&offset=&role[]= - Get paginated and alphabetically sorted users filtered by role', () => {
          let loggedInAdmin: LoggedUser;

          beforeEach(async () => {
            loggedInAdmin = await usersHelper.createLoggedInUser({
              role: UserRoles.ADMIN,
            });
            await userFactory.create({
              role: UserRoles.CANDIDATE,
              firstName: 'A',
            });
            await userFactory.create({
              role: UserRoles.CANDIDATE,
              firstName: 'B',
            });
            await userFactory.create({
              role: UserRoles.CANDIDATE,
              firstName: 'C',
            });
            await userFactory.create({
              role: UserRoles.CANDIDATE,
              firstName: 'D',
            });
            await userFactory.create({
              role: UserRoles.CANDIDATE,
              firstName: 'E',
            });
            await userFactory.create({
              role: UserRoles.COACH,
              firstName: 'A',
            });
            await userFactory.create({
              role: UserRoles.COACH,
              firstName: 'B',
            });
            await userFactory.create({
              role: UserRoles.COACH,
              firstName: 'C',
            });
            await userFactory.create({
              role: UserRoles.COACH,
              firstName: 'D',
            });
            await userFactory.create({
              role: UserRoles.COACH,
              firstName: 'E',
            });
          });
          it('Should return 200 and 2 first candidates', async () => {
            const response: APIResponse<UsersController['findMembers']> =
              await request(server)
                .get(
                  `${route}/members?limit=2&offset=0&role[]=${UserRoles.CANDIDATE}`
                )
                .set('authorization', `Bearer ${loggedInAdmin.token}`);
            expect(response.status).toBe(200);
            expect(response.body.length).toBe(2);
            expect(response.body.map(({ role }) => role)).toStrictEqual([
              UserRoles.CANDIDATE,
              UserRoles.CANDIDATE,
            ]);
            expect(response.body[0].firstName).toMatch('A');
            expect(response.body[1].firstName).toMatch('B');
          });
          it('Should return 200 and 3 first coaches', async () => {
            const response: APIResponse<UsersController['findMembers']> =
              await request(server)
                .get(
                  `${route}/members?limit=3&offset=0&role[]=${UserRoles.COACH}`
                )
                .set('authorization', `Bearer ${loggedInAdmin.token}`);
            expect(response.status).toBe(200);
            expect(response.body.length).toBe(3);
            expect(response.body.map(({ role }) => role)).toStrictEqual([
              UserRoles.COACH,
              UserRoles.COACH,
              UserRoles.COACH,
            ]);
            expect(response.body[0].firstName).toMatch('A');
            expect(response.body[1].firstName).toMatch('B');
            expect(response.body[2].firstName).toMatch('C');
          });
          it('Should return 200 and the 3rd and 4th candidate', async () => {
            const response: APIResponse<UsersController['findMembers']> =
              await request(server)
                .get(
                  `${route}/members?limit=2&offset=2&role[]=${UserRoles.CANDIDATE}`
                )
                .set('authorization', `Bearer ${loggedInAdmin.token}`);
            expect(response.status).toBe(200);
            expect(response.body.length).toBe(2);
            expect(response.body.map(({ role }) => role)).toStrictEqual([
              UserRoles.CANDIDATE,
              UserRoles.CANDIDATE,
            ]);
            expect(response.body[0].firstName).toMatch('C');
            expect(response.body[1].firstName).toMatch('D');
          });
          it('Should return 200 and the 3rd and 4th coach', async () => {
            const response: APIResponse<UsersController['findMembers']> =
              await request(server)
                .get(
                  `${route}/members?limit=2&offset=2&role[]=${UserRoles.COACH}`
                )
                .set('authorization', `Bearer ${loggedInAdmin.token}`);
            expect(response.status).toBe(200);
            expect(response.body.length).toBe(2);
            expect(response.body.map(({ role }) => role)).toStrictEqual([
              UserRoles.COACH,
              UserRoles.COACH,
            ]);
            expect(response.body[0].firstName).toMatch('C');
            expect(response.body[1].firstName).toMatch('D');
          });
        });
        describe('/members?query= - Read all members with search query', () => {
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

            const response: APIResponse<UsersController['findMembers']> =
              await request(server)
                .get(
                  `${route}/members?limit=50&offset=0&role[]=${UserRoles.CANDIDATE}&query=XXX`
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

            const response: APIResponse<UsersController['findMembers']> =
              await request(server)
                .get(
                  `${route}/members?limit=50&offset=0&role[]=${UserRoles.COACH}&query=XXX`
                )
                .set('authorization', `Bearer ${loggedInAdmin.token}`);
            expect(response.status).toBe(200);
            expect(response.body.length).toBe(2);
            expect(expectedCoaches.map(({ id }) => id)).toEqual(
              expect.arrayContaining(response.body.map(({ id }) => id))
            );
          });
        });
        describe('/members?zone[]=&hidden[]=&businessSectors[]= - Read all members as admin with filters', () => {
          let loggedInAdmin: LoggedUser;
          beforeEach(async () => {
            loggedInAdmin = await usersHelper.createLoggedInUser({
              role: UserRoles.ADMIN,
            });
          });
          it('Should return 200, and all the candidates that matches the zone filter', async () => {
            const lyonCandidates = await databaseHelper.createEntities(
              userFactory,
              2,
              {
                role: UserRoles.CANDIDATE,
                zone: ZoneName.AURA,
              }
            );
            const parisCandidates = await databaseHelper.createEntities(
              userFactory,
              2,
              {
                role: UserRoles.CANDIDATE,
                zone: ZoneName.IDF,
              }
            );
            await databaseHelper.createEntities(userFactory, 2, {
              role: UserRoles.CANDIDATE,
              zone: ZoneName.NORD,
            });

            await databaseHelper.createEntities(userFactory, 2, {
              role: UserRoles.COACH,
              zone: ZoneName.AURA,
            });

            const expectedCandidatesIds = [
              ...lyonCandidates.map(({ id }) => id),
              ...parisCandidates.map(({ id }) => id),
            ];

            const response: APIResponse<UsersController['findMembers']> =
              await request(server)
                .get(
                  `${route}/members?limit=50&offset=0&role[]=${UserRoles.CANDIDATE}&zone[]=${ZoneName.AURA}&zone[]=${ZoneName.IDF}`
                )
                .set('authorization', `Bearer ${loggedInAdmin.token}`);
            expect(response.status).toBe(200);
            expect(response.body.length).toBe(4);
            expect(expectedCandidatesIds).toEqual(
              expect.arrayContaining(response.body.map(({ id }) => id))
            );
          });
          it('Should return 200, and all the coaches that matches the zone filter', async () => {
            const lyonCoaches = await databaseHelper.createEntities(
              userFactory,
              2,
              {
                role: UserRoles.COACH,
                zone: ZoneName.AURA,
              }
            );
            const parisCoaches = await databaseHelper.createEntities(
              userFactory,
              2,
              {
                role: UserRoles.COACH,
                zone: ZoneName.IDF,
              }
            );
            await databaseHelper.createEntities(userFactory, 2, {
              role: UserRoles.COACH,
              zone: ZoneName.NORD,
            });

            await databaseHelper.createEntities(userFactory, 2, {
              role: UserRoles.CANDIDATE,
              zone: ZoneName.AURA,
            });

            const expectedCoachesIds = [
              ...lyonCoaches.map(({ id }) => id),
              ...parisCoaches.map(({ id }) => id),
            ];

            const response: APIResponse<UsersController['findMembers']> =
              await request(server)
                .get(
                  `${route}/members?limit=50&offset=0&role[]=${UserRoles.COACH}&zone[]=${ZoneName.AURA}&zone[]=${ZoneName.IDF}`
                )
                .set('authorization', `Bearer ${loggedInAdmin.token}`);
            expect(response.status).toBe(200);
            expect(response.body.length).toBe(4);
            expect(expectedCoachesIds).toEqual(
              expect.arrayContaining(response.body.map(({ id }) => id))
            );
          });
        });
        describe('/members - Read all members as admin with all filters', () => {
          let loggedInAdmin: LoggedUser;
          beforeEach(async () => {
            loggedInAdmin = await usersHelper.createLoggedInUser({
              role: UserRoles.ADMIN,
            });
          });
          it('Should return 200, and all the candidates that match all the filters', async () => {
            const organization = await organizationFactory.create({}, {}, true);

            const lyonAssociatedCandidates =
              await databaseHelper.createEntities(userFactory, 2, {
                firstName: 'XXX',
                role: UserRoles.CANDIDATE,
                zone: ZoneName.AURA,
                OrganizationId: organization.id,
              });

            const expectedCandidatesIds = [
              ...lyonAssociatedCandidates.map(({ id }) => id),
            ];

            const response: APIResponse<UsersController['findMembers']> =
              await request(server)
                .get(
                  `${route}/members?limit=50&offset=0&role[]=${UserRoles.CANDIDATE}&role[]=${UserRoles.CANDIDATE}&query=XXX&zone[]=${ZoneName.AURA}`
                )
                .set('authorization', `Bearer ${loggedInAdmin.token}`);
            expect(response.status).toBe(200);
            expect(response.body.length).toBe(2);
            expect(expectedCandidatesIds).toEqual(
              expect.arrayContaining(response.body.map(({ id }) => id))
            );
          });
          it('Should return 200, and all the coaches that match all the filters', async () => {
            const organization = await organizationFactory.create({}, {}, true);

            const lyonAssociatedCoaches = await databaseHelper.createEntities(
              userFactory,
              2,
              {
                firstName: 'XXX',
                role: UserRoles.COACH,
                zone: ZoneName.AURA,
                OrganizationId: organization.id,
              }
            );

            const expectedCoachesIds = [
              ...lyonAssociatedCoaches.map(({ id }) => id),
            ];

            const response: APIResponse<UsersController['findMembers']> =
              await request(server)
                .get(
                  `${route}/members?limit=50&offset=0&role[]=${UserRoles.COACH}&query=XXX&zone[]=${ZoneName.AURA}`
                )
                .set('authorization', `Bearer ${loggedInAdmin.token}`);
            expect(response.status).toBe(200);
            expect(response.body.length).toBe(2);
            expect(expectedCoachesIds).toEqual(
              expect.arrayContaining(response.body.map(({ id }) => id))
            );
          });

          it('Should return 200, and all the referers that match all the filters', async () => {
            const organization = await organizationFactory.create({}, {}, true);

            const referers = await databaseHelper.createEntities(
              userFactory,
              2,
              {
                firstName: 'XXX',
                role: UserRoles.REFERER,
                zone: ZoneName.AURA,
                OrganizationId: organization.id,
              }
            );

            const expectedCoachesIds = [...referers.map(({ id }) => id)];

            const response: APIResponse<UsersController['findMembers']> =
              await request(server)
                .get(
                  `${route}/members?limit=50&offset=0&role[]=${UserRoles.REFERER}&query=XXX&zone[]=${ZoneName.AURA}`
                )
                .set('authorization', `Bearer ${loggedInAdmin.token}`);
            expect(response.status).toBe(200);
            expect(response.body.length).toBe(2);
            expect(expectedCoachesIds).toEqual(
              expect.arrayContaining(response.body.map(({ id }) => id))
            );
          });
        });

        describe('/members - Read all members as admin with businessSectorIds filters', () => {
          let loggedInAdmin: LoggedUser;
          beforeEach(async () => {
            loggedInAdmin = await usersHelper.createLoggedInUser({
              role: UserRoles.ADMIN,
            });
          });
          it('Should return 200, and all the candidates that match the businessSectorIds filter', async () => {
            const candidatesSector1 = await databaseHelper.createEntities(
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
                      businessSectorId: businessSector2.id,
                    },
                  ],
                },
              }
            );

            const expectedCandidatesIds = [
              ...candidatesSector1.map(({ id }) => id),
            ];

            const response: APIResponse<UsersController['findMembers']> =
              await request(server)
                .get(
                  `${route}/members?limit=50&offset=0&role[]=${UserRoles.CANDIDATE}&businessSectorIds[]=${businessSector1.id}`
                )
                .set('authorization', `Bearer ${loggedInAdmin.token}`);
            expect(response.status).toBe(200);
            expect(response.body.length).toBe(2);
            expect(expectedCandidatesIds).toEqual(
              expect.arrayContaining(response.body.map(({ id }) => id))
            );
          });
        });
      });
    });

    describe('U - Update 1 User', () => {
      describe('/:id - Update user', () => {
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
        });
        it('Should return 401 if user is not logged in', async () => {
          const updates = await userFactory.create({}, {}, false);
          const response: APIResponse<UsersController['updateUser']> =
            await request(server)
              .put(`${route}/${loggedInCandidate.user.id}`)
              .send({
                phone: updates.phone,
                firstName: updates.firstName,
              });
          expect(response.status).toBe(401);
        });

        it('Should return 200 and updated user when a candidate update himself', async () => {
          const updates = await userFactory.create({}, {}, false);
          const response: APIResponse<UsersController['updateUser']> =
            await request(server)
              .put(`${route}/${loggedInCandidate.user.id}`)
              .set('authorization', `Bearer ${loggedInCandidate.token}`)
              .send({
                phone: updates.phone,
                address: updates.address,
                email: updates.email,
                firstName: updates.firstName,
                lastName: updates.lastName,
              });
          expect(response.status).toBe(200);
          expect(response.body.phone).toEqual(updates.phone);
          expect(response.body.address).toEqual(updates.address);
        });
        it('Should return 200 and updated user when a referer update himself', async () => {
          const updates = await userFactory.create({}, {}, false);
          const response: APIResponse<UsersController['updateUser']> =
            await request(server)
              .put(`${route}/${loggedInReferer.user.id}`)
              .set('authorization', `Bearer ${loggedInReferer.token}`)
              .send({
                phone: updates.phone,
                address: updates.address,
                email: updates.email,
                firstName: updates.firstName,
                lastName: updates.lastName,
              });
          expect(response.status).toBe(200);
          expect(response.body.phone).toEqual(updates.phone);
          expect(response.body.address).toEqual(updates.address);
        });
        it('Should return 400 when a candidate update himself with invalid phone', async () => {
          const response: APIResponse<UsersController['updateUser']> =
            await request(server)
              .put(`${route}/${loggedInCandidate.user.id}`)
              .set('authorization', `Bearer ${loggedInCandidate.token}`)
              .send({
                phone: '1234',
              });
          expect(response.status).toBe(400);
        });
        it('Should return 200 and updated user when coach update himself', async () => {
          const updates = await userFactory.create({}, {}, false);
          const response: APIResponse<UsersController['updateUser']> =
            await request(server)
              .put(`${route}/${loggedInCoach.user.id}`)
              .set('authorization', `Bearer ${loggedInCoach.token}`)
              .send({
                phone: updates.phone,
                address: updates.address,
                email: updates.email,
                firstName: updates.firstName,
                lastName: updates.lastName,
              });
          expect(response.status).toBe(200);
          expect(response.body.phone).toEqual(updates.phone);
        });
        it('Should return 400 when coach update himself with invalid phone', async () => {
          const response: APIResponse<UsersController['updateUser']> =
            await request(server)
              .put(`${route}/${loggedInCoach.user.id}`)
              .set('authorization', `Bearer ${loggedInCoach.token}`)
              .send({
                phone: '1234',
              });
          expect(response.status).toBe(400);
        });
        it('Should return 200 and updated user when an admin update a user', async () => {
          const updates = await userFactory.create({}, {}, false);
          const response: APIResponse<UsersController['updateUser']> =
            await request(server)
              .put(`${route}/${loggedInCandidate.user.id}`)
              .set('authorization', `Bearer ${loggedInAdmin.token}`)
              .send({
                phone: updates.phone,
                firstName: updates.firstName,
                lastName: updates.lastName,
                address: updates.address,
                email: updates.email,
              });
          expect(response.status).toBe(200);
          expect(response.body.phone).toEqual(updates.phone);
        });
        it('Should return 400 when an admin update a user with invalid phone', async () => {
          const response: APIResponse<UsersController['updateUser']> =
            await request(server)
              .put(`${route}/${loggedInCandidate.user.id}`)
              .set('authorization', `Bearer ${loggedInAdmin.token}`)
              .send({
                phone: '1234',
              });
          expect(response.status).toBe(400);
        });
        it('Should return 200 and updated user when an admin update a user role', async () => {
          const response: APIResponse<UsersController['updateUser']> =
            await request(server)
              .put(`${route}/${loggedInCandidate.user.id}`)
              .set('authorization', `Bearer ${loggedInAdmin.token}`)
              .send({
                role: UserRoles.COACH,
              });
          expect(response.status).toBe(200);
          expect(response.body.role).toEqual(UserRoles.COACH);
        });
      });
      describe('/changePwd - Update password', () => {
        let loggedInCandidate: LoggedUser;
        const password = 'Candidat123!';

        beforeEach(async () => {
          loggedInCandidate = await usersHelper.createLoggedInUser({
            role: UserRoles.CANDIDATE,
            password,
          });
        });
        it('Should return 401 if not connected', async () => {
          const response: APIResponse<UsersController['updatePassword']> =
            await request(server).put(`${route}/changePwd`).send({
              oldPassword: password,
              newPassword: 'Candidat123?',
            });
          expect(response.status).toBe(401);
        });
        it('Should return 401 if old password is invalid', async () => {
          const response: APIResponse<UsersController['updatePassword']> =
            await request(server)
              .put(`${route}/changePwd`)
              .set('authorization', `Bearer ${loggedInCandidate.token}`)
              .send({
                oldPassword: 'falsePassword123!',
                newPassword: 'Candidat123?',
              });
          expect(response.status).toBe(401);
        });
        it("Should return 400 if new password doesn't contain uppercase and lowercase letters, numbers & special characters password", async () => {
          const response: APIResponse<UsersController['updatePassword']> =
            await request(server)
              .put(`${route}/changePwd`)
              .set('authorization', `Bearer ${loggedInCandidate.token}`)
              .send({
                oldPassword: password,
                newPassword: 'candidat123?',
              });
          expect(response.status).toBe(400);
        });
        it('Should return 200 and updated user', async () => {
          const response: APIResponse<UsersController['updatePassword']> =
            await request(server)
              .put(`${route}/changePwd`)
              .set('authorization', `Bearer ${loggedInCandidate.token}`)
              .send({
                email: loggedInCandidate.user.email,
                oldPassword: password,
                newPassword: 'Candidat123?',
              });
          expect(response.status).toBe(200);
        });
      });
    });
  });
});
