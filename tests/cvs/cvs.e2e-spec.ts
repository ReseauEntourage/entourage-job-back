import { getQueueToken } from '@nestjs/bull';
import { CACHE_MANAGER, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { LoggedUser } from 'src/auth/auth.types';
import { CVStatuses } from 'src/cvs/cvs.types';
import { Queues } from 'src/queues/queues.types';
import { UserRoles } from 'src/users/users.types';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import { UserCandidatsHelper } from 'tests/users/user-candidats.helper';
import { UserFactory } from 'tests/users/user.factory';
import { UsersHelper } from 'tests/users/users.helper';
import { CVFactory } from './cv.factory';
import { CVsHelper } from './cvs.helper';

describe('CVs', () => {
  let loggedInAdmin: LoggedUser;
  let loggedInCandidat: LoggedUser;
  let loggedInCoach: LoggedUser;
  let loggedInOtherCandidat: LoggedUser;
  let loggedInOtherCoach: LoggedUser;
  let path: string;

  let app: INestApplication;

  let databaseHelper: DatabaseHelper;
  let cvFactory: CVFactory;
  let cvHelper: CVsHelper;
  let userFactory: UserFactory;
  let userHelper: UsersHelper;
  let userCandidatHelper: UserCandidatsHelper;

  const route = '/cv';

  const queueMock = { add: jest.fn() };
  const cacheMock = { get: jest.fn(), set: jest.fn(), del: jest.fn() };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [CustomTestingModule],
    })
      .overrideProvider(getQueueToken(Queues.WORK))
      .useValue(queueMock)
      .overrideProvider(CACHE_MANAGER)
      .useValue(cacheMock)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    databaseHelper = moduleFixture.get<DatabaseHelper>(DatabaseHelper);
    userHelper = moduleFixture.get<UsersHelper>(UsersHelper);
    userFactory = moduleFixture.get<UserFactory>(UserFactory);
    userCandidatHelper =
      moduleFixture.get<UserCandidatsHelper>(UserCandidatsHelper);
    cvHelper = moduleFixture.get<CVsHelper>(CVsHelper);

    await databaseHelper.resetTestDB();
    const admin = await userFactory.create({
      role: UserRoles.ADMIN,
      password: 'admin',
    });
    const coach = await userFactory.create({
      role: UserRoles.COACH,
      password: 'coach',
    });
    const candidat = await userFactory.create({
      role: UserRoles.CANDIDAT,
      password: 'candidat',
    });
    const otherCandidat = await userFactory.create({
      role: UserRoles.CANDIDAT,
      password: 'otherCandidat',
    });
    const otherCoach = await userFactory.create({
      role: UserRoles.COACH,
      password: 'otherCoach',
    });
    await cvFactory.create({
      status: CVStatuses.Published.value,
      UserId: candidat.id,
    });
    await cvFactory.create({
      status: CVStatuses.Published.value,
      UserId: otherCandidat.id,
    });
    admin.password = 'admin';
    coach.password = 'coach';
    candidat.password = 'candidat';
    otherCoach.password = 'otherCoach';
    otherCandidat.password = 'otherCandidat';

    await userCandidatHelper.associateCoachAndCandidat(coach, candidat);
    await userCandidatHelper.associateCoachAndCandidat(
      otherCoach,
      otherCandidat
    );
    loggedInAdmin = await userHelper.createLoggedInUser(admin, {}, false);
    loggedInCoach = await userHelper.createLoggedInUser(coach, {}, false);
    loggedInCandidat = await userHelper.createLoggedInUser(candidat, {}, false);

    loggedInOtherCoach = await userHelper.createLoggedInUser(
      otherCoach,
      {},
      false
    );
    loggedInOtherCandidat = await userHelper.createLoggedInUser(
      otherCandidat,
      {},
      false
    );
    path = cvHelper.getTestImagePath();
  });

  afterAll(async () => {
    await databaseHelper.resetTestDB();
    await app.close();
  });

  // TODO PUT BACK
  /*
  beforeEach(async () => {
    await databaseHelper.resetTestDB();
  });
  */

  const invalidToken =
    // eslint-disable-next-line max-len
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImxheW5lX2JhaHJpbmdlckBob3RtYWlsLmNvbSIsImlkIjoiMWM0NzI0MzEtZTg4NS00MGVhLWI0MWEtMjA1M2RlODJhZDJlIiwiZmlyc3ROYW1lIjoiT2N0YXZpYSIsImxhc3ROYW1lIjoiWXVuZHQiLCJwaG9uZSI6IjI2Mi0wMzItOTY2NCB4NzY5NCIsImdlbmRlciI6MCwicm9sZSI6IkNhbmRpZGF0IiwiZXhwIjoxNjAzNDM3OTE4LCJjYW5kaWRhdElkIjpudWxsLCJjb2FjaElkIjpudWxsLCJpYXQiOjE1OTgyNTM5MTh9.TrUmF20O7TJR2NwqjyyJJvEoBjs59Q3ClqX6PEHUsOw';

  describe('CRUD CV', () => {
    describe('C - Create 1 CV', () => {
      it('Should return 200 and CV with cv status set as progress if logged in user', async () => {
        const cv = await cvFactory.create(
          {
            UserId: loggedInCandidat.user.id,
          },
          {},
          false
        );
        const cvResponse = {
          ...cv,
          status: CVStatuses.Progress.value,
        };
        delete cvResponse.status;
        const response = await request(app.getHttpServer())
          .post(`${route}/`)
          .set('authorization', `Token ${loggedInCandidat.token}`)
          .set('Content-Type', 'multipart/form-data')
          .field('cv', JSON.stringify(cv))
          .attach('profileImage', path);
        expect(response.status).toBe(200);
        expect(response.body).toMatchObject(cvResponse);
      });

      it('Should return 200 and cvHasBeenModified, if coach checks if CV has been updated', async () => {
        const response = await request(app.getHttpServer())
          .get(`${route}/checkUpdate`)
          .set('authorization', `Token ${loggedInCoach.token}`);
        expect(response.status).toBe(200);
        expect(response.body.cvHasBeenModified).toBe(true);
      });
      it('Should return 200 and cvHasBeenModified be false, if coach reads CV', async () => {
        const setHasReadCVRequest = await request(app.getHttpServer())
          .put(`${route}/read/${loggedInCandidat.user.id}`)
          .set('authorization', `Token ${loggedInCoach.token}`);
        expect(setHasReadCVRequest.status).toBe(200);

        const response = await request(app.getHttpServer())
          .get(`${route}/checkUpdate`)
          .set('authorization', `Token ${loggedInCoach.token}`);
        expect(response.status).toBe(200);
        expect(response.body.cvHasBeenModified).toBe(false);
      });

      it("Should return 200 and CV with cv status set as progress, if logged in user is coach of cv's owner", async () => {
        const cv = await cvFactory.create(
          {
            UserId: loggedInCandidat.user.id,
            urlImg: null,
          },
          {},
          false
        );
        cv.status = undefined;
        const response = await request(app.getHttpServer())
          .post(`${route}/`)
          .set('authorization', `Token ${loggedInCoach.token}`)
          .field('cv', JSON.stringify(cv))
          .attach('profileImage', path);
        expect(response.status).toBe(200);
        expect(response.body.status).toMatch(CVStatuses.Progress.value);
      });
      it("Should return 200 and CV with cv status set as pending if CV submitted, if logged in user is coach of cv's owner", async () => {
        const cv = await cvFactory.create(
          {
            UserId: loggedInCandidat.user.id,
            urlImg: null,
          },
          {},
          false
        );
        cv.status = CVStatuses.Pending.value;
        const response = await request(app.getHttpServer())
          .post(`${route}/`)
          .set('authorization', `Token ${loggedInCoach.token}`)
          .field('cv', JSON.stringify(cv))
          .attach('profileImage', path);
        expect(response.status).toBe(200);
        expect(response.body.status).toMatch(CVStatuses.Pending.value);
      });

      it('Should return 200 and cvHasBeenModified, if candidat checks if CV has been updated', async () => {
        const response = await request(app.getHttpServer())
          .get(`${route}/checkUpdate`)
          .set('authorization', `Token ${loggedInCandidat.token}`);
        expect(response.status).toBe(200);
        expect(response.body.cvHasBeenModified).toBe(true);
      });

      it('Should return 200 and cvHasBeenModified be false, if candidat reads CV', async () => {
        const setHasReadCVRequest = await request(app.getHttpServer())
          .put(`${route}/read/${loggedInCandidat.user.id}`)
          .set('authorization', `Token ${loggedInCandidat.token}`);
        expect(setHasReadCVRequest.status).toBe(200);

        const response = await request(app.getHttpServer())
          .get(`${route}/checkUpdate`)
          .set('authorization', `Token ${loggedInCandidat.token}`);
        expect(response.status).toBe(200);
        expect(response.body.cvHasBeenModified).toBe(false);
      });

      it('Should return 200 and CV with cv status set as published, if logged in admin', async () => {
        const cv = await cvFactory.create(
          {
            UserId: loggedInCandidat.user.id,
            urlImg: null,
          },
          {},
          false
        );
        cv.status = undefined;
        const cvResponse = {
          ...cv,
          status: CVStatuses.Published.value,
        };
        const response = await request(app.getHttpServer())
          .post(`${route}/`)
          .set('authorization', `Token ${loggedInAdmin.token}`)
          .send({ cv });
        expect(response.status).toBe(200);
        expect(response.body).toMatchObject(cvResponse);
      });
      it('Should return 200 and CV with cv status set as draft, if logged in admin', async () => {
        const cv = await cvFactory.create(
          {
            UserId: loggedInCandidat.user.id,
            status: CVStatuses.Draft.value,
            urlImg: null,
          },
          {},
          false
        );
        const response = await request(app.getHttpServer())
          .post(`${route}/`)
          .set('authorization', `Token ${loggedInAdmin.token}`)
          .send({ cv });
        expect(response.status).toBe(200);
        expect(response.body).toMatchObject(cv);
      });

      it('Should return 401 if not logged in user', async () => {
        const cv = await cvFactory.create(
          { UserId: loggedInCandidat.user.id },
          {},
          false
        );
        const response = await request(app.getHttpServer())
          .post(`${route}/`)
          .send({ cv });
        expect(response.status).toBe(401);
      });
    });
    describe('R - Read 1 CV', () => {
      describe('Get a CV by user id - /?userId', () => {
        it('Should return 200 if valid user id provided and logged in as candidate', async () => {
          const response = await request(app.getHttpServer())
            .get(`${route}/?userId=${loggedInCandidat.user.id}`)
            .set('authorization', `Token ${loggedInCandidat.token}`);
          expect(response.status).toBe(200);
          expect(response.body.UserId).toBe(loggedInCandidat.user.id);
        });
        it('Should return 200 if valid user id provided and logged in as coach', async () => {
          const response = await request(app.getHttpServer())
            .get(`${route}/?userId=${loggedInCandidat.user.id}`)
            .set('authorization', `Token ${loggedInCoach.token}`);
          expect(response.status).toBe(200);
          expect(response.body.UserId).toBe(loggedInCandidat.user.id);
        });
        it('Should return 200 if valid user id provided and logged in as admin', async () => {
          const response = await request(app.getHttpServer())
            .get(`${route}/?userId=${loggedInCandidat.user.id}`)
            .set('authorization', `Token ${loggedInAdmin.token}`);
          expect(response.status).toBe(200);
          expect(response.body.UserId).toBe(loggedInCandidat.user.id);
        });
        it("Should return 204 if valid user id provided and logged in as candidate and candidate doesn't have a CV", async () => {
          const candidatNoCv = await userHelper.createLoggedInUser({
            role: UserRoles.CANDIDAT,
            password: 'candidatNoCv',
          });
          const response = await request(app.getHttpServer())
            .get(`${route}/?userId=${candidatNoCv.user.id}`)
            .set('authorization', `Token ${candidatNoCv.token}`);
          expect(response.status).toBe(204);
        });
        it("Should return 204 if valid user id provided and logged in as coach and candidate doesn't have a CV", async () => {
          const candidatNoCv = await userFactory.create({
            role: UserRoles.CANDIDAT,
            password: 'candidatNoCv',
          });
          const coachNoCv = await userFactory.create({
            role: UserRoles.COACH,
            password: 'coachNoCv',
          });

          await userCandidatHelper.associateCoachAndCandidat(
            coachNoCv,
            candidatNoCv
          );

          const loggedCandidatNoCv = await userHelper.createLoggedInUser(
            candidatNoCv,
            {},
            false
          );
          const loggedCoachNoCv = await userHelper.createLoggedInUser(
            coachNoCv,
            {},
            false
          );

          const response = await request(app.getHttpServer())
            .get(`${route}/?userId=${loggedCandidatNoCv.user.id}`)
            .set('authorization', `Token ${loggedCoachNoCv.token}`);
          expect(response.status).toBe(204);
        });
        it("Should return 204 if valid user id provided and logged in as admin and candidate doesn't have a CV", async () => {
          const candidatNoCv = await userHelper.createLoggedInUser({
            role: UserRoles.CANDIDAT,
            password: 'candidatNoCv',
          });
          const response = await request(app.getHttpServer())
            .get(`${route}/?userId=${candidatNoCv.user.id}`)
            .set('authorization', `Token ${loggedInAdmin.token}`);
          expect(response.status).toBe(204);
        });
        it('Should return 401 if invalid user id provided', async () => {
          const response = await request(app.getHttpServer()).get(
            `${route}/?userId=123-fakeuserid`
          );
          expect(response.status).toBe(401);
        });
        it('Should return 401 if valid user id provided and not logged in', async () => {
          const response = await request(app.getHttpServer()).get(
            `${route}/?userId=${loggedInCandidat.user.id}`
          );
          expect(response.status).toBe(401);
        });
        it('Should return 401 if valid user id provided and logged in as other candidate', async () => {
          const response = await request(app.getHttpServer())
            .get(`${route}/?userId=${loggedInCandidat.user.id}`)
            .set('authorization', `Token ${loggedInOtherCandidat.token}`);
          expect(response.status).toBe(401);
        });
        it('Should return 401 if valid user id provided and logged in as other coach', async () => {
          const response = await request(app.getHttpServer())
            .get(`${route}/?userId=${loggedInCandidat.user.id}`)
            .set('authorization', `Token ${loggedInOtherCoach.token}`);
          expect(response.status).toBe(401);
        });
        it('Should return 200 and last CV version if valid user id provided and logged in as candidate', async () => {
          const response = await request(app.getHttpServer())
            .get(`${route}/lastVersion/${loggedInCandidat.user.id}`)
            .set('authorization', `Token ${loggedInCandidat.token}`);
          expect(response.status).toBe(200);
          expect(response.body.lastCvVersion).toBe(6);
        });
        it('Should return 200 and last CV version if valid user id provided and logged in as coach', async () => {
          const response = await request(app.getHttpServer())
            .get(`${route}/lastVersion/${loggedInCandidat.user.id}`)
            .set('authorization', `Token ${loggedInCoach.token}`);
          expect(response.status).toBe(200);
          expect(response.body.lastCvVersion).toBe(6);
        });
        it('Should return 200 and last CV version if valid user id provided and logged in as admin', async () => {
          const response = await request(app.getHttpServer())
            .get(`${route}/lastVersion/${loggedInCandidat.user.id}`)
            .set('authorization', `Token ${loggedInAdmin.token}`);
          expect(response.status).toBe(200);
          expect(response.body.lastCvVersion).toBe(6);
        });
        it('Should return 401 and last CV version if valid user id provided and logged in as other candidate', async () => {
          const response = await request(app.getHttpServer())
            .get(`${route}/lastVersion/${loggedInCandidat.user.id}`)
            .set('authorization', `Token ${loggedInOtherCandidat.token}`);
          expect(response.status).toBe(401);
        });
        it('Should return 401 and last CV version if valid user id provided and logged in as other coach', async () => {
          const response = await request(app.getHttpServer())
            .get(`${route}/lastVersion/${loggedInCandidat.user.id}`)
            .set('authorization', `Token ${loggedInOtherCoach.token}`);
          expect(response.status).toBe(401);
        });
      });
      describe("Get a CV by candidat's url - /", () => {
        it("Should return 200 if valid candidat's url provided", async () => {
          const candidatUrl = await userCandidatHelper.getCandidatUrl(
            loggedInCandidat.user.id
          );
          const response = await request(app.getHttpServer()).get(
            `${route}/${candidatUrl}`
          );
          expect(response.status).toBe(200);
          expect(response.body.cv.UserId).toBe(loggedInCandidat.user.id);
        });
        it('Should return 200 if valid url provided and candidat has hidden CV', async () => {
          const candidatNoCv = await userHelper.createLoggedInUser({
            role: UserRoles.CANDIDAT,
            password: 'candidatNoCv',
          });
          const candidatNoCvUrl = await userCandidatHelper.getCandidatUrl(
            candidatNoCv.user.id
          );
          const response = await request(app.getHttpServer()).get(
            `${route}/${candidatNoCvUrl}`
          );
          expect(response.status).toBe(200);
          expect(response.body.cv).toBe(undefined);
        });
        it.skip("Should return 401 if candidat's url is invalid", async () => {
          const response = await request(app.getHttpServer()).get(
            `${route}/fakeuser-1234553`
          );
          expect(response.status).toBe(401);
        });
      });
    });
    describe('R - Read List of CVs', () => {
      describe('Get a list n random cv matching a search - /cards/random/?nb=&search=', () => {
        it('Should return 200, and 2 cv', async () => {
          const response = await request(app.getHttpServer()).get(
            `${route}/cards/random/?nb=2`
          );
          expect(response.status).toBe(200);
          expect(response.body.cvs.length).toBe(2);
        });
        it("Should return 200, and 1 cv if user's first name or other property contains the query", async () => {
          const newUser = await userFactory.create({
            firstName: 'xxxxKnownFirstNamexxxx',
            role: UserRoles.CANDIDAT,
          });
          const newCV = await cvFactory.create({
            status: CVStatuses.Published.value,
            UserId: newUser.id,
          });
          const response = await request(app.getHttpServer()).get(
            `${route}/cards/random/?nb=1&search=xxxxKnownFirstNamexxxx`
          );
          expect(response.status).toBe(200);
          expect(response.body.cvs.length).toBe(1);
          expect(response.body.cvs[0].id).toBe(newCV.id);
        });
        it('Should return 200 and empty list, if no result found', async () => {
          const response = await request(app.getHttpServer()).get(
            `${route}/cards/random/?nb=1&search=zzzzzzz`
          );
          expect(response.status).toBe(200);
          expect(response.body.cvs.length).toBe(0);
        });
        it('Should return 200 and many cv, if no nb provided', async () => {
          const response = await request(app.getHttpServer()).get(
            `${route}/cards/random/`
          );
          expect(response.status).toBe(200);
          expect(response.body.cvs.length).toBe(3);
        });
      });
      describe('Get a list of cvs matching specific filters', () => {
        it('Should return 200, and all the cvs that matches the location filters', async () => {
          const newUser1 = await userFactory.create({
            role: UserRoles.CANDIDAT,
          });
          const newCV1 = await cvFactory.create(
            {
              status: CVStatuses.Published.value,
              UserId: newUser1.id,
            },
            {
              locations: ['Paris (75)'],
            }
          );
          const newUser2 = await userFactory.create({
            role: UserRoles.CANDIDAT,
          });
          const newCV2 = await cvFactory.create(
            {
              status: CVStatuses.Published.value,
              UserId: newUser2.id,
            },
            {
              locations: ['Rhône (69)'],
            }
          );
          const newUser3 = await userFactory.create({
            role: UserRoles.CANDIDAT,
          });
          const newCV3 = await cvFactory.create(
            {
              status: CVStatuses.Published.value,
              UserId: newUser3.id,
            },
            {
              locations: ['Nord (59)'],
            }
          );
          const response = await request(app.getHttpServer()).get(
            `${route}/cards/random/?locations[]=Île-de-France&locations[]=Auvergne-Rhône-Alpes`
          );
          expect(response.status).toBe(200);
          expect(response.body.cvs.length).toBe(2);
          expect(response.body.cvs).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                id: newCV1.id,
              }),
              expect.objectContaining({
                id: newCV2.id,
              }),
            ])
          );
          expect(response.body.cvs).not.toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                id: newCV3.id,
              }),
            ])
          );
        });
        it('Should return 200, and all the cvs that matches the employed filters', async () => {
          const newUser1 = await userFactory.create(
            {
              role: UserRoles.CANDIDAT,
            },
            {
              employed: false,
            }
          );
          const newCV1 = await cvFactory.create({
            status: CVStatuses.Published.value,
            UserId: newUser1.id,
          });
          const newUser2 = await userFactory.create(
            {
              role: UserRoles.CANDIDAT,
            },
            {
              employed: false,
            }
          );
          const newCV2 = await cvFactory.create({
            status: CVStatuses.Published.value,
            UserId: newUser2.id,
          });
          const newUser3 = await userFactory.create(
            {
              role: UserRoles.CANDIDAT,
            },
            {
              employed: true,
            }
          );
          const newCV3 = await cvFactory.create({
            status: CVStatuses.Published.value,
            UserId: newUser3.id,
          });
          const response = await request(app.getHttpServer()).get(
            `${route}/cards/random/?employed[]=false`
          );
          expect(response.status).toBe(200);
          expect(response.body.cvs.length).toBe(8);
          expect(response.body.cvs).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                id: newCV1.id,
              }),
              expect.objectContaining({
                id: newCV2.id,
              }),
            ])
          );
          expect(response.body.cvs).not.toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                id: newCV3.id,
              }),
            ])
          );
        });
        it('Should return 200, and all the cvs that matches the businessLine filters', async () => {
          const newUser1 = await userFactory.create({
            role: UserRoles.CANDIDAT,
          });
          const newCV1 = await cvFactory.create(
            {
              status: CVStatuses.Published.value,
              UserId: newUser1.id,
            },
            {
              businessLines: ['id'],
            }
          );
          const newUser2 = await userFactory.create({
            role: UserRoles.CANDIDAT,
          });
          const newCV2 = await cvFactory.create(
            {
              status: CVStatuses.Published.value,
              UserId: newUser2.id,
            },
            {
              businessLines: ['bat'],
            }
          );
          const newUser3 = await userFactory.create({
            role: UserRoles.CANDIDAT,
          });
          const newCV3 = await cvFactory.create(
            {
              status: CVStatuses.Published.value,
              UserId: newUser3.id,
            },
            {
              businessLines: ['sa'],
            }
          );
          const response = await request(app.getHttpServer()).get(
            `${route}/cards/random/?businessLines[]=bat&businessLines[]=id`
          );
          expect(response.status).toBe(200);
          expect(response.body.cvs.length).toBe(2);
          expect(response.body.cvs).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                id: newCV1.id,
              }),
              expect.objectContaining({
                id: newCV2.id,
              }),
            ])
          );
          expect(response.body.cvs).not.toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                id: newCV3.id,
              }),
            ])
          );
        });
        it('Should return 200, and all the cvs that matches multiple filters (AND between different filters, OR inside each filters)', async () => {
          const newUser1 = await userFactory.create(
            {
              role: UserRoles.CANDIDAT,
            },
            {
              employed: false,
            }
          );
          const newCV1 = await cvFactory.create(
            {
              status: CVStatuses.Published.value,
              UserId: newUser1.id,
            },
            {
              businessLines: ['id'],
              locations: ['Paris (75)'],
            }
          );
          const newUser2 = await userFactory.create(
            {
              role: UserRoles.CANDIDAT,
            },
            {
              employed: false,
            }
          );
          const newCV2 = await cvFactory.create(
            {
              status: CVStatuses.Published.value,
              UserId: newUser2.id,
            },
            {
              businessLines: ['bat'],
              locations: ['Rhône (69)'],
            }
          );
          const newUser3 = await userFactory.create(
            {
              role: UserRoles.CANDIDAT,
            },
            {
              employed: true,
            }
          );
          const newCV3 = await cvFactory.create(
            {
              status: CVStatuses.Published.value,
              UserId: newUser3.id,
            },
            {
              businessLines: ['sa'],
              locations: ['Nord (59)'],
            }
          );
          const response = await request(app.getHttpServer()).get(
            `${route}/cards/random/?businessLines[]=sa&businessLines[]=id&employed[]=false&locations[]=Auvergne-Rhône-Alpes&locations[]=Hauts-de-France&locations[]=Île-de-France`
          );
          expect(response.status).toBe(200);
          expect(response.body.cvs.length).toBe(1);
          expect(response.body.cvs).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                id: newCV1.id,
              }),
            ])
          );
          expect(response.body.cvs).not.toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                id: newCV3.id,
              }),
              expect.objectContaining({
                id: newCV2.id,
              }),
            ])
          );
        });
        it("Should return 200, and cvs suggestions of same location if the businessLine filter doesn't match", async () => {
          const newUser1 = await userFactory.create(
            {
              role: UserRoles.CANDIDAT,
            },
            {
              employed: false,
            }
          );
          const newCV1 = await cvFactory.create(
            {
              status: CVStatuses.Published.value,
              UserId: newUser1.id,
            },
            {
              businessLines: ['id'],
              locations: ['Paris (75)'],
            }
          );
          const newUser2 = await userFactory.create(
            {
              role: UserRoles.CANDIDAT,
            },
            {
              employed: false,
            }
          );
          const newCV2 = await cvFactory.create(
            {
              status: CVStatuses.Published.value,
              UserId: newUser2.id,
            },
            {
              businessLines: ['bat'],
              locations: ['Paris (75)'],
            }
          );
          const newUser3 = await userFactory.create(
            {
              role: UserRoles.CANDIDAT,
            },
            {
              employed: false,
            }
          );
          const newCV3 = await cvFactory.create(
            {
              status: CVStatuses.Published.value,
              UserId: newUser3.id,
            },
            {
              businessLines: ['sa'],
              locations: ['Paris (75)'],
            }
          );
          const response = await request(app.getHttpServer()).get(
            `${route}/cards/random/?businessLines[]=tra&employed[]=false&locations[]=Île-de-France`
          );
          expect(response.status).toBe(200);
          expect(response.body.cvs.length).toBe(5);
          expect(response.body.suggestions).toBe(true);
          expect(response.body.cvs).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                id: newCV1.id,
              }),
              expect.objectContaining({
                id: newCV2.id,
              }),
              expect.objectContaining({
                id: newCV3.id,
              }),
            ])
          );
        });

        it('Should return 200 and empty list, if no result found', async () => {
          const response = await request(app.getHttpServer()).get(
            `${route}/cards/random/?locations[]=Bretagne`
          );
          expect(response.status).toBe(200);
          expect(response.body.cvs.length).toBe(0);
        });
        it('Should return 200 and many cv, if no nb provided', async () => {
          const response = await request(app.getHttpServer()).get(
            `${route}/cards/random/`
          );
          expect(response.status).toBe(200);
          expect(response.body.cvs.length).toBe(18);
        });
      });
    });
    describe('R - Read number of shares', () => {
      it('Should return 200 and the number of shares', async () => {
        const response = await request(app.getHttpServer()).get(
          `${route}/shares`
        );
        expect(response.status).toBe(200);
        expect(response.body.total).toBeTruthy();
      });
    });
    describe.skip('D - Delete 1 CV', () => {
      it('Should return 200, if logged in admin', async () => {
        const cv = await cvFactory.create({
          UserId: loggedInCandidat.user.id,
        });
        const response = await request(app.getHttpServer())
          .delete(`${route}/${cv.id}`)
          .set('authorization', `Token ${loggedInAdmin.token}`);
        expect(response.status).toBe(200);
      });
      it('Should return 401, if cv not found', async () => {
        const response = await request(app.getHttpServer()).delete(
          `${route}/3394b06e-b4eb-4a69-aba9-278ac1d9e1aa`
        );
        expect(response.status).toBe(401);
      });
      it('Should return 401, if not logged in admin', async () => {
        const cv = await cvFactory.create({
          UserId: loggedInCandidat.user.id,
        });
        const response = await request(app.getHttpServer()).delete(
          `${route}/${cv.id}`
        );
        expect(response.status).toBe(401);
      });
    });
  });
});
