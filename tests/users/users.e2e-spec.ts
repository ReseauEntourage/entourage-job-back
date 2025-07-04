/* eslint-disable no-console */
import { getQueueToken } from '@nestjs/bull';
import { CACHE_MANAGER, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { v4 as uuid } from 'uuid';
import { CacheMocks, QueueMocks, S3Mocks } from '../mocks.types';
import { LoggedUser } from 'src/auth/auth.types';
import { BusinessSector } from 'src/common/business-sectors/models';
import { S3Service } from 'src/external-services/aws/s3.service';
import { Organization } from 'src/organizations/models';
import { Queues } from 'src/queues/queues.types';
import { User, UserCandidat } from 'src/users/models';
import { UsersController } from 'src/users/users.controller';
import { UserRoles } from 'src/users/users.types';
import { assertCondition } from 'src/utils/misc/asserts';
import { AdminZones, APIResponse } from 'src/utils/types';
import { BusinessSectorHelper } from 'tests/business-sectors/business-sector.helper';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import { OrganizationFactory } from 'tests/organizations/organization.factory';
import { UserCandidatsHelper } from './user-candidats.helper';
import { UserFactory } from './user.factory';
import { UsersHelper } from './users.helper';

describe('Users', () => {
  let app: INestApplication;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let server: any;

  let databaseHelper: DatabaseHelper;
  let userFactory: UserFactory;
  let usersHelper: UsersHelper;
  let userCandidatsHelper: UserCandidatsHelper;
  let organizationFactory: OrganizationFactory;
  let businessSectorsHelper: BusinessSectorHelper;

  let businessSector1: BusinessSector;
  let businessSector2: BusinessSector;

  const route = '/user';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [CustomTestingModule],
    })
      .overrideProvider(getQueueToken(Queues.WORK))
      .useValue(QueueMocks)
      .overrideProvider(CACHE_MANAGER)
      .useValue(CacheMocks)
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
      describe('/candidate - Get user associated to a candidate or coach', () => {
        let loggedInAdmin: LoggedUser;
        let loggedInCandidate: LoggedUser;
        let loggedInCoach: LoggedUser;

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
        });
        it('Should return 401 if not a logged in user', async () => {
          const response: APIResponse<UsersController['findRelatedUser']> =
            await request(server).get(`${route}/candidate`);
          expect(response.status).toBe(401);
        });
        it('Should return 404 if coach is not associated to candidate', async () => {
          const response: APIResponse<UsersController['findRelatedUser']> =
            await request(server)
              .get(`${route}/candidate`)
              .set('authorization', `Bearer ${loggedInCoach.token}`)
              .query({
                coachId: loggedInCoach.user.id,
              });

          expect(response.status).toBe(404);
        });
        it('Should return 200 if candidate not associated to coach', async () => {
          const response: APIResponse<UsersController['findRelatedUser']> =
            await request(server)
              .get(`${route}/candidate`)
              .set('authorization', `Bearer ${loggedInCandidate.token}`)
              .query({
                candidateId: loggedInCandidate.user.id,
              });

          expect(response.status).toBe(200);
          expect(!Array.isArray(response.body)).toBeTruthy();
          assertCondition(!Array.isArray(response.body));
          expect(response.body.coach).toBeFalsy();
          expect(response.body.candidat).toBeTruthy();
          expect(response.body.candidat.id).toBe(loggedInCandidate.user.id);
        });
        it('Should return 200 and related coach if candidate is associated to coach', async () => {
          ({ loggedInCoach, loggedInCandidate } =
            await userCandidatsHelper.associateCoachAndCandidate(
              loggedInCoach,
              loggedInCandidate,
              true
            ));
          const response: APIResponse<UsersController['findRelatedUser']> =
            await request(server)
              .get(`${route}/candidate`)
              .set('authorization', `Bearer ${loggedInCandidate.token}`)
              .query({
                candidateId: loggedInCandidate.user.id,
              });

          expect(response.status).toBe(200);
          expect(!Array.isArray(response.body)).toBeTruthy();
          assertCondition(!Array.isArray(response.body));
          expect(response.body.coach).toBeTruthy();
          expect(response.body.candidat).toBeTruthy();
          expect(response.body.coach.id).toBe(loggedInCoach.user.id);
          expect(response.body.candidat.id).toBe(loggedInCandidate.user.id);
        });
        it('Should return 200 and related user candidate if coach is associated to candidate', async () => {
          ({ loggedInCoach, loggedInCandidate } =
            await userCandidatsHelper.associateCoachAndCandidate(
              loggedInCoach,
              loggedInCandidate,
              true
            ));
          const response: APIResponse<UsersController['findRelatedUser']> =
            await request(server)
              .get(`${route}/candidate`)
              .set('authorization', `Bearer ${loggedInCoach.token}`)
              .query({
                coachId: loggedInCoach.user.id,
              });

          expect(response.status).toBe(200);
          expect(!Array.isArray(response.body)).toBeTruthy();
          assertCondition(!Array.isArray(response.body));
          expect(response.body.coach).toBeTruthy();
          expect(response.body.candidat).toBeTruthy();
          expect(response.body.coach.id).toBe(loggedInCoach.user.id);
          expect(response.body.candidat.id).toBe(loggedInCandidate.user.id);
        });

        it('Should return 403 if logged in user is admin ', async () => {
          const response: APIResponse<UsersController['findRelatedUser']> =
            await request(server)
              .get(`${route}/candidate`)
              .set('authorization', `Bearer ${loggedInAdmin.token}`);

          expect(response.status).toBe(403);
        });
      });
    });

    describe('R - Read many Users', () => {
      describe('/search?query=&role[]=&organizationId= - Search a user where query string in email, first name or last name', () => {
        let loggedInAdmin: LoggedUser;
        let loggedInCandidate: LoggedUser;
        let loggedInCoach: LoggedUser;
        let loggedInReferer: LoggedUser;

        let candidates: User[];
        let coaches: User[];
        let organization: Organization;

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
          organization = await organizationFactory.create({}, {}, true);

          candidates = await databaseHelper.createEntities(
            userFactory,
            3,
            {
              role: UserRoles.CANDIDATE,
            },
            {},
            true
          );

          coaches = await databaseHelper.createEntities(
            userFactory,
            3,
            {
              role: UserRoles.COACH,
            },
            {},
            true
          );
        });

        it('Should return 200 and part of candidates if user is logged in as admin and filters by candidates and searches by first name', async () => {
          const privateCandidateInfo: Partial<User> = {
            id: loggedInCandidate.user.id,
            OrganizationId: loggedInCandidate.user.OrganizationId,
            firstName: loggedInCandidate.user.firstName,
            lastName: loggedInCandidate.user.lastName,
            role: loggedInCandidate.user.role,
            adminRole: loggedInCandidate.user.adminRole,
            address: loggedInCandidate.user.address,
            email: loggedInCandidate.user.email,
            gender: loggedInCandidate.user.gender,
            phone: loggedInCandidate.user.phone,
            zone: loggedInCandidate.user.zone,
            isEmailVerified: loggedInCandidate.user.isEmailVerified,
            whatsappZoneName: loggedInCandidate.user.whatsappZoneName,
            whatsappZoneUrl: loggedInCandidate.user.whatsappZoneUrl,
            whatsappZoneQR: loggedInCandidate.user.whatsappZoneQR,
            refererId: loggedInCandidate.user.refererId,
            organization: null,
          };

          const response: APIResponse<UsersController['findUsers']> =
            await request(server)
              .get(
                `${route}/search?query=${loggedInCandidate.user.firstName}&role[]=${UserRoles.CANDIDATE}`
              )
              .set('authorization', `Bearer ${loggedInAdmin.token}`);

          expect(response.status).toBe(200);
          expect(response.body).toStrictEqual([
            {
              ...privateCandidateInfo,
              lastConnection:
                loggedInCandidate.user.lastConnection?.toISOString(),
              createdAt: loggedInCandidate.user.createdAt?.toISOString(),
              deletedAt: null,
            },
          ]);
        });

        it('Should return 200 and normal candidates if user is logged in as admin and filters by normal candidates', async () => {
          const expectedUsersId = [
            ...candidates.map(({ id }) => id),
            loggedInCandidate.user.id,
          ];

          const response: APIResponse<UsersController['findUsers']> =
            await request(server)
              .get(`${route}/search?&role[]=${UserRoles.CANDIDATE}`)
              .set('authorization', `Bearer ${loggedInAdmin.token}`);

          expect(response.status).toBe(200);
          expect(expectedUsersId).toEqual(
            expect.arrayContaining(response.body.map(({ id }) => id))
          );
        });

        it('Should return 200 and normal coaches if user is logged in as admin and filters by normal coaches', async () => {
          const expectedUsersId = [
            ...coaches.map(({ id }) => id),
            loggedInCoach.user.id,
          ];

          const response: APIResponse<UsersController['findUsers']> =
            await request(server)
              .get(`${route}/search?&role[]=${UserRoles.COACH}`)
              .set('authorization', `Bearer ${loggedInAdmin.token}`);

          expect(response.status).toBe(200);
          expect(expectedUsersId).toEqual(
            expect.arrayContaining(response.body.map(({ id }) => id))
          );
        });

        it('Should return 200 and all coaches if user is logged in as admin and filters by all coaches', async () => {
          const expectedUsersId = [
            ...coaches.map(({ id }) => id),
            loggedInCoach.user.id,
          ];

          const response: APIResponse<UsersController['findUsers']> =
            await request(server)
              .get(`${route}/search?&role[]=${UserRoles.COACH}`)
              .set('authorization', `Bearer ${loggedInAdmin.token}`);

          expect(response.status).toBe(200);
          expect(expectedUsersId).toEqual(
            expect.arrayContaining(response.body.map(({ id }) => id))
          );
        });

        it('Should return 200 and empty users if user is logged in as admin and filters by normal candidates from an organization', async () => {
          const response: APIResponse<UsersController['findUsers']> =
            await request(server)
              .get(
                `${route}/search?&role[]=${UserRoles.CANDIDATE}&organizationId=${organization.id}`
              )
              .set('authorization', `Bearer ${loggedInAdmin.token}`);

          expect(response.status).toBe(200);
          expect(response.body.length).toBe(0);
        });
        it('Should return 200 and empty users if user is logged in as admin and filters by normal coaches from an organization', async () => {
          const response: APIResponse<UsersController['findUsers']> =
            await request(server)
              .get(
                `${route}/search?&role[]=${UserRoles.COACH}&organizationId=${organization.id}`
              )
              .set('authorization', `Bearer ${loggedInAdmin.token}`);

          expect(response.status).toBe(200);
          expect(response.body.length).toBe(0);
        });

        it('Should return 403 if user is logged in as candidate', async () => {
          const response: APIResponse<UsersController['findUsers']> =
            await request(server)
              .get(`${route}/search?query=e&role[]=${UserRoles.CANDIDATE}`)
              .set('authorization', `Bearer ${loggedInCandidate.token}`);
          expect(response.status).toBe(403);
        });
        it('Should return 403 if user is logged in as coach', async () => {
          const response: APIResponse<UsersController['findUsers']> =
            await request(server)
              .get(`${route}/search?query=e&role[]=${UserRoles.CANDIDATE}`)
              .set('authorization', `Bearer ${loggedInCoach.token}`);
          expect(response.status).toBe(403);
        });
        it('Should return 403 if user is logged in as referer', async () => {
          const response: APIResponse<UsersController['findUsers']> =
            await request(server)
              .get(`${route}/search?query=e&role[]=${UserRoles.CANDIDATE}`)
              .set('authorization', `Bearer ${loggedInReferer.token}`);
          expect(response.status).toBe(403);
        });
      });
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
        describe('/members?zone[]=&employed[]=&hidden[]=&businessSectors[]=&associatedUser[]= - Read all members as admin with filters', () => {
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
                zone: AdminZones.LYON,
              }
            );
            const parisCandidates = await databaseHelper.createEntities(
              userFactory,
              2,
              {
                role: UserRoles.CANDIDATE,
                zone: AdminZones.PARIS,
              }
            );
            await databaseHelper.createEntities(userFactory, 2, {
              role: UserRoles.CANDIDATE,
              zone: AdminZones.LILLE,
            });

            await databaseHelper.createEntities(userFactory, 2, {
              role: UserRoles.COACH,
              zone: AdminZones.LYON,
            });

            const expectedCandidatesIds = [
              ...lyonCandidates.map(({ id }) => id),
              ...parisCandidates.map(({ id }) => id),
            ];

            const response: APIResponse<UsersController['findMembers']> =
              await request(server)
                .get(
                  `${route}/members?limit=50&offset=0&role[]=${UserRoles.CANDIDATE}&zone[]=${AdminZones.LYON}&zone[]=${AdminZones.PARIS}`
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
                zone: AdminZones.LYON,
              }
            );
            const parisCoaches = await databaseHelper.createEntities(
              userFactory,
              2,
              {
                role: UserRoles.COACH,
                zone: AdminZones.PARIS,
              }
            );
            await databaseHelper.createEntities(userFactory, 2, {
              role: UserRoles.COACH,
              zone: AdminZones.LILLE,
            });

            await databaseHelper.createEntities(userFactory, 2, {
              role: UserRoles.CANDIDATE,
              zone: AdminZones.LYON,
            });

            const expectedCoachesIds = [
              ...lyonCoaches.map(({ id }) => id),
              ...parisCoaches.map(({ id }) => id),
            ];

            const response: APIResponse<UsersController['findMembers']> =
              await request(server)
                .get(
                  `${route}/members?limit=50&offset=0&role[]=${UserRoles.COACH}&zone[]=${AdminZones.LYON}&zone[]=${AdminZones.PARIS}`
                )
                .set('authorization', `Bearer ${loggedInAdmin.token}`);
            expect(response.status).toBe(200);
            expect(response.body.length).toBe(4);
            expect(expectedCoachesIds).toEqual(
              expect.arrayContaining(response.body.map(({ id }) => id))
            );
          });
          it('Should return 200, and all the candidates that matches the employed filter', async () => {
            const employedCandidates = await databaseHelper.createEntities(
              userFactory,
              2,
              {
                role: UserRoles.CANDIDATE,
              },
              {
                userCandidat: {
                  employed: true,
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
                userCandidat: {
                  employed: false,
                },
              }
            );
            const response: APIResponse<UsersController['findMembers']> =
              await request(server)
                .get(
                  `${route}/members?limit=50&offset=0&role[]=${UserRoles.CANDIDATE}&employed[]=true`
                )
                .set('authorization', `Bearer ${loggedInAdmin.token}`);
            expect(response.status).toBe(200);
            expect(response.body.length).toBe(2);
            expect(employedCandidates.map(({ id }) => id)).toEqual(
              expect.arrayContaining(response.body.map(({ id }) => id))
            );
          });
          it('Should return 200, and all the candidates that matches the associatedUser filters', async () => {
            const coaches = await databaseHelper.createEntities(
              userFactory,
              2,
              {
                role: UserRoles.COACH,
              }
            );

            const associatedUserCandidates =
              await databaseHelper.createEntities(userFactory, 2, {
                role: UserRoles.CANDIDATE,
              });

            const notAssociatedUserCandidates =
              await databaseHelper.createEntities(userFactory, 2, {
                role: UserRoles.CANDIDATE,
              });

            await Promise.all(
              associatedUserCandidates.map(async (candidate, index) => {
                return userCandidatsHelper.associateCoachAndCandidate(
                  coaches[index],
                  candidate
                );
              })
            );

            const response: APIResponse<UsersController['findMembers']> =
              await request(server)
                .get(
                  `${route}/members?limit=50&offset=0&role[]=${UserRoles.CANDIDATE}&associatedUser[]=false`
                )
                .set('authorization', `Bearer ${loggedInAdmin.token}`);
            expect(response.status).toBe(200);
            expect(response.body.length).toBe(2);
            expect(notAssociatedUserCandidates.map(({ id }) => id)).toEqual(
              expect.arrayContaining(response.body.map(({ id }) => id))
            );
          });
          it('Should return 200, and all the coaches that matches the associatedUser filters', async () => {
            const candidates = await databaseHelper.createEntities(
              userFactory,
              2,
              {
                role: UserRoles.CANDIDATE,
              }
            );

            const associatedUserCoaches = await databaseHelper.createEntities(
              userFactory,
              2,
              {
                role: UserRoles.COACH,
              }
            );

            const notAssociatedUserCoaches =
              await databaseHelper.createEntities(userFactory, 2, {
                role: UserRoles.COACH,
              });

            await Promise.all(
              associatedUserCoaches.map(async (coach, index) => {
                return userCandidatsHelper.associateCoachAndCandidate(
                  coach,
                  candidates[index]
                );
              })
            );
            const response: APIResponse<UsersController['findMembers']> =
              await request(server)
                .get(
                  `${route}/members?limit=50&offset=0&role[]=${UserRoles.COACH}&associatedUser[]=false`
                )
                .set('authorization', `Bearer ${loggedInAdmin.token}`);
            expect(response.status).toBe(200);
            expect(response.body.length).toBe(2);
            expect(notAssociatedUserCoaches.map(({ id }) => id)).toEqual(
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

            const lyonAssociatedCoaches = await databaseHelper.createEntities(
              userFactory,
              2,
              {
                firstName: 'XXX',
                role: UserRoles.COACH,
                zone: AdminZones.LYON,
                OrganizationId: organization.id,
              }
            );

            const lyonAssociatedCandidates =
              await databaseHelper.createEntities(userFactory, 2, {
                firstName: 'XXX',
                role: UserRoles.CANDIDATE,
                zone: AdminZones.LYON,
                OrganizationId: organization.id,
              });

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

            const response: APIResponse<UsersController['findMembers']> =
              await request(server)
                .get(
                  `${route}/members?limit=50&offset=0&role[]=${UserRoles.CANDIDATE}&role[]=${UserRoles.CANDIDATE}&employed[]=false&query=XXX&zone[]=${AdminZones.LYON}&associatedUser[]=true`
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
                zone: AdminZones.LYON,
                OrganizationId: organization.id,
              }
            );

            const associatedCandidates = await databaseHelper.createEntities(
              userFactory,
              2,
              {
                firstName: 'XXX',
                role: UserRoles.CANDIDATE,
                zone: AdminZones.LYON,
                OrganizationId: organization.id,
              }
            );

            await Promise.all(
              associatedCandidates.map(async (candidate, index) => {
                return userCandidatsHelper.associateCoachAndCandidate(
                  lyonAssociatedCoaches[index],
                  candidate
                );
              })
            );

            const expectedCoachesIds = [
              ...lyonAssociatedCoaches.map(({ id }) => id),
            ];

            const response: APIResponse<UsersController['findMembers']> =
              await request(server)
                .get(
                  `${route}/members?limit=50&offset=0&role[]=${UserRoles.COACH}&query=XXX&zone[]=${AdminZones.LYON}&associatedUser[]=true`
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
                zone: AdminZones.LYON,
                OrganizationId: organization.id,
              }
            );

            const expectedCoachesIds = [...referers.map(({ id }) => id)];

            const response: APIResponse<UsersController['findMembers']> =
              await request(server)
                .get(
                  `${route}/members?limit=50&offset=0&role[]=${UserRoles.REFERER}&query=XXX&zone[]=${AdminZones.LYON}`
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
        it("Should return 403 if user doesn't update himself, even if they are associated", async () => {
          ({ loggedInCoach, loggedInCandidate } =
            await userCandidatsHelper.associateCoachAndCandidate(
              loggedInCoach,
              loggedInCandidate,
              true
            ));
          const updates = await userFactory.create({}, {}, false);
          const response: APIResponse<UsersController['updateUser']> =
            await request(server)
              .put(`${route}/${loggedInCandidate.user.id}`)
              .set('authorization', `Bearer ${loggedInCoach.token}`)
              .send({
                phone: updates.phone,
                firstName: updates.firstName,
              });
          expect(response.status).toBe(403);
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
        it('Should return 200 and updated user, and updated userCandidat when an admin update a user role', async () => {
          ({ loggedInCoach, loggedInCandidate } =
            await userCandidatsHelper.associateCoachAndCandidate(
              loggedInCoach,
              loggedInCandidate,
              true
            ));
          const response: APIResponse<UsersController['updateUser']> =
            await request(server)
              .put(`${route}/${loggedInCandidate.user.id}`)
              .set('authorization', `Bearer ${loggedInAdmin.token}`)
              .send({
                role: UserRoles.COACH,
              });
          expect(response.status).toBe(200);
          expect(response.body.role).toEqual(UserRoles.COACH);

          const userCandidat = await userCandidatsHelper.findOneUserCandidat({
            coachId: loggedInCandidate.user.id,
          });

          expect(userCandidat).toBeFalsy();
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
      describe('/candidate/:candidateId - Update userCandidat', () => {
        let loggedInAdmin: LoggedUser;
        let loggedInCandidate: LoggedUser;
        let loggedInCoach: LoggedUser;

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
        });

        it('Should return 401, if user not logged in', async () => {
          const response: APIResponse<UsersController['updateUserCandidat']> =
            await request(server)
              .put(`${route}/candidate/${loggedInCandidate.user.id}`)
              .send({
                hidden: false,
                note: 'updated note',
              });
          expect(response.status).toBe(401);
        });
        it("Should return 403, if candidat doesn't update himself", async () => {
          const otherCandidat = await userFactory.create({
            role: UserRoles.CANDIDATE,
          });
          const response: APIResponse<UsersController['updateUserCandidat']> =
            await request(server)
              .put(`${route}/candidate/${otherCandidat.id}`)
              .set('authorization', `Bearer ${loggedInCandidate.token}`)
              .send({
                employed: false,
                note: 'updated note by other',
              });
          expect(response.status).toBe(403);
        });
        it('Should return 403, if coach updates candidate not associated to him', async () => {
          const response: APIResponse<UsersController['updateUserCandidat']> =
            await request(server)
              .put(`${route}/candidate/${loggedInCandidate.user.id}`)
              .set('authorization', `Bearer ${loggedInCoach.token}`)
              .send({
                employed: false,
                note: 'updated note by not associated coach',
              });
          expect(response.status).toBe(403);
        });
        it('Should return 400, if candidate updates associated coach id', async () => {
          const response: APIResponse<UsersController['updateUserCandidat']> =
            await request(server)
              .put(`${route}/candidate/${loggedInCandidate.user.id}`)
              .set('authorization', `Bearer ${loggedInCandidate.token}`)
              .send({
                coachId: loggedInCoach.user.id,
              });
          expect(response.status).toBe(400);
        });
        it('Should return 400, if coach updates associated candidate id', async () => {
          const response: APIResponse<UsersController['updateUserCandidat']> =
            await request(server)
              .put(`${route}/candidate/${loggedInCoach.user.id}`)
              .set('authorization', `Bearer ${loggedInCoach.token}`)
              .send({
                candidatId: loggedInCandidate.user.id,
              });
          expect(response.status).toBe(400);
        });
        it('Should return 200 and updated userCandidat, if logged in admin', async () => {
          ({ loggedInCoach, loggedInCandidate } =
            await userCandidatsHelper.associateCoachAndCandidate(
              loggedInCoach,
              loggedInCandidate,
              true
            ));
          const updatedNote = 'updated note by admin';
          const response: APIResponse<UsersController['updateUserCandidat']> =
            await request(server)
              .put(`${route}/candidate/${loggedInCandidate.user.id}`)
              .set('authorization', `Bearer ${loggedInAdmin.token}`)
              .send({
                employed: false,
                note: updatedNote,
              });
          expect(response.status).toBe(200);
          expect(response.body.note).toMatch(updatedNote);
          expect(response.body.lastModifiedBy).toBe(loggedInAdmin.user.id);
        });
        it('Should return 200 and updated userCandidat, if candidate updates himself', async () => {
          ({ loggedInCoach, loggedInCandidate } =
            await userCandidatsHelper.associateCoachAndCandidate(
              loggedInCoach,
              loggedInCandidate,
              true
            ));
          const updatedNote = 'updated note by candidat';
          const response: APIResponse<UsersController['updateUserCandidat']> =
            await request(server)
              .put(`${route}/candidate/${loggedInCandidate.user.id}`)
              .set('authorization', `Bearer ${loggedInCandidate.token}`)
              .send({
                hidden: false,
                note: updatedNote,
              });
          expect(response.status).toBe(200);
          expect(response.body.note).toMatch(updatedNote);
          expect(response.body.lastModifiedBy).toBe(loggedInCandidate.user.id);
        });
        it('Should return 200 and updated userCandidat, if coach updates candidate associated to him', async () => {
          ({ loggedInCoach, loggedInCandidate } =
            await userCandidatsHelper.associateCoachAndCandidate(
              loggedInCoach,
              loggedInCandidate,
              true
            ));
          const updatedNote = 'updated note by coach';
          const response: APIResponse<UsersController['updateUserCandidat']> =
            await request(server)
              .put(`${route}/candidate/${loggedInCandidate.user.id}`)
              .set('authorization', `Bearer ${loggedInCoach.token}`)
              .send({
                employed: false,
                note: updatedNote,
              });
          expect(response.status).toBe(200);
          expect(response.body.note).toMatch(updatedNote);
          expect(response.body.lastModifiedBy).toBe(loggedInCoach.user.id);
        });
      });
      describe('/linkUser/:userId - Link a user', () => {
        let loggedInAdmin: LoggedUser;
        let loggedInCandidate: LoggedUser;
        let loggedInCoach: LoggedUser;

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
        });

        it('Should return 401, if user not logged in', async () => {
          const response: APIResponse<UsersController['linkUser']> =
            await request(server)
              .put(`${route}/linkUser/${loggedInCandidate.user.id}`)
              .send({
                userToLinkId: loggedInCoach.user.id,
              });
          expect(response.status).toBe(401);
        });
        it('Should return 403, if user is not admin', async () => {
          const response: APIResponse<UsersController['linkUser']> =
            await request(server)
              .put(`${route}/linkUser/${loggedInCandidate.user.id}`)
              .set('authorization', `Bearer ${loggedInCandidate.token}`)
              .send({
                userToLinkId: loggedInCoach.user.id,
              });
          expect(response.status).toBe(403);
        });

        it('Should return 404 if admin updates candidate with unexisting coach', async () => {
          const response: APIResponse<UsersController['linkUser']> =
            await request(server)
              .put(`${route}/linkUser/${loggedInCandidate.user.id}`)
              .set('authorization', `Bearer ${loggedInAdmin.token}`)
              .send({
                userToLinkId: uuid(),
              });
          expect(response.status).toBe(404);
        });
        it('Should return 404 if admin updates coach with unexisting candidate', async () => {
          const response: APIResponse<UsersController['linkUser']> =
            await request(server)
              .put(`${route}/linkUser/${loggedInCoach.user.id}`)
              .set('authorization', `Bearer ${loggedInAdmin.token}`)
              .send({
                userToLinkId: uuid(),
              });
          expect(response.status).toBe(404);
        });

        it('Should return 200 if admin updates linked coach for candidate', async () => {
          const {
            candidat,
            coaches,
            lastConnection,
            createdAt,
            organization,
            whatsappZoneName,
            whatsappZoneUrl,
            whatsappZoneQR,
            refererId,
            userSocialSituation,
            ...restCandidate
          } = loggedInCandidate.user;

          const {
            candidat: coachCandidat,
            coaches: coachCoaches,
            lastConnection: lastConnectionCoach,
            createdAt: createdAtCoach,
            organization: coachOrganization,
            readDocuments,
            whatsappZoneName: coachWhatsappZoneName,
            whatsappZoneUrl: coachWhatsappZoneUrl,
            whatsappZoneQR: coachWhatsappZoneQR,
            refererId: coachRefererId,
            referer: coachReferer,
            referredCandidates: coachReferredCandidates,
            userSocialSituation: coachUserSocialSituation,
            ...restCoach
          } = loggedInCoach.user;

          const response: APIResponse<UsersController['linkUser']> =
            await request(server)
              .put(`${route}/linkUser/${loggedInCandidate.user.id}`)
              .set('authorization', `Bearer ${loggedInAdmin.token}`)
              .send({
                userToLinkId: loggedInCoach.user.id,
              });
          expect(response.status).toBe(200);
          expect(response.body).toEqual(
            expect.objectContaining({
              ...restCandidate,
              candidat: expect.objectContaining({
                ...candidat,
                coach: expect.objectContaining({
                  ...restCoach,
                }),
              }),
            })
          );
        });
        it('Should return 200 if admin updates linked candidate for coach', async () => {
          const {
            candidat: { coach, ...restCandidateCandidat },
            coaches,
            lastConnection,
            createdAt,
            organization,
            readDocuments,
            whatsappZoneName,
            whatsappZoneUrl,
            whatsappZoneQR,
            refererId,
            referer,
            referredCandidates,
            userSocialSituation,
            ...restCandidate
          } = loggedInCandidate.user;

          const {
            candidat: coachCandidat,
            coaches: coachCoaches,
            lastConnection: lastConnectionCoach,
            createdAt: createdAtCoach,
            organization: coachOrganization,
            whatsappZoneName: coachWhatsappZoneName,
            whatsappZoneUrl: coachWhatsappZoneUrl,
            whatsappZoneQR: coachWhatsappZoneQR,
            referredCandidates: coachReferredCandidates,
            userSocialSituation: coachUserSocialSituation,
            ...restCoach
          } = loggedInCoach.user;

          const response: APIResponse<UsersController['linkUser']> =
            await request(server)
              .put(`${route}/linkUser/${loggedInCoach.user.id}`)
              .set('authorization', `Bearer ${loggedInAdmin.token}`)
              .send({
                userToLinkId: loggedInCandidate.user.id,
              });
          expect(response.status).toBe(200);
          expect(response.body).toEqual(
            expect.objectContaining({
              ...restCoach,
              coaches: [
                expect.objectContaining({
                  ...restCandidateCandidat,
                  candidat: expect.objectContaining({
                    ...restCandidate,
                  }),
                }),
              ],
            })
          );
        });

        it('Should return 200 if admin removes linked coach for candidate', async () => {
          ({ loggedInCandidate, loggedInCoach } =
            await userCandidatsHelper.associateCoachAndCandidate(
              loggedInCoach,
              loggedInCandidate,
              true
            ));

          const {
            candidat,
            coaches,
            lastConnection,
            createdAt,
            organization,
            ...restCandidate
          } = loggedInCandidate.user;

          const response: APIResponse<UsersController['linkUser']> =
            await request(server)
              .put(`${route}/linkUser/${loggedInCandidate.user.id}`)
              .set('authorization', `Bearer ${loggedInAdmin.token}`)
              .send({
                userToLinkId: null,
              });
          expect(response.status).toBe(200);
          expect(response.body).toEqual(
            expect.objectContaining({
              ...restCandidate,
              candidat: expect.objectContaining({
                ...candidat,
                coach: null,
              }),
            })
          );
        });
        it('Should return 200 if admin removes linked candidate for coach', async () => {
          ({ loggedInCandidate, loggedInCoach } =
            await userCandidatsHelper.associateCoachAndCandidate(
              loggedInCoach,
              loggedInCandidate,
              true
            ));

          const {
            candidat,
            coaches,
            lastConnection,
            createdAt,
            organization,
            whatsappZoneName,
            whatsappZoneUrl,
            whatsappZoneQR,
            ...restCoach
          } = loggedInCoach.user;

          const response: APIResponse<UsersController['linkUser']> =
            await request(server)
              .put(`${route}/linkUser/${loggedInCoach.user.id}`)
              .set('authorization', `Bearer ${loggedInAdmin.token}`)
              .send({
                userToLinkId: null,
              });
          expect(response.status).toBe(200);
          expect(response.body).toEqual(
            expect.objectContaining({
              ...restCoach,
              coaches: [],
            })
          );
        });

        it('Should return 400 if admin updates normal candidate with another normal candidate as coach', async () => {
          const otherCandidate = await userFactory.create(
            { role: UserRoles.CANDIDATE },
            {},
            true
          );

          const response: APIResponse<UsersController['linkUser']> =
            await request(server)
              .put(`${route}/linkUser/${loggedInCandidate.user.id}`)
              .set('authorization', `Bearer ${loggedInAdmin.token}`)
              .send({
                userToLinkId: otherCandidate.id,
              });
          expect(response.status).toBe(400);
        });
        it('Should return 400 if admin updates normal coach with another normal coach as candidate', async () => {
          const otherCoach = await userFactory.create(
            {
              role: UserRoles.COACH,
            },
            {},
            true
          );

          const response: APIResponse<UsersController['linkUser']> =
            await request(server)
              .put(`${route}/linkUser/${otherCoach.id}`)
              .set('authorization', `Bearer ${loggedInAdmin.token}`)
              .send({
                userToLinkId: otherCoach.id,
              });
          expect(response.status).toBe(400);
        });
      });
      describe('/candidate/checkUpdate - Check if update has been made on userCandidat note', () => {
        let loggedInAdmin: LoggedUser;
        let loggedInCandidate: LoggedUser;
        let loggedInCoach: LoggedUser;
        let loggedInReferer: LoggedUser;

        beforeEach(async () => {
          loggedInAdmin = await usersHelper.createLoggedInUser({
            role: UserRoles.ADMIN,
          });
          const candidat = await userFactory.create({
            role: UserRoles.CANDIDATE,
          });
          const coach = await userFactory.create({
            role: UserRoles.COACH,
          });
          const referer = await userFactory.create({
            role: UserRoles.REFERER,
          });
          await userCandidatsHelper.associateCoachAndCandidate(coach, candidat);
          loggedInCandidate = await usersHelper.createLoggedInUser(
            candidat,
            {},
            false
          );
          loggedInCoach = await usersHelper.createLoggedInUser(
            coach,
            {},
            false
          );
          loggedInReferer = await usersHelper.createLoggedInUser(
            referer,
            {},
            false
          );
        });
        it('Should return 401, if user not logged in', async () => {
          const response: APIResponse<
            UsersController['checkNoteHasBeenModified']
          > = await request(server).get(
            `${route}/candidate/checkUpdate/${loggedInCandidate.user.id}`
          );

          expect(response.status).toBe(401);
        });
        it('Should return 403, if admin checks if note has been updated', async () => {
          const response: APIResponse<
            UsersController['checkNoteHasBeenModified']
          > = await request(server)
            .get(`${route}/candidate/checkUpdate/${loggedInCandidate.user.id}`)
            .set('authorization', `Bearer ${loggedInAdmin.token}`);
          expect(response.status).toBe(403);
        });
        it('Should return 403, if referer checks if note has been updated', async () => {
          const response: APIResponse<
            UsersController['checkNoteHasBeenModified']
          > = await request(server)
            .get(`${route}/candidate/checkUpdate/${loggedInCandidate.user.id}`)
            .set('authorization', `Bearer ${loggedInReferer.token}`);
          expect(response.status).toBe(403);
        });
        it('Should return 200 and noteHasBeenModified, if coach checks if note has been updated', async () => {
          await userCandidatsHelper.setLastModifiedBy(
            loggedInCandidate.user.id,
            loggedInCandidate.user.id
          );
          const response: APIResponse<
            UsersController['checkNoteHasBeenModified']
          > = await request(server)
            .get(`${route}/candidate/checkUpdate/${loggedInCandidate.user.id}`)
            .set('authorization', `Bearer ${loggedInCoach.token}`);
          expect(response.status).toBe(200);
          expect(response.body.noteHasBeenModified).toBe(true);
        });
        it('Should return 200 and noteHasBeenModified be false, if coach reads note', async () => {
          await userCandidatsHelper.setLastModifiedBy(
            loggedInCandidate.user.id,
            null
          );

          const response: APIResponse<
            UsersController['checkNoteHasBeenModified']
          > = await request(server)
            .get(`${route}/candidate/checkUpdate/${loggedInCandidate.user.id}`)
            .set('authorization', `Bearer ${loggedInCoach.token}`);
          expect(response.status).toBe(200);
          expect(response.body.noteHasBeenModified).toBe(false);
        });
        it('Should return 200 and noteHasBeenModified be false, if coach is the last one to have updated note', async () => {
          await userCandidatsHelper.setLastModifiedBy(
            loggedInCandidate.user.id,
            loggedInCoach.user.id
          );

          const response: APIResponse<
            UsersController['checkNoteHasBeenModified']
          > = await request(server)
            .get(`${route}/candidate/checkUpdate/${loggedInCandidate.user.id}`)
            .set('authorization', `Bearer ${loggedInCoach.token}`);
          expect(response.status).toBe(200);
          expect(response.body.noteHasBeenModified).toBe(false);
        });

        it('Should return 200 and noteHasBeenModified, if candidat checks if note has been updated', async () => {
          await userCandidatsHelper.setLastModifiedBy(
            loggedInCandidate.user.id,
            loggedInCoach.user.id
          );
          const response: APIResponse<
            UsersController['checkNoteHasBeenModified']
          > = await request(server)
            .get(`${route}/candidate/checkUpdate/${loggedInCandidate.user.id}`)
            .set('authorization', `Bearer ${loggedInCandidate.token}`);
          expect(response.status).toBe(200);
          expect(response.body.noteHasBeenModified).toBe(true);
        });
        it('Should return 200 and noteHasBeenModified be false, if candidat reads note', async () => {
          await userCandidatsHelper.setLastModifiedBy(
            loggedInCandidate.user.id,
            null
          );

          const response: APIResponse<
            UsersController['checkNoteHasBeenModified']
          > = await request(server)
            .get(`${route}/candidate/checkUpdate/${loggedInCandidate.user.id}`)
            .set('authorization', `Bearer ${loggedInCandidate.token}`);
          expect(response.status).toBe(200);
          expect(response.body.noteHasBeenModified).toBe(false);
        });
        it('Should return 200 and noteHasBeenModified be false, if candidat is the last one to have updated note', async () => {
          await userCandidatsHelper.setLastModifiedBy(
            loggedInCandidate.user.id,
            loggedInCandidate.user.id
          );

          const response: APIResponse<
            UsersController['checkNoteHasBeenModified']
          > = await request(server)
            .get(`${route}/candidate/checkUpdate/${loggedInCandidate.user.id}`)
            .set('authorization', `Bearer ${loggedInCandidate.token}`);
          expect(response.status).toBe(200);
          expect(response.body.noteHasBeenModified).toBe(false);
        });
      });
      describe('/candidate/read/:candidateId - Set note to has been read', () => {
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
        it('Should return 401, if user not logged in', async () => {
          const response: APIResponse<UsersController['setNoteHasBeenRead']> =
            await request(server).put(
              `${route}/candidate/read/${loggedInCandidate.user.id}`
            );

          expect(response.status).toBe(401);
        });
        it('Should return 403, if admin sets the note has been read', async () => {
          const response: APIResponse<UsersController['setNoteHasBeenRead']> =
            await request(server)
              .put(`${route}/candidate/read/${loggedInCandidate.user.id}`)
              .set('authorization', `Bearer ${loggedInAdmin.token}`);
          expect(response.status).toBe(403);
        });
        it('Should return 403, if referer sets the note has been read', async () => {
          const response: APIResponse<UsersController['setNoteHasBeenRead']> =
            await request(server)
              .put(`${route}/candidate/read/${loggedInCandidate.user.id}`)
              .set('authorization', `Bearer ${loggedInReferer.token}`);
          expect(response.status).toBe(403);
        });
        it('Should return 403, if coach sets the note has been read on candidate not related', async () => {
          const response: APIResponse<UsersController['setNoteHasBeenRead']> =
            await request(server)
              .put(`${route}/candidate/read/${loggedInCandidate.user.id}`)
              .set('authorization', `Bearer ${loggedInCoach.token}`);
          expect(response.status).toBe(403);
        });
        it('Should return 200, if candidat sets the note and is not related to a coach', async () => {
          const response: APIResponse<UsersController['setNoteHasBeenRead']> =
            await request(server)
              .put(`${route}/candidate/read/${loggedInCandidate.user.id}`)
              .set('authorization', `Bearer ${loggedInCandidate.token}`);
          expect(response.status).toBe(200);
          expect(response.body.lastModifiedBy).toBe(null);
        });
        it('Should return 200 and userCandidat, if coach sets the note has been read', async () => {
          ({ loggedInCoach, loggedInCandidate } =
            await userCandidatsHelper.associateCoachAndCandidate(
              loggedInCoach,
              loggedInCandidate,
              true
            ));
          await userCandidatsHelper.setLastModifiedBy(
            loggedInCandidate.user.id,
            loggedInCandidate.user.id
          );
          const response: APIResponse<UsersController['setNoteHasBeenRead']> =
            await request(server)
              .put(`${route}/candidate/read/${loggedInCandidate.user.id}`)
              .set('authorization', `Bearer ${loggedInCoach.token}`);
          expect(response.status).toBe(200);
          expect(response.body.lastModifiedBy).toBe(null);
        });
        it('Should return 200 and userCandidat, if candidat sets the note has been read', async () => {
          ({ loggedInCoach, loggedInCandidate } =
            await userCandidatsHelper.associateCoachAndCandidate(
              loggedInCoach,
              loggedInCandidate,
              true
            ));
          await userCandidatsHelper.setLastModifiedBy(
            loggedInCandidate.user.id,
            loggedInCoach.user.id
          );
          const response: APIResponse<UsersController['setNoteHasBeenRead']> =
            await request(server)
              .put(`${route}/candidate/read/${loggedInCandidate.user.id}`)
              .set('authorization', `Bearer ${loggedInCandidate.token}`);
          expect(response.status).toBe(200);
          expect(response.body.lastModifiedBy).toBe(null);
        });
      });
    });
    describe('U - Update many Users', () => {
      describe('/bulk - Bulk update users', () => {
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

        it('Should return 200, and updated opportunities ids, if admin bulk updates some users', async () => {
          const originalUsers = await databaseHelper.createEntities(
            userFactory,
            5,
            {
              role: UserRoles.CANDIDATE,
            },
            {
              userCandidat: { hidden: true },
            }
          );
          const originalUsersIds = originalUsers.map(({ id }) => {
            return id;
          });
          const response: APIResponse<UsersController['updateAll']> =
            await request(server)
              .put(`${route}/candidate/bulk`)
              .set('authorization', `Bearer ${loggedInAdmin.token}`)
              .send({
                attributes: {
                  hidden: true,
                },
                ids: originalUsersIds,
              });

          expect(response.status).toBe(200);
          const { nbUpdated, updatedIds } = response.body;
          const updatedUserCandidats =
            await userCandidatsHelper.findAllUserCandidatsById(
              originalUsersIds
            );

          expect(nbUpdated).toBeLessThanOrEqual(originalUsers.length);
          expect(originalUsersIds).toEqual(
            expect.arrayContaining(updatedIds.sort())
          );
          expect(
            updatedUserCandidats.map((user: UserCandidat) => {
              return user.toJSON();
            })
          ).toEqual(
            expect.not.arrayContaining([
              expect.objectContaining({
                hidden: false,
              }),
            ])
          );
        });
        it('Should return 403, if logged in as candidate', async () => {
          const originalUsers = await databaseHelper.createEntities(
            userFactory,
            5,
            {
              role: UserRoles.CANDIDATE,
            },
            {
              userCandidat: { hidden: true },
            }
          );
          const originalUsersIds = originalUsers.map(({ id }) => {
            return id;
          });
          const responseCandidate: APIResponse<UsersController['updateAll']> =
            await request(server)
              .put(`${route}/candidate/bulk`)
              .set('authorization', `Bearer ${loggedInCandidate.token}`)
              .send({
                attributes: {
                  hidden: true,
                },
                ids: originalUsersIds,
              });
          expect(responseCandidate.status).toBe(403);
        });
        it('Should return 403, if logged in as coach', async () => {
          const originalUsers = await databaseHelper.createEntities(
            userFactory,
            5,
            {
              role: UserRoles.CANDIDATE,
            },
            {
              userCandidat: { hidden: true },
            }
          );
          const originalUsersIds = originalUsers.map(({ id }) => {
            return id;
          });
          const responseCoach: APIResponse<UsersController['updateAll']> =
            await request(server)
              .put(`${route}/candidate/bulk`)
              .set('authorization', `Bearer ${loggedInCoach.token}`)
              .send({
                attributes: {
                  hidden: true,
                },
                ids: originalUsersIds,
              });
          expect(responseCoach.status).toBe(403);
        });

        it('Should return 403, if logged in as referer', async () => {
          const originalUsers = await databaseHelper.createEntities(
            userFactory,
            5,
            {
              role: UserRoles.CANDIDATE,
            },
            {
              userCandidat: { hidden: true },
            }
          );
          const originalUsersIds = originalUsers.map(({ id }) => {
            return id;
          });
          const responseCoach: APIResponse<UsersController['updateAll']> =
            await request(server)
              .put(`${route}/candidate/bulk`)
              .set('authorization', `Bearer ${loggedInReferer.token}`)
              .send({
                attributes: {
                  hidden: true,
                },
                ids: originalUsersIds,
              });
          expect(responseCoach.status).toBe(403);
        });
      });
    });
  });
});
