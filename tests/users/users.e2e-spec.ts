import { getQueueToken } from '@nestjs/bull';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Op } from 'sequelize';
import request from 'supertest';
import { v4 as uuid } from 'uuid';
import { CVStatuses } from 'src/cvs';
import { Queues } from 'src/queues';
import { User, UserRoles } from 'src/users';
import { AdminZones } from 'src/utils/types';
import { AuthHelper } from 'tests/auth/auth.helper';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { CVFactory, CVHelper } from 'tests/cvs';
import { DatabaseHelper } from 'tests/database.helper';
import { UserFactory } from 'tests/users/user.factory';
import { UserHelper } from 'tests/users/user.helper';
import { UserCandidatHelper } from './user-candidat.helper';

const fakeId = uuid();

let loggedInAdmin: { user: User; token: string };
let loggedInCoach: { user: User; token: string };
let loggedInCandidat: { user: User; token: string };
let otherLoggedInCandidat: { user: User; token: string };
let otherLoggedInCoach: { user: User; token: string };

describe('Users', () => {
  let app: INestApplication;

  let databaseHelper: DatabaseHelper;
  let authHelper: AuthHelper;
  let userFactory: UserFactory;
  let userHelper: UserHelper;
  let userCandidatHelper: UserCandidatHelper;
  let cvHelper: CVHelper;
  let cvFactory: CVFactory;

  const route = '/user';
  const userCreationRoute = '/auth';
  const cvRoute = '/cv';

  const queueMock = { add: jest.fn() };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [CustomTestingModule],
    })
      .overrideProvider(getQueueToken(Queues.WORK))
      .useValue(queueMock)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    databaseHelper = moduleFixture.get<DatabaseHelper>(DatabaseHelper);
    userHelper = moduleFixture.get<UserHelper>(UserHelper);
    userCandidatHelper =
      moduleFixture.get<UserCandidatHelper>(UserCandidatHelper);
    userFactory = moduleFixture.get<UserFactory>(UserFactory);
    cvHelper = moduleFixture.get<CVHelper>(CVHelper);
    cvFactory = moduleFixture.get<CVFactory>(CVFactory);

    const adminPassword = 'Admin123!';
    const admin = await userFactory.create({
      role: UserRoles.ADMIN,
      password: adminPassword,
      zone: AdminZones.LILLE,
    });
    const coachPassword = 'Coach123!';
    const coach = await userFactory.create({
      role: UserRoles.COACH,
      password: coachPassword,
      zone: AdminZones.LYON,
    });
    const candidatPassword = 'Candidat123!';
    const candidat = await userFactory.create(
      {
        role: UserRoles.CANDIDAT,
        password: candidatPassword,
        zone: AdminZones.LYON,
      },
      {
        hidden: false,
        employed: false,
      }
    );
    candidat.password = candidatPassword;
    coach.password = coachPassword;
    admin.password = adminPassword;
    await userCandidatHelper.associateCoachAndCandidat(coach, candidat);
    loggedInAdmin = await userHelper.createLoggedInUser(admin, {}, false);
    loggedInCoach = await userHelper.createLoggedInUser(coach, {}, false);
    loggedInCandidat = await userHelper.createLoggedInUser(candidat, {}, false);
    otherLoggedInCandidat = await userHelper.createLoggedInUser(
      {
        role: UserRoles.CANDIDAT,
        password: 'OtherCandidate123!',
        zone: AdminZones.LILLE,
      },
      {
        hidden: true,
        employed: true,
      }
    );
    otherLoggedInCoach = await userHelper.createLoggedInUser({
      role: UserRoles.COACH,
      password: 'OtherCoach123!',
      zone: AdminZones.LILLE,
    });

    await userCandidatHelper.associateCoachAndCandidat(
      otherLoggedInCoach.user,
      otherLoggedInCandidat.user,
      true
    );

    const thirdCandidat = await userHelper.createLoggedInUser(
      {
        role: UserRoles.CANDIDAT,
        password: 'ThirdCandidate123!',
        zone: AdminZones.LYON,
      },
      {
        hidden: false,
        employed: true,
      }
    );
    await userHelper.createLoggedInUser({
      role: UserRoles.COACH,
      password: 'ThirdCoach123!',
      zone: AdminZones.LYON,
    });

    await cvHelper.createCvWithAssociations(
      {
        UserId: loggedInCandidat.user.id,
        status: CVStatuses.Published.value,
      },
      {
        businessLines: ['id'],
      }
    );

    await cvHelper.createCvWithAssociations(
      {
        UserId: otherLoggedInCandidat.user.id,
        status: CVStatuses.Pending.value,
      },
      {
        businessLines: ['id', 'aa'],
      }
    );

    await cvHelper.createCvWithAssociations(
      {
        UserId: thirdCandidat.user.id,
        status: CVStatuses.Published.value,
      },
      {
        businessLines: ['aa'],
      }
    );
  });

  afterAll(async () => {
    await app.close();
  });

  /*
    // TODO put back after refactor of tests
    beforeEach(async () => {
      await databaseHelper.resetTestDB();
    });
  */

  describe('CRUD User', () => {
    describe('C - Create 1 User', () => {
      it('Should return 200 and a created user (create user with password).', async () => {
        const candidat = await userFactory.create(
          {
            role: UserRoles.CANDIDAT,
          },
          {},
          false
        );
        const response = await request(app.getHttpServer())
          .post(`${userCreationRoute}`)
          .set('authorization', `Token ${loggedInAdmin.token}`)
          .send(candidat);
        expect(response.status).toBe(201);
      });
      it('Should return 200 and a created user (create user without password).', async () => {
        const candidat = await userFactory.create(
          { role: UserRoles.CANDIDAT },
          {},
          false
        );
        /* delete candidat.password;
        delete candidat.hash;*/
        const response = await request(app.getHttpServer())
          .post(`${userCreationRoute}`)
          .set('authorization', `Token ${loggedInAdmin.token}`)
          .send(candidat);
        expect(response.status).toBe(201);
      });
      it('Should return 401 when user data has invalid phone', async () => {
        const wrongData = {
          ...(await userFactory.create({}, {}, false)),
          phone: '1234',
        };
        const response = await request(app.getHttpServer())
          .post(`${userCreationRoute}`)
          .set('authorization', `Token ${loggedInAdmin.token}`)
          .send(wrongData);
        expect(response.status).toBe(400);
      });
      it('Should return 401 when the user is not logged-in.', async () => {
        const candidat = await userFactory.create(
          {
            role: UserRoles.CANDIDAT,
          },
          {},
          false
        );
        const response = await request(app.getHttpServer())
          .post(`${userCreationRoute}`)
          .send(candidat);
        expect(response.status).toBe(401);
      });
      it('Should return 403 when the user is not an administrator.', async () => {
        const candidat = await userFactory.create(
          {
            role: UserRoles.CANDIDAT,
          },
          {},
          false
        );
        const response = await request(app.getHttpServer())
          .post(`${userCreationRoute}`)
          .set('authorization', `Token ${loggedInCandidat.token}`)
          .send(candidat);
        expect(response.status).toBe(403);
      });
      it('Should return 409 when the email already exist.', async () => {
        const candidat = await userFactory.create(
          {
            role: UserRoles.CANDIDAT,
          },
          {},
          true
        );
        const response = await request(app.getHttpServer())
          .post(`${userCreationRoute}`)
          .set('authorization', `Token ${loggedInAdmin.token}`)
          .send(candidat);
        expect(response.status).toBe(409);
      });
    });
    describe('R - Read 1 User', () => {
      describe('/ - Get a user by ID or EMAIL', () => {
        it('Should return 401 when the user is not logged in.', async () => {
          const response = await request(app.getHttpServer()).get(
            `${route}/${otherLoggedInCandidat.user.email}`
          );
          expect(response.status).toBe(401);
        });
        it('Should return 200 when logged-in candidat get himself', async () => {
          const response = await request(app.getHttpServer())
            .get(`${route}/${loggedInCandidat.user.email}`)
            .set('authorization', `Token ${loggedInCandidat.token}`);
          expect(response.status).toBe(200);
          expect(response.body.email).toEqual(loggedInCandidat.user.email);
        });
        it('Should return 200 when logged-in coach get himself', async () => {
          const response = await request(app.getHttpServer())
            .get(`${route}/${loggedInCoach.user.email}`)
            .set('authorization', `Token ${loggedInCoach.token}`);
          expect(response.status).toBe(200);
          expect(response.body.email).toEqual(loggedInCoach.user.email);
        });
        it('Should return 403 when logged-in coach get a candidat', async () => {
          const response = await request(app.getHttpServer())
            .get(`${route}/${otherLoggedInCandidat.user.email}`)
            .set('authorization', `Token ${loggedInCoach.token}`);
          expect(response.status).toBe(403);
        });
        it('Should return 200 and get a user by email.', async () => {
          const response = await request(app.getHttpServer())
            .get(`${route}/${otherLoggedInCandidat.user.email}`)
            .set('authorization', `Token ${loggedInAdmin.token}`);
          expect(response.status).toBe(200);
          const receivedUser = response.body;
          expect(receivedUser.email).toEqual(otherLoggedInCandidat.user.email);
        });
        it('Should return 200 and get a user by id.', async () => {
          const response = await request(app.getHttpServer())
            .get(`${route}/${otherLoggedInCandidat.user.id}`)
            .set('authorization', `Token ${loggedInAdmin.token}`);
          expect(response.status).toBe(200);
          expect(response.body.id).toEqual(otherLoggedInCandidat.user.id);
        });
        it('Should return 404 if user not found', async () => {
          const response = await request(app.getHttpServer())
            .get(`${route}/${fakeId}`)
            .set('authorization', `Token ${loggedInAdmin.token}`);
          expect(response.status).toBe(404);
        });
      });
      describe('Candidat - get user associated to a candidate or coach', () => {
        it('Should return 401 if user is not a logged in user', async () => {
          const response = await request(app.getHttpServer())
            .get(`${route}/candidat`)
            .send({
              candidatId: loggedInCandidat.user.id,
            });
          expect(response.status).toBe(401);
        });
        it('Should return 200 and users, candidat searching for himself', async () => {
          const response = await request(app.getHttpServer())
            .get(`${route}/candidat`)
            .set('authorization', `Token ${loggedInCandidat.token}`)
            .query({
              candidatId: loggedInCandidat.user.id,
            });

          expect(response.status).toBe(200);
          expect(response.body.coach.id).toBe(loggedInCoach.user.id);
          expect(response.body.candidat.id).toBe(loggedInCandidat.user.id);
        });
        it('Should return 200 and users, coach searching for himself', async () => {
          const response = await request(app.getHttpServer())
            .get(`${route}/candidat`)
            .set('authorization', `Token ${loggedInCoach.token}`)
            .query({
              coachId: loggedInCoach.user.id,
            });

          expect(response.status).toBe(200);
          expect(response.body.coach.id).toBe(loggedInCoach.user.id);
          expect(response.body.candidat.id).toBe(loggedInCandidat.user.id);
        });
        it('Should return 403 if a not admin user search for others than himself.', async () => {
          const response = await request(app.getHttpServer())
            .get(`${route}/candidat`)
            .set('authorization', `Token ${loggedInCoach.token}`)
            .query({
              coachId: loggedInCandidat.user.id,
            });

          expect(response.status).toBe(403);
        });
        it('Should return 200 and users, admin searching for any users', async () => {
          const response = await request(app.getHttpServer())
            .get(`${route}/candidat`)
            .set('authorization', `Token ${loggedInAdmin.token}`)
            .send({
              candidatId: loggedInCoach.user.id,
            });
          expect(response.status).toBe(200);
        });
      });
    });

    describe('R - Many Users', () => {
      describe('Search - search a user where query string in email, first name or last name', () => {
        it('Should return 200 and part of candidates if user is logged in as admin', async () => {
          const candidat = await userFactory.create({
            role: UserRoles.CANDIDAT,
            password: 'candidat',
          });

          await cvFactory.create({
            UserId: candidat.id,
            status: CVStatuses.Published.value,
          });

          const privateCandidateInfo = [
            {
              id: candidat.id,
              firstName: candidat.firstName,
              lastName: candidat.lastName,
              role: candidat.role,
              adminRole: candidat.adminRole,
              address: candidat.address,
              deletedAt: candidat.deletedAt,
              createdAt: candidat.createdAt?.toISOString(),
              email: candidat.email,
              gender: candidat.gender,
              lastConnection: candidat.lastConnection?.toISOString(),
              phone: candidat.phone,
              zone: candidat.zone,
            },
          ];

          const response = await request(app.getHttpServer())
            .get(`${route}/search?query=${candidat.firstName}`)
            .set('authorization', `Token ${loggedInAdmin.token}`)
            .send({
              ...loggedInAdmin.user,
            });

          expect(response.status).toBe(200);
          expect(response.body).toStrictEqual(privateCandidateInfo);
        });
        it('Should return 403 if user is not logged in as admin', async () => {
          const response = await request(app.getHttpServer())
            .get(`${route}/search?query=e&role=${UserRoles.CANDIDAT}`)
            .set('authorization', `Token ${loggedInCandidat.token}`)
            .send({
              ...loggedInCandidat.user,
            });
          expect(response.status).toBe(403);
        });
      });
      describe('Search - search a public candidate where query string in email, first name or last name', () => {
        it('Should return 200 and part of candidates', async () => {
          const candidat = await userFactory.create({
            role: UserRoles.CANDIDAT,
            password: 'candidat',
          });

          await cvFactory.create({
            UserId: candidat.id,
            status: CVStatuses.Published.value,
          });

          const publicCandidateInfo = [
            {
              id: candidat.id,
              firstName: candidat.firstName,
              lastName: candidat.lastName,
              role: candidat.role,
            },
          ];

          const response = await request(app.getHttpServer()).get(
            `${route}/search/candidates?query=${candidat.firstName}`
          );

          expect(response.status).toBe(200);
          expect(response.body).toStrictEqual(publicCandidateInfo);
        });
      });

      describe('Members - get paginated and sorted users', () => {
        it('Should return 403 if user is not a logged in admin', async () => {
          const response = await request(app.getHttpServer())
            .get(`${route}/members`)
            .set('authorization', `Token ${loggedInCandidat.token}`);
          expect(response.status).toBe(403);
        });
        it('Should return 200 and a page of the 2th candidats', async () => {
          const response = await request(app.getHttpServer())
            .get(`${route}/members?limit=2&role=${UserRoles.CANDIDAT}`)
            .set('authorization', `Token ${loggedInAdmin.token}`);
          expect(response.status).toBe(200);
          expect(response.body.length).toBe(2);
        });
        it('Should return 200 and a page of 3 COACH', async () => {
          const response = await request(app.getHttpServer())
            .get(`${route}/members?limit=10&role=${UserRoles.COACH}`)
            .set('authorization', `Token ${loggedInAdmin.token}`);
          expect(response.status).toBe(200);
        });
        it('Should return 200 and the 4th and 5th candidats users', async () => {
          await request(app.getHttpServer())
            .get(`${route}/members?limit=2&offset=2&role=${UserRoles.CANDIDAT}`)
            .set('authorization', `Token ${loggedInAdmin.token}`);
        });
      });
      describe('Members - Count all pending members', () => {
        it('Should return 403 if user is not a logged in admin', async () => {
          const response = await request(app.getHttpServer())
            .get(`${route}/members/count`)
            .set('authorization', `Token ${loggedInCandidat.token}`);
          expect(response.status).toBe(403);
        });
        it('Should return 200 and count of members with pending CVs', async () => {
          const response = await request(app.getHttpServer())
            .get(`${route}/members/count`)
            .set('authorization', `Token ${loggedInAdmin.token}`);
          expect(response.status).toBe(200);
          expect(response.body.pendingCVs).toBe(1);
        });
      });
      describe('Read all members as admin with filters', () => {
        it('should return 200, and all the candidates that matches the zone filter', async () => {
          const response = await request(app.getHttpServer())
            .get(
              `${route}/members?limit=2&role=${UserRoles.CANDIDAT}&zone[]=LYON`
            )
            .set('authorization', `Token ${loggedInAdmin.token}`);
          expect(response.status).toBe(200);
          expect(response.body.length).toBe(2);
          expect(response.body).not.toEqual(
            expect.not.arrayContaining([
              expect.objectContaining({
                zone: 'LYON',
              }),
            ])
          );
        });
        it('should return 200, and all the coaches that matches the zone filter', async () => {
          const response = await request(app.getHttpServer())
            .get(
              `${route}/members?limit=50&role=${UserRoles.COACH}&zone[]=LYON`
            )
            .set('authorization', `Token ${loggedInAdmin.token}`);
          expect(response.status).toBe(200);
          expect(response.body.length).toBe(2);
          expect(response.body).not.toEqual(
            expect.not.arrayContaining([
              expect.objectContaining({
                zone: 'LYON',
              }),
            ])
          );
        });
        it('should return 200, and all the candidates that matches the hidden filter', async () => {
          const response = await request(app.getHttpServer())
            .get(
              `${route}/members?limit=50&role=${UserRoles.CANDIDAT}&hidden[]=true`
            )
            .set('authorization', `Token ${loggedInAdmin.token}`);
          expect(response.status).toBe(200);
          expect(response.body.length).toBe(1);
          expect(response.body).not.toEqual(
            expect.not.arrayContaining([
              expect.objectContaining({
                candidat: expect.objectContaining({
                  hidden: true,
                }),
              }),
            ])
          );
        });
        it('should return 200, and all the candidates that matches the employed filter', async () => {
          const response = await request(app.getHttpServer())
            .get(
              `${route}/members?limit=50&role=${UserRoles.CANDIDAT}&employed[]=true`
            )
            .set('authorization', `Token ${loggedInAdmin.token}`);
          expect(response.status).toBe(200);
          expect(response.body.length).toBe(2);
          expect(response.body).not.toEqual(
            expect.not.arrayContaining([
              expect.objectContaining({
                candidat: expect.objectContaining({
                  employed: true,
                }),
              }),
            ])
          );
        });
        it('should return 200, and all the candidates that matches the cvStatus filters', async () => {
          const response = await request(app.getHttpServer())
            .get(
              `${route}/members?limit=50&role=${UserRoles.CANDIDAT}&cvStatus[]=Published`
            )
            .set('authorization', `Token ${loggedInAdmin.token}`);
          expect(response.status).toBe(200);
          expect(response.body.length).toBe(4);
          expect(response.body).not.toEqual(
            expect.not.arrayContaining([
              expect.objectContaining({
                candidat: expect.objectContaining({
                  cvs: expect.arrayContaining([
                    expect.objectContaining({ status: 'Published' }),
                  ]),
                }),
              }),
            ])
          );
        });
        it('should return 200, and all the candidates that matches the business lines filters', async () => {
          const response = await request(app.getHttpServer())
            .get(
              `${route}/members?limit=50&role=${UserRoles.CANDIDAT}&businessLines[]=id`
            )
            .set('authorization', `Token ${loggedInAdmin.token}`);
          expect(response.status).toBe(200);
          expect(response.body.length).toBe(2);
          expect(response.body).not.toEqual(
            expect.not.arrayContaining([
              expect.objectContaining({
                candidat: expect.objectContaining({
                  cvs: expect.arrayContaining([
                    expect.objectContaining({
                      businessLines: expect.arrayContaining([
                        expect.objectContaining({ name: 'id' }),
                      ]),
                    }),
                  ]),
                }),
              }),
            ])
          );
        });
        it('should return 200, and all the candidates that matches the associatedUser filters', async () => {
          const response = await request(app.getHttpServer())
            .get(
              `${route}/members?limit=50&role=${UserRoles.CANDIDAT}&associatedUser[]=false`
            )
            .set('authorization', `Token ${loggedInAdmin.token}`);
          expect(response.status).toBe(200);
          expect(response.body.length).toBe(6);
          expect(response.body).not.toEqual(
            expect.not.arrayContaining([
              expect.objectContaining({
                candidat: expect.objectContaining({
                  coach: null,
                }),
              }),
            ])
          );
        });
        it('should return 200, and all the coaches that matches the associatedUser filters', async () => {
          const response = await request(app.getHttpServer())
            .get(
              `${route}/members?limit=50&role=${UserRoles.COACH}&associatedUser[]=false`
            )
            .set('authorization', `Token ${loggedInAdmin.token}`);
          expect(response.status).toBe(200);
          expect(response.body.length).toBe(1);
          expect(response.body).not.toEqual(
            expect.not.arrayContaining([
              expect.objectContaining({
                coach: null,
              }),
            ])
          );
        });
        it('should return 200, and all the candidates that matches the multiple filters (AND between different filters, OR inside each filters)', async () => {
          const response = await request(app.getHttpServer())
            .get(
              `${route}/members?limit=50&role=${UserRoles.CANDIDAT}&zone[]=LYON&associatedUser[]=true&employed[]=false&hidden[]=false&businessLines[]=id`
            )
            .set('authorization', `Token ${loggedInAdmin.token}`);
          expect(response.status).toBe(200);
          expect(response.body.length).toBe(1);
          expect(response.body).not.toEqual(
            expect.not.arrayContaining([
              expect.objectContaining({
                zone: 'LYON',
              }),
            ])
          );
          expect(response.body).not.toEqual(
            expect.not.arrayContaining([
              expect.objectContaining({
                candidat: expect.objectContaining({
                  hidden: false,
                }),
              }),
            ])
          );
          expect(response.body).not.toEqual(
            expect.not.arrayContaining([
              expect.objectContaining({
                candidat: expect.objectContaining({
                  employed: false,
                }),
              }),
            ])
          );

          expect(response.body).not.toEqual(
            expect.not.arrayContaining([
              expect.objectContaining({
                candidat: expect.objectContaining({
                  cvs: expect.arrayContaining([
                    expect.objectContaining({ status: 'Published' }),
                  ]),
                }),
              }),
            ])
          );
          expect(response.body).not.toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                candidat: expect.objectContaining({
                  coach: null,
                }),
              }),
            ])
          );
          expect(response.body).not.toEqual(
            expect.not.arrayContaining([
              expect.objectContaining({
                candidat: expect.objectContaining({
                  cvs: expect.arrayContaining([
                    expect.objectContaining({
                      businessLines: expect.arrayContaining([
                        expect.objectContaining({ name: 'id' }),
                      ]),
                    }),
                  ]),
                }),
              }),
            ])
          );
        });
      });
    });
    /*
 describe('U - Update 1 User', () => {
   describe('Update user - /:id', () => {
     it('Should return 401 if user is not logged in', async () => {
       const updates = await userFactory.create({}, {}, false);
       const response = await request(app.getHttpServer())
         .put(`${route}/${otherLoggedInCandidat.user.id}`)
         .send({
           phone: updates.phone,
           firstName: updates.firstName,
         });
       expect(response.status).toBe(401);
     });
     it('Should return 401 if user do not have the rights to update targeted user', async () => {
       const updates = await userFactory.create({}, {}, false);
       const response = await request(app.getHttpServer())
         .put(`${route}/${otherLoggedInCandidat.user.id}`)
         .set('authorization', `Token ${loggedInCandidat.token}`)
         .send({
           phone: updates.phone,
           firstName: updates.firstName,
         });
       expect(response.status).toBe(401);
     });
     it('Should return 200 and updated user when a candiate update himself', async () => {
       const updates = await userFactory.create({}, {}, false);
       const response = await request(app.getHttpServer())
         .put(`${route}/${loggedInCandidat.user.id}`)
         .set('authorization', `Token ${loggedInCandidat.token}`)
         .send({
           phone: updates.phone,
           address: updates.address,
         });
       expect(response.status).toBe(200);
       expect(response.body.phone).toEqual(updates.phone);
     });
     it('Should return 401 when a candiate update himself with invalid phone', async () => {
       const updates = await userFactory.create({}, {}, false);
       const response = await request(app.getHttpServer())
         .put(`${route}/${loggedInCandidat.user.id}`)
         .set('authorization', `Token ${loggedInCandidat.token}`)
         .send({
           phone: '1234',
           address: updates.address,
         });
       expect(response.status).toBe(401);
     });
     it('Should return 200 and updated user when coach update himself', async () => {
       const updates = await userFactory.create({}, {}, false);
       const response = await request(app.getHttpServer())
         .put(`${route}/${loggedInCoach.user.id}`)
         .set('authorization', `Token ${loggedInCoach.token}`)
         .send({
           phone: updates.phone,
         });
       expect(response.status).toBe(200);
       expect(response.body.phone).toEqual(updates.phone);
     });
     it('Should return 401 when coach update himself with invalid phone', async () => {
       const response = await request(app.getHttpServer())
         .put(`${route}/${loggedInCoach.user.id}`)
         .set('authorization', `Token ${loggedInCoach.token}`)
         .send({
           phone: '1234',
         });
       expect(response.status).toBe(401);
     });
     it('Should return 401 when a not admin user updates his first name', async () => {
       const updates = await userFactory.create({}, {}, false);
       const response = await request(app.getHttpServer())
         .put(`${route}/${loggedInCandidat.user.id}`)
         .set('authorization', `Token ${loggedInCandidat.token}`)
         .send({
           firstName: updates.firstName,
         });
       expect(response.status).toBe(401);
     });
     it('Should return 401 when a not admin user updates his last name', async () => {
       const updates = await userFactory.create({}, {}, false);
       const response = await request(app.getHttpServer())
         .put(`${route}/${loggedInCoach.user.id}`)
         .set('authorization', `Token ${loggedInCoach.token}`)
         .send({
           lastName: updates.lastName,
         });
       expect(response.status).toBe(401);
     });
     it('Should return 200 and updated user when an admin update a user', async () => {
       const updates = await userFactory.create({}, {}, false);
       const response = await request(app.getHttpServer())
         .put(`${route}/${otherLoggedInCandidat.user.id}`)
         .set('authorization', `Token ${loggedInAdmin.token}`)
         .send({
           phone: updates.phone,
         });
       expect(response.status).toBe(200);
       expect(response.body.phone).toEqual(updates.phone);
     });
     it('Should return 401 when an admin update a user with invalid phone', async () => {
       const response = await request(app.getHttpServer())
         .put(`${route}/${otherLoggedInCandidat.user.id}`)
         .set('authorization', `Token ${loggedInAdmin.token}`)
         .send({
           phone: '1234',
         });
       expect(response.status).toBe(401);
     });
     it('Should return 200 and updated user when an admin update a user role', async () => {
       const response = await request(app.getHttpServer())
         .put(`${route}/${otherLoggedInCandidat.user.id}`)
         .set('authorization', `Token ${loggedInAdmin.token}`)
         .send({
           role: UserRoles.COACH,
         });
       expect(response.status).toBe(200);
       expect(response.body.role).toEqual(UserRoles.COACH);
     });
   });
   describe('Update password - /change-pwd', () => {
     it('Should return 401 if old password is invalid', async () => {
       const response = await request(app.getHttpServer())
         .put(`${route}/change-pwd`)
         .set('authorization', `Token ${loggedInCandidat.token}`)
         .send({
           email: loggedInCandidat.user.email,
           oldPassword: 'falsePassword123!',
           newPassword: 'Candidat123?',
         });
       expect(response.status).toBe(401);
     });
     it("Should return 400 if new password doesn't contain uppercase and lowercase letters, numbers & special characters password", async () => {
       const response = await request(app.getHttpServer())
         .put(`${route}/change-pwd`)
         .set('authorization', `Token ${loggedInCandidat.token}`)
         .send({
           email: loggedInCandidat.user.email,
           oldPassword: 'Candidat123!',
           newPassword: 'candidat123?',
         });
       expect(response.status).toBe(401);
     });
     it('Should return 200 and updated user', async () => {
       const response = await request(app.getHttpServer())
         .put(`${route}/change-pwd`)
         .set('authorization', `Token ${loggedInCandidat.token}`)
         .send({
           email: loggedInCandidat.user.email,
           oldPassword: 'Candidat123!',
           newPassword: 'Candidat123?',
         });
       expect(response.status).toBe(200);
     });
   });
   describe('/candidat/:id', () => {
     it('Should return 200, if candidat updates himself', async () => {
       const response = await request(app.getHttpServer())
         .put(`${route}/candidat/${loggedInCandidat.user.id}`)
         .set('authorization', `Token ${loggedInCandidat.token}`)
         .send({
           hidden: false,
           note: 'updated note by candidat',
         });
       expect(response.status).toBe(200);
     });
     it('Should return 200 and noteHasBeenModified, if coach checks if note has been updated', async () => {
       const response = await request(app.getHttpServer())
         .get(`${route}/candidat/checkUpdate`)
         .set('authorization', `Token ${loggedInCoach.token}`);
       expect(response.status).toBe(200);
       expect(response.body.noteHasBeenModified).toBe(true);
     });
     it('Should return 200 and noteHasBeenModified be false, if coach reads note', async () => {
       const setHasReadNoteRequest = await request(app.getHttpServer())
         .put(`${route}/candidat/read/${loggedInCandidat.user.id}`)
         .set('authorization', `Token ${loggedInCoach.token}`);
       expect(setHasReadNoteRequest.status).toBe(200);

       const response = await request(app.getHttpServer())
         .get(`${route}/candidat/checkUpdate`)
         .set('authorization', `Token ${loggedInCoach.token}`);
       expect(response.status).toBe(200);
       expect(response.body.noteHasBeenModified).toBe(false);
     });
     it('Should return 200 and updated user_candidat, if coach updates candidate associated to him', async () => {
       const response = await request(app.getHttpServer())
         .put(`${route}/candidat/${loggedInCandidat.user.id}`)
         .set('authorization', `Token ${loggedInCoach.token}`)
         .send({
           employed: false,
           note: 'updated note by coach',
         });
       expect(response.status).toBe(200);
     });
     it('Should return 200 and noteHasBeenModified, if candidat checks if note has been updated', async () => {
       const response = await request(app.getHttpServer())
         .get(`${route}/candidat/checkUpdate`)
         .set('authorization', `Token ${loggedInCandidat.token}`);
       expect(response.status).toBe(200);
       expect(response.body.noteHasBeenModified).toBe(true);
     });
     it('Should return 200 and noteHasBeenModified be false, if candidat reads note', async () => {
       const setHasReadNoteRequest = await request(app.getHttpServer())
         .put(`${route}/candidat/read/${loggedInCandidat.user.id}`)
         .set('authorization', `Token ${loggedInCandidat.token}`);
       expect(setHasReadNoteRequest.status).toBe(200);

       const response = await request(app.getHttpServer())
         .get(`${route}/candidat/checkUpdate`)
         .set('authorization', `Token ${loggedInCandidat.token}`);
       expect(response.status).toBe(200);
       expect(response.body.noteHasBeenModified).toBe(false);
     });
     it('Should return 200 and updated user_candidat, if logged in admin', async () => {
       const response = await request(app.getHttpServer())
         .put(`${route}/candidat/${loggedInCandidat.user.id}`)
         .set('authorization', `Token ${loggedInCoach.token}`)
         .send({
           employed: false,
           note: 'updated note by coach',
         });
       expect(response.status).toBe(200);
     });
     it("Should return 401, if candidat doesn't updates himself", async () => {
       const response = await request(app.getHttpServer())
         .put(`${route}/candidat/${loggedInCandidat.user.id}`)
         .set('authorization', `Token ${otherLoggedInCandidat.token}`)
         .send({
           employed: false,
           note: 'updated note by other',
         });
       expect(response.status).toBe(401);
     });
     it('Should return 401, if coach updates candidate not associated to him', async () => {
       const response = await request(app.getHttpServer())
         .put(`${route}/candidat/${otherLoggedInCandidat.user.id}`)
         .set('authorization', `Token ${loggedInCoach.token}`)
         .send({
           employed: false,
           note: 'updated note by not associated coach',
         });
       expect(response.status).toBe(401);
     });
   });
 });
 */
    // TODO put in unit tests
    /* describe('D - Delete 1 User', () => {
      it('Should return 401 if not logged in admin', async () => {
        const response = await request(app.getHttpServer())
          .delete(`${route}/${otherLoggedInCandidat.user.id}`)
          .set('authorization', `Token ${loggedInCoach.token}`);
        expect(response.status).toBe(401);
      });
      it('Should return 200 if logged in as admin', async () => {
        const uniqIdToFind = uuid();
        const uniqId2ToFind = uuid();

        const { id: cvId } = await cvFactory.create(
          {
            UserId: otherLoggedInCandidat.user.id,
            urlImg: `images/${otherLoggedInCandidat.user.id}.Published.jpg`,
            intro: null,
            story: 'test',
            location: 'Paris',
            availability: 'En semaine',
            transport: 'Permis B',
            catchphrase: 'Helloooooo',
            status: 'Progress',
          },
          {
            contracts: [uniqIdToFind],
            languages: [uniqIdToFind],
            passions: [uniqIdToFind],
            skills: [uniqIdToFind],
            ambitions: [
              { prefix: 'dans', name: uniqIdToFind, order: 0 },
              { prefix: 'dans', name: uniqId2ToFind, order: 1 },
            ],
            businessLines: [
              { name: uniqIdToFind, order: 0 },
              { name: uniqId2ToFind, order: 1 },
            ],
            locations: [uniqIdToFind],
            experiences: [
              {
                description: uniqIdToFind,
                skills: [uniqId2ToFind],
                order: '0',
              },
            ],
            reviews: [
              {
                text: uniqIdToFind,
                status: uniqIdToFind,
                name: uniqIdToFind,
              },
            ],
          },
          true
        );

        const response = await request(app.getHttpServer())
          .delete(`${route}/${otherLoggedInCandidat.user.id}`)
          .set('authorization', `Token ${loggedInAdmin.token}`);

        expect(response.status).toBe(200);

        const ambitionsCount = await Ambition.count({
          where: {
            [Op.or]: [{ name: uniqIdToFind }, { name: uniqId2ToFind }],
          },
        });
        const cvAmbitionsCount = await CV_Ambition.count({
          where: {
            CVId: cvId,
          },
        });
        expect(ambitionsCount).toBe(2);
        expect(cvAmbitionsCount).toBe(0);

        const businessLinesCount = await Ambition.count({
          where: {
            [Op.or]: [{ name: uniqIdToFind }, { name: uniqId2ToFind }],
          },
        });
        const cvBusinessLinesCount = await CV_Ambition.count({
          where: {
            CVId: cvId,
          },
        });
        expect(businessLinesCount).toBe(2);
        expect(cvBusinessLinesCount).toBe(0);

        const contractsCount = await Contract.count({
          where: {
            name: uniqIdToFind,
          },
        });
        const cvContractsCount = await CV_Contract.count({
          where: {
            CVId: cvId,
          },
        });
        expect(contractsCount).toBe(1);
        expect(cvContractsCount).toBe(0);

        const languagesCount = await Language.count({
          where: {
            name: uniqIdToFind,
          },
        });
        const cvLanguagesCount = await CV_Language.count({
          where: {
            CVId: cvId,
          },
        });
        expect(languagesCount).toBe(1);
        expect(cvLanguagesCount).toBe(0);

        const passionsCount = await Passion.count({
          where: {
            name: uniqIdToFind,
          },
        });
        const cvPassionsCount = await CV_Passion.count({
          where: {
            CVId: cvId,
          },
        });
        expect(passionsCount).toBe(1);
        expect(cvPassionsCount).toBe(0);

        const skillsCount = await Skill.count({
          where: {
            name: uniqIdToFind,
          },
        });
        const cvSkillsCount = await CV_Skill.count({
          where: {
            CVId: cvId,
          },
        });
        expect(skillsCount).toBe(1);
        expect(cvSkillsCount).toBe(0);

        const locationsCount = await Location.count({
          where: {
            name: uniqIdToFind,
          },
        });
        const cvLocationsCount = await CV_Locations.count({
          where: {
            CVId: cvId,
          },
        });
        expect(locationsCount).toBe(1);
        expect(cvLocationsCount).toBe(0);

        const cvExperiencesCount = await Experience.count({
          where: {
            CVId: cvId,
          },
        });
        const expSkillsCount = await Skill.count({
          where: {
            name: uniqId2ToFind,
          },
        });

        expect(cvExperiencesCount).toBe(0);
        expect(expSkillsCount).toBe(1);

        const searchesCount = await CV_Search.count({
          where: {
            CVId: cvId,
          },
        });
        expect(searchesCount).toBe(0);

        const reviewsCount = await Review.count({
          where: {
            CVId: cvId,
          },
        });
        expect(reviewsCount).toBe(0);
      });
      it('Should return 401 if try to get user after deletion', async () => {
        const response = await request(app.getHttpServer())
          .get(`${route}/${otherLoggedInCandidat.user.id}`)
          .set('authorization', `Token ${loggedInAdmin.token}`);
        expect(response.status).toBe(401);
      });
      it("Should return 204 if try to get user's CV after deletion", async () => {
        const response = await request(app.getHttpServer())
          .get(`${cvRoute}?userId=${otherLoggedInCandidat.user.id}`)
          .set('authorization', `Token ${loggedInAdmin.token}`);
        expect(response.status).toBe(204);
      });
    });*/
  });
});
