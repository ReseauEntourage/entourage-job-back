import { getQueueToken } from '@nestjs/bull';
import { CACHE_MANAGER, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { v4 as uuid } from 'uuid';
import {
  CacheMocks,
  CloudFrontMocks,
  QueueMocks,
  S3Mocks,
} from '../mocks.types';
import { LoggedUser } from 'src/auth/auth.types';
import { CVsController } from 'src/cvs/cvs.controller';
import { CVsService } from 'src/cvs/cvs.service';
import { CloudFrontService } from 'src/external-services/aws/cloud-front.service';
import { S3Service } from 'src/external-services/aws/s3.service';
import { Queues } from 'src/queues/queues.types';
import { SharesController } from 'src/shares/shares.controller';
import { User } from 'src/users/models';
import { CVStatuses, UserRoles } from 'src/users/users.types';
import { APIResponse } from 'src/utils/types';
import { SharesHelper } from 'tests/common/shares/shares.helper';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import { UserCandidatsHelper } from 'tests/users/user-candidats.helper';
import { UserFactory } from 'tests/users/user.factory';
import { UsersHelper } from 'tests/users/users.helper';
import { CVFactory } from './cv.factory';
import { CVsHelper } from './cvs.helper';

describe('CVs', () => {
  let app: INestApplication;

  let databaseHelper: DatabaseHelper;
  let cvFactory: CVFactory;
  let cvsHelper: CVsHelper;
  let userFactory: UserFactory;
  let usersHelper: UsersHelper;
  let userCandidatsHelper: UserCandidatsHelper;
  let sharesHelper: SharesHelper;

  const route = '/cv';

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
      .overrideProvider(CloudFrontService)
      .useValue(CloudFrontMocks)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    databaseHelper = moduleFixture.get<DatabaseHelper>(DatabaseHelper);
    usersHelper = moduleFixture.get<UsersHelper>(UsersHelper);
    userFactory = moduleFixture.get<UserFactory>(UserFactory);
    userCandidatsHelper =
      moduleFixture.get<UserCandidatsHelper>(UserCandidatsHelper);
    cvsHelper = moduleFixture.get<CVsHelper>(CVsHelper);
    cvFactory = moduleFixture.get<CVFactory>(CVFactory);
    sharesHelper = moduleFixture.get<SharesHelper>(SharesHelper);
  });

  afterAll(async () => {
    await databaseHelper.resetTestDB();
    await app.close();
  });

  beforeEach(async () => {
    await databaseHelper.resetTestDB();
  });

  describe('CRUD CV', () => {
    describe('C - Create 1 CV', () => {
      describe('/:candidateId - Create CV for candidate', () => {
        let loggedInAdmin: LoggedUser;
        let loggedInCandidate: LoggedUser;
        let loggedInCoach: LoggedUser;
        let path: string;

        beforeEach(async () => {
          loggedInAdmin = await usersHelper.createLoggedInUser({
            role: UserRoles.ADMIN,
          });
          loggedInCoach = await usersHelper.createLoggedInUser({
            role: UserRoles.COACH,
          });
          loggedInCandidate = await usersHelper.createLoggedInUser({
            role: UserRoles.CANDIDATE,
          });
          path = cvsHelper.getTestImagePath();
        });

        it('Should return 201 and CV with cv status set as progress if logged in user', async () => {
          const { createdAt, updatedAt, version, urlImg, ...cv } =
            await cvFactory.create(
              {
                UserId: loggedInCandidate.user.id,
              },
              {},
              false
            );
          const cvResponse = {
            ...cv,
            status: CVStatuses.PROGRESS.value,
          };
          const response: APIResponse<CVsController['createCV']> =
            await request(app.getHttpServer())
              .post(`${route}/${loggedInCandidate.user.id}`)
              .set('authorization', `Token ${loggedInCandidate.token}`)
              .set('Content-Type', 'multipart/form-data')
              .field('cv', JSON.stringify(cv))
              .attach('profileImage', path);
          expect(response.status).toBe(201);
          expect(response.body).toEqual(expect.objectContaining(cvResponse));
        });
        it("Should return 201 and CV with cv status set as progress, if logged in user is coach of CV's owner", async () => {
          ({ loggedInCoach, loggedInCandidate: loggedInCandidate } =
            await userCandidatsHelper.associateCoachAndCandidate(
              loggedInCoach,
              loggedInCandidate,
              true
            ));
          const { createdAt, updatedAt, version, urlImg, ...cv } =
            await cvFactory.create(
              {
                UserId: loggedInCandidate.user.id,
                urlImg: null,
              },
              {},
              false
            );
          cv.status = undefined;

          const cvResponse = {
            ...cv,
            status: CVStatuses.PROGRESS.value,
          };

          const response: APIResponse<CVsController['createCV']> =
            await request(app.getHttpServer())
              .post(`${route}/${loggedInCandidate.user.id}`)
              .set('authorization', `Token ${loggedInCoach.token}`)
              .field('cv', JSON.stringify(cv))
              .attach('profileImage', path);
          expect(response.status).toBe(201);
          expect(response.body).toEqual(expect.objectContaining(cvResponse));
        });
        it("Should return 201 and CV with cv status set as pending if CV submitted, if logged in user is coach of CV's owner", async () => {
          ({ loggedInCoach, loggedInCandidate: loggedInCandidate } =
            await userCandidatsHelper.associateCoachAndCandidate(
              loggedInCoach,
              loggedInCandidate,
              true
            ));
          const { createdAt, updatedAt, version, urlImg, ...cv } =
            await cvFactory.create(
              {
                UserId: loggedInCandidate.user.id,
                urlImg: null,
              },
              {},
              false
            );
          const cvResponse = {
            ...cv,
            status: CVStatuses.PENDING.value,
          };
          const response: APIResponse<CVsController['createCV']> =
            await request(app.getHttpServer())
              .post(`${route}/${loggedInCandidate.user.id}`)
              .set('authorization', `Token ${loggedInCoach.token}`)
              .field('cv', JSON.stringify(cvResponse))
              .attach('profileImage', path);
          expect(response.status).toBe(201);
          expect(response.body).toEqual(expect.objectContaining(cvResponse));
        });
        it('Should return 201 and CV with cv status set as published, if logged in admin', async () => {
          const { createdAt, updatedAt, version, urlImg, ...cv } =
            await cvFactory.create(
              {
                UserId: loggedInCandidate.user.id,
                urlImg: null,
              },
              {},
              false
            );
          cv.status = undefined;
          const cvResponse = {
            ...cv,
            status: CVStatuses.PUBLISHED.value,
          };
          const response: APIResponse<CVsController['createCV']> =
            await request(app.getHttpServer())
              .post(`${route}/${loggedInCandidate.user.id}`)
              .set('authorization', `Token ${loggedInAdmin.token}`)
              .send({ cv });
          expect(response.status).toBe(201);
          expect(response.body).toEqual(expect.objectContaining(cvResponse));
        });
        it('Should return 201 and CV with cv status set as draft, if logged in admin', async () => {
          const { createdAt, updatedAt, version, urlImg, ...cv } =
            await cvFactory.create(
              {
                UserId: loggedInCandidate.user.id,
                status: CVStatuses.DRAFT.value,
                urlImg: null,
              },
              {},
              false
            );
          const cvResponse = {
            ...cv,
          };
          const response: APIResponse<CVsController['createCV']> =
            await request(app.getHttpServer())
              .post(`${route}/${loggedInCandidate.user.id}`)
              .set('authorization', `Token ${loggedInAdmin.token}`)
              .send({ cv });
          expect(response.status).toBe(201);
          expect(response.body).toEqual(expect.objectContaining(cvResponse));
        });
        it('Should return 401 if not logged in user', async () => {
          const { createdAt, updatedAt, version, urlImg, ...cv } =
            await cvFactory.create(
              { UserId: loggedInCandidate.user.id },
              {},
              false
            );
          const response: APIResponse<CVsController['createCV']> =
            await request(app.getHttpServer())
              .post(`${route}/${loggedInCandidate.user.id}`)
              .send({ cv });
          expect(response.status).toBe(401);
        });
      });
    });
    describe('R - Read 1 CV', () => {
      describe('/:candidateId - Get a CV by candidate id', () => {
        let loggedInAdmin: LoggedUser;
        let loggedInCandidate: LoggedUser;
        let loggedInCoach: LoggedUser;

        beforeEach(async () => {
          loggedInAdmin = await usersHelper.createLoggedInUser({
            role: UserRoles.ADMIN,
          });
          loggedInCoach = await usersHelper.createLoggedInUser({
            role: UserRoles.COACH,
          });
          loggedInCandidate = await usersHelper.createLoggedInUser({
            role: UserRoles.CANDIDATE,
          });
          await cvFactory.create({
            status: CVStatuses.PUBLISHED.value,
            UserId: loggedInCandidate.user.id,
          });
        });
        it('Should return 200 if valid user id provided and logged in as candidate', async () => {
          const response: APIResponse<CVsController['findCVByCandidateId']> =
            await request(app.getHttpServer())
              .get(`${route}/${loggedInCandidate.user.id}`)
              .set('authorization', `Token ${loggedInCandidate.token}`);
          expect(response.status).toBe(200);
          expect(response.body.UserId).toBe(loggedInCandidate.user.id);
        });
        it('Should return 200 if valid user id provided and logged in as coach', async () => {
          ({ loggedInCoach, loggedInCandidate: loggedInCandidate } =
            await userCandidatsHelper.associateCoachAndCandidate(
              loggedInCoach,
              loggedInCandidate,
              true
            ));
          const response: APIResponse<CVsController['findCVByCandidateId']> =
            await request(app.getHttpServer())
              .get(`${route}/${loggedInCandidate.user.id}`)
              .set('authorization', `Token ${loggedInCoach.token}`);
          expect(response.status).toBe(200);
          expect(response.body.UserId).toBe(loggedInCandidate.user.id);
        });
        it('Should return 200 if valid user id provided and logged in as admin', async () => {
          const response: APIResponse<CVsController['findCVByCandidateId']> =
            await request(app.getHttpServer())
              .get(`${route}/${loggedInCandidate.user.id}`)
              .set('authorization', `Token ${loggedInAdmin.token}`);
          expect(response.status).toBe(200);
          expect(response.body.UserId).toBe(loggedInCandidate.user.id);
        });
        it("Should return 200 if valid user id provided and logged in as candidate and candidate doesn't have a CV", async () => {
          const candidatNoCv = await usersHelper.createLoggedInUser({
            role: UserRoles.CANDIDATE,
            password: 'candidatNoCv',
          });
          const response: APIResponse<CVsController['findCVByCandidateId']> =
            await request(app.getHttpServer())
              .get(`${route}/${candidatNoCv.user.id}`)
              .set('authorization', `Token ${candidatNoCv.token}`);
          expect(response.status).toBe(200);
          expect(response.body).toStrictEqual({});
        });
        it("Should return 200 if valid user id provided and logged in as coach and candidate doesn't have a CV", async () => {
          const candidatNoCv = await userFactory.create({
            role: UserRoles.CANDIDATE,
            password: 'candidatNoCv',
          });
          const coachNoCv = await userFactory.create({
            role: UserRoles.COACH,
            password: 'coachNoCv',
          });

          await userCandidatsHelper.associateCoachAndCandidate(
            coachNoCv,
            candidatNoCv
          );

          const loggedCandidatNoCv = await usersHelper.createLoggedInUser(
            candidatNoCv,
            {},
            false
          );
          const loggedCoachNoCv = await usersHelper.createLoggedInUser(
            coachNoCv,
            {},
            false
          );

          const response: APIResponse<CVsController['findCVByCandidateId']> =
            await request(app.getHttpServer())
              .get(`${route}/${loggedCandidatNoCv.user.id}`)
              .set('authorization', `Token ${loggedCoachNoCv.token}`);
          expect(response.status).toBe(200);
          expect(response.body).toStrictEqual({});
        });
        it("Should return 200 if valid user id provided and logged in as admin and candidate doesn't have a CV", async () => {
          const candidatNoCv = await usersHelper.createLoggedInUser({
            role: UserRoles.CANDIDATE,
            password: 'candidatNoCv',
          });
          const response: APIResponse<CVsController['findCVByCandidateId']> =
            await request(app.getHttpServer())
              .get(`${route}/${candidatNoCv.user.id}`)
              .set('authorization', `Token ${loggedInAdmin.token}`);
          expect(response.status).toBe(200);
          expect(response.body).toStrictEqual({});
        });
        it('Should return 401 if invalid user id provided', async () => {
          const response: APIResponse<CVsController['findCVByCandidateId']> =
            await request(app.getHttpServer()).get(`${route}/123-fakeuserid`);
          expect(response.status).toBe(401);
        });
        it('Should return 401 if valid user id provided and not logged in', async () => {
          const response: APIResponse<CVsController['findCVByCandidateId']> =
            await request(app.getHttpServer()).get(
              `${route}/${loggedInCandidate.user.id}`
            );
          expect(response.status).toBe(401);
        });
        it('Should return 403 if valid user id provided and logged in as other candidate', async () => {
          const loggedInOtherCandidat = await usersHelper.createLoggedInUser({
            role: UserRoles.CANDIDATE,
          });
          const response: APIResponse<CVsController['findCVByCandidateId']> =
            await request(app.getHttpServer())
              .get(`${route}/${loggedInCandidate.user.id}`)
              .set('authorization', `Token ${loggedInOtherCandidat.token}`);
          expect(response.status).toBe(403);
        });
        it('Should return 403 if valid user id provided and logged in as other coach', async () => {
          const response: APIResponse<CVsController['findCVByCandidateId']> =
            await request(app.getHttpServer())
              .get(`${route}/${loggedInCandidate.user.id}`)
              .set('authorization', `Token ${loggedInCoach.token}`);
          expect(response.status).toBe(403);
        });
      });
      describe("/lastVersion/:candidateId - Get last version of candidate's CV", () => {
        let loggedInAdmin: LoggedUser;
        let loggedInCandidate: LoggedUser;
        let loggedInCoach: LoggedUser;

        beforeEach(async () => {
          loggedInAdmin = await usersHelper.createLoggedInUser({
            role: UserRoles.ADMIN,
          });
          loggedInCoach = await usersHelper.createLoggedInUser({
            role: UserRoles.COACH,
          });
          loggedInCandidate = await usersHelper.createLoggedInUser({
            role: UserRoles.CANDIDATE,
          });
          await cvFactory.create({
            status: CVStatuses.PUBLISHED.value,
            UserId: loggedInCandidate.user.id,
            version: 3,
          });
          await cvFactory.create({
            status: CVStatuses.PUBLISHED.value,
            UserId: loggedInCandidate.user.id,
            version: 2,
          });
          await cvFactory.create({
            status: CVStatuses.PUBLISHED.value,
            UserId: loggedInCandidate.user.id,
            version: 1,
          });
        });
        it('Should return 200 and last CV version if valid user id provided and logged in as candidate', async () => {
          const response: APIResponse<CVsController['findLastCVVersion']> =
            await request(app.getHttpServer())
              .get(`${route}/lastVersion/${loggedInCandidate.user.id}`)
              .set('authorization', `Token ${loggedInCandidate.token}`);
          expect(response.status).toBe(200);
          expect(response.body.lastCvVersion).toBe(3);
        });
        it('Should return 200 and last CV version if valid user id provided and logged in as coach', async () => {
          ({ loggedInCoach, loggedInCandidate: loggedInCandidate } =
            await userCandidatsHelper.associateCoachAndCandidate(
              loggedInCoach,
              loggedInCandidate,
              true
            ));
          const response: APIResponse<CVsController['findLastCVVersion']> =
            await request(app.getHttpServer())
              .get(`${route}/lastVersion/${loggedInCandidate.user.id}`)
              .set('authorization', `Token ${loggedInCoach.token}`);
          expect(response.status).toBe(200);
          expect(response.body.lastCvVersion).toBe(3);
        });
        it('Should return 200 and last CV version if valid user id provided and logged in as admin', async () => {
          const response: APIResponse<CVsController['findLastCVVersion']> =
            await request(app.getHttpServer())
              .get(`${route}/lastVersion/${loggedInCandidate.user.id}`)
              .set('authorization', `Token ${loggedInAdmin.token}`);
          expect(response.status).toBe(200);
          expect(response.body.lastCvVersion).toBe(3);
        });
        it('Should return 403 and last CV version if valid user id provided and logged in as other candidate', async () => {
          const loggedInOtherCandidat = await usersHelper.createLoggedInUser({
            role: UserRoles.CANDIDATE,
          });
          const response: APIResponse<CVsController['findLastCVVersion']> =
            await request(app.getHttpServer())
              .get(`${route}/lastVersion/${loggedInCandidate.user.id}`)
              .set('authorization', `Token ${loggedInOtherCandidat.token}`);
          expect(response.status).toBe(403);
        });
        it('Should return 403 and last CV version if valid user id provided and logged in as other coach', async () => {
          const response: APIResponse<CVsController['findLastCVVersion']> =
            await request(app.getHttpServer())
              .get(`${route}/lastVersion/${loggedInCandidate.user.id}`)
              .set('authorization', `Token ${loggedInCoach.token}`);
          expect(response.status).toBe(403);
        });
      });
      describe("/:url - Get a CV by candidate's url", () => {
        let candidate: User;

        beforeEach(async () => {
          candidate = await userFactory.create({
            role: UserRoles.CANDIDATE,
          });
          await cvFactory.create({
            status: CVStatuses.PUBLISHED.value,
            UserId: candidate.id,
          });
        });
        it("Should return 200 if valid candidate's url provided", async () => {
          const candidatUrl = await userCandidatsHelper.getCandidatUrl(
            candidate.id
          );
          const response: APIResponse<CVsController['findCVByUrl']> =
            await request(app.getHttpServer()).get(
              `${route}/url/${candidatUrl}`
            );
          expect(response.status).toBe(200);
          expect(response.body.cv.UserId).toBe(candidate.id);
        });
        it('Should return 200 if valid url provided and candidate has hidden CV', async () => {
          const candidatNoCv = await usersHelper.createLoggedInUser({
            role: UserRoles.CANDIDATE,
            password: 'candidatNoCv',
          });
          const candidatNoCvUrl = await userCandidatsHelper.getCandidatUrl(
            candidatNoCv.user.id
          );
          const response: APIResponse<CVsController['findCVByUrl']> =
            await request(app.getHttpServer()).get(
              `${route}/url/${candidatNoCvUrl}`
            );
          expect(response.status).toBe(200);
          expect(response.body.cv).toBe(null);
          expect(response.body.exists).toBe(true);
        });
        it("Should return 404 if candidate's url is invalid", async () => {
          const response: APIResponse<CVsController['findCVByUrl']> =
            await request(app.getHttpServer()).get(
              `${route}/url/fakeuser-1234553`
            );
          expect(response.status).toBe(404);
        });
      });
      describe('/pdf/:candidateId - Get a CV in PDF', () => {
        let loggedInAdmin: LoggedUser;
        let loggedInCandidate: LoggedUser;
        let loggedInCoach: LoggedUser;

        beforeEach(async () => {
          loggedInAdmin = await usersHelper.createLoggedInUser({
            role: UserRoles.ADMIN,
          });
          loggedInCoach = await usersHelper.createLoggedInUser({
            role: UserRoles.COACH,
          });
          loggedInCandidate = await usersHelper.createLoggedInUser({
            role: UserRoles.CANDIDATE,
          });
          await cvFactory.create({
            status: CVStatuses.PUBLISHED.value,
            UserId: loggedInCandidate.user.id,
          });
          jest
            .spyOn(CVsService.prototype, 'getPDFPageUrl')
            .mockImplementationOnce(() => cvsHelper.getTestHtmlPagePath());
        });

        it('Should return 401 if not logged in', async () => {
          const response: APIResponse<CVsController['findCVInPDF']> =
            await request(app.getHttpServer()).get(
              `${route}/pdf/${loggedInCandidate.user.id}`
            );
          expect(response.status).toBe(401);
        });

        it('Should return 403 if logged as another candidate', async () => {
          const loggedInOtherCandidat = await usersHelper.createLoggedInUser({
            role: UserRoles.CANDIDATE,
          });
          const response: APIResponse<CVsController['findCVInPDF']> =
            await request(app.getHttpServer())
              .get(`${route}/pdf/${loggedInCandidate.user.id}`)
              .set('authorization', `Token ${loggedInOtherCandidat.token}`);
          expect(response.status).toBe(403);
        });

        it('Should return 403 if logged as another coach', async () => {
          const response: APIResponse<CVsController['findCVInPDF']> =
            await request(app.getHttpServer())
              .get(`${route}/pdf/${loggedInCandidate.user.id}`)
              .set('authorization', `Token ${loggedInCoach.token}`);
          expect(response.status).toBe(403);
        });

        it('Should return 200 and PDF url if logged as candidate and PDF already exists', async () => {
          const response: APIResponse<CVsController['findCVInPDF']> =
            await request(app.getHttpServer())
              .get(`${route}/pdf/${loggedInCandidate.user.id}`)
              .set('authorization', `Token ${loggedInCandidate.token}`);
          expect(response.status).toBe(200);
          expect(response.body.pdfUrl).toMatch('url');
        });

        it('Should return 200 and PDF url if logged as coach and PDF already exists', async () => {
          ({ loggedInCoach, loggedInCandidate: loggedInCandidate } =
            await userCandidatsHelper.associateCoachAndCandidate(
              loggedInCoach,
              loggedInCandidate,
              true
            ));
          const response: APIResponse<CVsController['findCVInPDF']> =
            await request(app.getHttpServer())
              .get(`${route}/pdf/${loggedInCandidate.user.id}`)
              .set('authorization', `Token ${loggedInCoach.token}`);
          expect(response.status).toBe(200);
          expect(response.body.pdfUrl).toMatch('url');
        });

        it('Should return 200 and PDF url if logged as admin and PDF already exists', async () => {
          const response: APIResponse<CVsController['findCVInPDF']> =
            await request(app.getHttpServer())
              .get(`${route}/pdf/${loggedInCandidate.user.id}`)
              .set('authorization', `Token ${loggedInAdmin.token}`);
          expect(response.status).toBe(200);
          expect(response.body.pdfUrl).toMatch('url');
        });

        it("Should return 200 and PDF url if logged as candidate and PDF doesn't exist", async () => {
          jest
            .spyOn(CVsService.prototype, 'findPDF')
            .mockImplementationOnce(async () => null);
          const response: APIResponse<CVsController['findCVInPDF']> =
            await request(app.getHttpServer())
              .get(`${route}/pdf/${loggedInCandidate.user.id}`)
              .set('authorization', `Token ${loggedInCandidate.token}`);
          expect(response.status).toBe(200);
          expect(response.body.pdfUrl).toMatch('url');
        });

        it("Should return 200 and PDF url if logged as coach and PDF doesn't exist", async () => {
          ({ loggedInCoach, loggedInCandidate: loggedInCandidate } =
            await userCandidatsHelper.associateCoachAndCandidate(
              loggedInCoach,
              loggedInCandidate,
              true
            ));
          jest
            .spyOn(CVsService.prototype, 'findPDF')
            .mockImplementationOnce(async () => null);
          const response: APIResponse<CVsController['findCVInPDF']> =
            await request(app.getHttpServer())
              .get(`${route}/pdf/${loggedInCandidate.user.id}`)
              .set('authorization', `Token ${loggedInCoach.token}`);
          expect(response.status).toBe(200);
          expect(response.body.pdfUrl).toMatch('url');
        });

        it("Should return 200 and PDF url if logged as admin and PDF doesn't exist", async () => {
          jest
            .spyOn(CVsService.prototype, 'findPDF')
            .mockImplementationOnce(async () => null);
          const response: APIResponse<CVsController['findCVInPDF']> =
            await request(app.getHttpServer())
              .get(`${route}/pdf/${loggedInCandidate.user.id}`)
              .set('authorization', `Token ${loggedInAdmin.token}`);
          expect(response.status).toBe(200);
          expect(response.body.pdfUrl).toMatch('url');
        });
      });
    });
    describe('R - Read many CVs', () => {
      describe('/cards/random/?nb=&search= - Get a list of n random CVs matching a search', () => {
        it('Should return 200, and 2 CVs', async () => {
          const newUser1 = await userFactory.create({
            firstName: 'xxxxKnownFirstNamexxxx',
            role: UserRoles.CANDIDATE,
          });
          await cvFactory.create({
            status: CVStatuses.PUBLISHED.value,
            UserId: newUser1.id,
          });

          const newUser2 = await userFactory.create({
            role: UserRoles.CANDIDATE,
          });
          await cvFactory.create({
            status: CVStatuses.PUBLISHED.value,
            UserId: newUser2.id,
          });

          const newUser3 = await userFactory.create({
            role: UserRoles.CANDIDATE,
          });
          await cvFactory.create({
            status: CVStatuses.PUBLISHED.value,
            UserId: newUser3.id,
          });

          const response: APIResponse<CVsController['findAllPublishedCVs']> =
            await request(app.getHttpServer()).get(
              `${route}/cards/random/?nb=2`
            );
          expect(response.status).toBe(200);
          expect(response.body.cvs.length).toBe(2);
        });
        it("Should return 200, and 1 CV if user's first name or other property contains the query", async () => {
          const newUser1 = await userFactory.create({
            firstName: 'xxxxKnownFirstNamexxxx',
            role: UserRoles.CANDIDATE,
          });
          const newCV1 = await cvFactory.create({
            status: CVStatuses.PUBLISHED.value,
            UserId: newUser1.id,
          });

          const newUser2 = await userFactory.create({
            role: UserRoles.CANDIDATE,
          });
          await cvFactory.create({
            status: CVStatuses.PUBLISHED.value,
            UserId: newUser2.id,
          });

          const newUser3 = await userFactory.create({
            role: UserRoles.CANDIDATE,
          });
          await cvFactory.create({
            status: CVStatuses.PUBLISHED.value,
            UserId: newUser3.id,
          });

          const response: APIResponse<CVsController['findAllPublishedCVs']> =
            await request(app.getHttpServer()).get(
              `${route}/cards/random/?search=xxxxKnownFirstNamexxxx`
            );
          expect(response.status).toBe(200);
          expect(response.body.cvs.length).toBe(1);
          expect(response.body.cvs[0].id).toBe(newCV1.id);
        });
        it('Should return 200 and empty list, if no result found', async () => {
          const newUser1 = await userFactory.create({
            firstName: 'xxxxKnownFirstNamexxxx',
            role: UserRoles.CANDIDATE,
          });
          await cvFactory.create({
            status: CVStatuses.PUBLISHED.value,
            UserId: newUser1.id,
          });

          const newUser2 = await userFactory.create({
            role: UserRoles.CANDIDATE,
          });
          await cvFactory.create({
            status: CVStatuses.PUBLISHED.value,
            UserId: newUser2.id,
          });

          const newUser3 = await userFactory.create({
            role: UserRoles.CANDIDATE,
          });
          await cvFactory.create({
            status: CVStatuses.PUBLISHED.value,
            UserId: newUser3.id,
          });

          const response: APIResponse<CVsController['findAllPublishedCVs']> =
            await request(app.getHttpServer()).get(
              `${route}/cards/random/?nb=1&search=zzzzzzz`
            );
          expect(response.status).toBe(200);
          expect(response.body.cvs.length).toBe(0);
        });
        it('Should return 200 and many CVs, if no nb provided', async () => {
          const newUser1 = await userFactory.create({
            firstName: 'xxxxKnownFirstNamexxxx',
            role: UserRoles.CANDIDATE,
          });
          await cvFactory.create({
            status: CVStatuses.PUBLISHED.value,
            UserId: newUser1.id,
          });

          const newUser2 = await userFactory.create({
            role: UserRoles.CANDIDATE,
          });
          await cvFactory.create({
            status: CVStatuses.PUBLISHED.value,
            UserId: newUser2.id,
          });

          const newUser3 = await userFactory.create({
            role: UserRoles.CANDIDATE,
          });
          await cvFactory.create({
            status: CVStatuses.PUBLISHED.value,
            UserId: newUser3.id,
          });

          const response: APIResponse<CVsController['findAllPublishedCVs']> =
            await request(app.getHttpServer()).get(`${route}/cards/random`);
          expect(response.status).toBe(200);
          expect(response.body.cvs.length).toBe(3);
        });
      });
      describe('/cards/random/?locations[]=&employed[]=&businessLine[]= - Get a list of CVs matching specific filters', () => {
        it('Should return 200, and all the CVs that matches the location filters', async () => {
          const newUser1 = await userFactory.create({
            role: UserRoles.CANDIDATE,
          });
          const newCV1 = await cvFactory.create(
            {
              status: CVStatuses.PUBLISHED.value,
              UserId: newUser1.id,
            },
            {
              locations: ['Paris (75)'],
            }
          );
          const newUser2 = await userFactory.create({
            role: UserRoles.CANDIDATE,
          });
          const newCV2 = await cvFactory.create(
            {
              status: CVStatuses.PUBLISHED.value,
              UserId: newUser2.id,
            },
            {
              locations: ['Rhône (69)'],
            }
          );
          const newUser3 = await userFactory.create({
            role: UserRoles.CANDIDATE,
          });
          await cvFactory.create(
            {
              status: CVStatuses.PUBLISHED.value,
              UserId: newUser3.id,
            },
            {
              locations: ['Nord (59)'],
            }
          );
          const expectedCVsIds = [newCV1.id, newCV2.id];
          const response: APIResponse<CVsController['findAllPublishedCVs']> =
            await request(app.getHttpServer()).get(
              `${route}/cards/random/?locations[]=Île-de-France&locations[]=Auvergne-Rhône-Alpes`
            );
          expect(response.status).toBe(200);
          expect(response.body.cvs.length).toBe(2);
          expect(expectedCVsIds).toEqual(
            expect.arrayContaining(response.body.cvs.map(({ id }) => id))
          );
        });
        it('Should return 200, and all the CVs that matches the employed filters', async () => {
          const newUser1 = await userFactory.create(
            {
              role: UserRoles.CANDIDATE,
            },
            {
              employed: false,
            }
          );
          const newCV1 = await cvFactory.create({
            status: CVStatuses.PUBLISHED.value,
            UserId: newUser1.id,
          });
          const newUser2 = await userFactory.create(
            {
              role: UserRoles.CANDIDATE,
            },
            {
              employed: false,
            }
          );
          const newCV2 = await cvFactory.create({
            status: CVStatuses.PUBLISHED.value,
            UserId: newUser2.id,
          });
          const newUser3 = await userFactory.create(
            {
              role: UserRoles.CANDIDATE,
            },
            {
              employed: true,
            }
          );
          await cvFactory.create({
            status: CVStatuses.PUBLISHED.value,
            UserId: newUser3.id,
          });
          const expectedCVsIds = [newCV1.id, newCV2.id];

          const response: APIResponse<CVsController['findAllPublishedCVs']> =
            await request(app.getHttpServer()).get(
              `${route}/cards/random/?employed[]=false`
            );
          expect(response.status).toBe(200);
          expect(response.body.cvs.length).toBe(2);
          expect(expectedCVsIds).toEqual(
            expect.arrayContaining(response.body.cvs.map(({ id }) => id))
          );
        });
        it('Should return 200, and all the CVs that matches the businessLine filters', async () => {
          const newUser1 = await userFactory.create({
            role: UserRoles.CANDIDATE,
          });
          const newCV1 = await cvFactory.create(
            {
              status: CVStatuses.PUBLISHED.value,
              UserId: newUser1.id,
            },
            {
              businessLines: ['id'],
            }
          );
          const newUser2 = await userFactory.create({
            role: UserRoles.CANDIDATE,
          });
          const newCV2 = await cvFactory.create(
            {
              status: CVStatuses.PUBLISHED.value,
              UserId: newUser2.id,
            },
            {
              businessLines: ['bat'],
            }
          );
          const newUser3 = await userFactory.create({
            role: UserRoles.CANDIDATE,
          });
          await cvFactory.create(
            {
              status: CVStatuses.PUBLISHED.value,
              UserId: newUser3.id,
            },
            {
              businessLines: ['sa'],
            }
          );
          const expectedCVsIds = [newCV1.id, newCV2.id];

          const response: APIResponse<CVsController['findAllPublishedCVs']> =
            await request(app.getHttpServer()).get(
              `${route}/cards/random/?businessLines[]=bat&businessLines[]=id`
            );
          expect(response.status).toBe(200);
          expect(response.body.cvs.length).toBe(2);
          expect(expectedCVsIds).toEqual(
            expect.arrayContaining(response.body.cvs.map(({ id }) => id))
          );
        });
        it("Should return 200, and CVs suggestions of same location if the businessLine filter doesn't match", async () => {
          const newUser1 = await userFactory.create({
            role: UserRoles.CANDIDATE,
          });
          const newCV1 = await cvFactory.create(
            {
              status: CVStatuses.PUBLISHED.value,
              UserId: newUser1.id,
            },
            {
              businessLines: ['id'],
              locations: ['Paris (75)'],
            }
          );
          const newUser2 = await userFactory.create({
            role: UserRoles.CANDIDATE,
          });
          const newCV2 = await cvFactory.create(
            {
              status: CVStatuses.PUBLISHED.value,
              UserId: newUser2.id,
            },
            {
              businessLines: ['bat'],
              locations: ['Paris (75)'],
            }
          );
          const newUser3 = await userFactory.create({
            role: UserRoles.CANDIDATE,
          });
          const newCV3 = await cvFactory.create(
            {
              status: CVStatuses.PUBLISHED.value,
              UserId: newUser3.id,
            },
            {
              businessLines: ['sa'],
              locations: ['Paris (75)'],
            }
          );

          const expectedCVsIds = [newCV1.id, newCV2.id, newCV3.id];

          const response: APIResponse<CVsController['findAllPublishedCVs']> =
            await request(app.getHttpServer()).get(
              `${route}/cards/random/?businessLines[]=tra&locations[]=Île-de-France`
            );
          expect(response.status).toBe(200);
          expect(response.body.cvs.length).toBe(3);
          expect(response.body.suggestions).toBe(true);

          expect(expectedCVsIds).toEqual(
            expect.arrayContaining(response.body.cvs.map(({ id }) => id))
          );
        });

        it('Should return 200 and empty list, if no result found', async () => {
          const newUser1 = await userFactory.create({
            role: UserRoles.CANDIDATE,
          });
          await cvFactory.create(
            {
              status: CVStatuses.PUBLISHED.value,
              UserId: newUser1.id,
            },
            {
              locations: ['Paris (75)'],
            }
          );
          const newUser2 = await userFactory.create({
            role: UserRoles.CANDIDATE,
          });
          await cvFactory.create(
            {
              status: CVStatuses.PUBLISHED.value,
              UserId: newUser2.id,
            },
            {
              locations: ['Paris (75)'],
            }
          );
          const newUser3 = await userFactory.create({
            role: UserRoles.CANDIDATE,
          });
          await cvFactory.create(
            {
              status: CVStatuses.PUBLISHED.value,
              UserId: newUser3.id,
            },
            {
              locations: ['Paris (75)'],
            }
          );

          const response: APIResponse<CVsController['findAllPublishedCVs']> =
            await request(app.getHttpServer()).get(
              `${route}/cards/random/?locations[]=Bretagne`
            );
          expect(response.status).toBe(200);
          expect(response.body.cvs.length).toBe(0);
        });
        it('Should return 200 and many cv, if no filters provided', async () => {
          const newUser1 = await userFactory.create({
            firstName: 'xxxxKnownFirstNamexxxx',
            role: UserRoles.CANDIDATE,
          });
          await cvFactory.create({
            status: CVStatuses.PUBLISHED.value,
            UserId: newUser1.id,
          });

          const newUser2 = await userFactory.create({
            role: UserRoles.CANDIDATE,
          });
          await cvFactory.create({
            status: CVStatuses.PUBLISHED.value,
            UserId: newUser2.id,
          });

          const newUser3 = await userFactory.create({
            role: UserRoles.CANDIDATE,
          });
          await cvFactory.create({
            status: CVStatuses.PUBLISHED.value,
            UserId: newUser3.id,
          });

          const response: APIResponse<CVsController['findAllPublishedCVs']> =
            await request(app.getHttpServer()).get(`${route}/cards/random`);
          expect(response.status).toBe(200);
          expect(response.body.cvs.length).toBe(3);
        });
      });
    });
    describe('R - Read counts', () => {
      describe('/shares - Count number of shares', () => {
        it('Should return 200 and the number of shares', async () => {
          const response: APIResponse<SharesController['countTotalShares']> =
            await request(app.getHttpServer()).get(`${route}/shares`);
          expect(response.status).toBe(200);
          expect(response.body.total).toBe(184000);
        });
      });
      describe('/published - Count number of published CVs', () => {
        it('Should return 200 and the number of published CVs', async () => {
          const newUser1 = await userFactory.create({
            role: UserRoles.CANDIDATE,
          });
          await cvFactory.create({
            status: CVStatuses.PUBLISHED.value,
            UserId: newUser1.id,
          });

          const newUser2 = await userFactory.create({
            role: UserRoles.CANDIDATE,
          });
          await cvFactory.create({
            status: CVStatuses.PUBLISHED.value,
            UserId: newUser2.id,
          });

          const newUser3 = await userFactory.create({
            role: UserRoles.CANDIDATE,
          });
          await cvFactory.create({
            status: CVStatuses.PUBLISHED.value,
            UserId: newUser3.id,
          });

          const response: APIResponse<CVsController['countTotalPublishedCVs']> =
            await request(app.getHttpServer()).get(`${route}/published`);
          expect(response.status).toBe(200);
          expect(response.body.nbPublishedCVs).toBe(3);
        });
      });
    });
    describe('R - Read if CV has been updated', () => {
      describe('/checkUpdate - Check if CV has been updated by coach or admin', () => {
        let loggedInAdmin: LoggedUser;
        let loggedInCandidate: LoggedUser;
        let loggedInCoach: LoggedUser;

        beforeEach(async () => {
          loggedInAdmin = await usersHelper.createLoggedInUser({
            role: UserRoles.ADMIN,
          });
          loggedInCoach = await usersHelper.createLoggedInUser({
            role: UserRoles.COACH,
          });
          loggedInCandidate = await usersHelper.createLoggedInUser({
            role: UserRoles.CANDIDATE,
          });
          ({ loggedInCoach, loggedInCandidate: loggedInCandidate } =
            await userCandidatsHelper.associateCoachAndCandidate(
              loggedInCoach,
              loggedInCandidate,
              true
            ));
        });

        it('Should return 403 if admin checks if CV has been updated', async () => {
          const response: APIResponse<CVsController['checkCVHasBeenModified']> =
            await request(app.getHttpServer())
              .get(`${route}/checkUpdate`)
              .set('authorization', `Token ${loggedInAdmin.token}`);
          expect(response.status).toBe(403);
        });
        it('Should return 200 and cvHasBeenModified, if coach checks if CV has been updated and candidate is the last one to have modified it', async () => {
          await cvFactory.create({
            UserId: loggedInCandidate.user.id,
            lastModifiedBy: loggedInCandidate.user.id,
          });
          const response: APIResponse<CVsController['checkCVHasBeenModified']> =
            await request(app.getHttpServer())
              .get(`${route}/checkUpdate`)
              .set('authorization', `Token ${loggedInCoach.token}`);
          expect(response.status).toBe(200);
          expect(response.body.cvHasBeenModified).toBe(true);
        });
        it('Should return 200 and cvHasBeenModified be false, if coach checks if CV has been updated CV and coach is the last one to have modified it', async () => {
          await cvFactory.create({
            UserId: loggedInCandidate.user.id,
            lastModifiedBy: loggedInCoach.user.id,
          });
          const response: APIResponse<CVsController['checkCVHasBeenModified']> =
            await request(app.getHttpServer())
              .get(`${route}/checkUpdate`)
              .set('authorization', `Token ${loggedInCoach.token}`);
          expect(response.status).toBe(200);
          expect(response.body.cvHasBeenModified).toBe(false);
        });
        it('Should return 200 and cvHasBeenModified, if candidate checks if CV has been updated and coach is the last one to have modified it', async () => {
          await cvFactory.create({
            UserId: loggedInCandidate.user.id,
            lastModifiedBy: loggedInCoach.user.id,
          });
          const response: APIResponse<CVsController['checkCVHasBeenModified']> =
            await request(app.getHttpServer())
              .get(`${route}/checkUpdate`)
              .set('authorization', `Token ${loggedInCandidate.token}`);
          expect(response.status).toBe(200);
          expect(response.body.cvHasBeenModified).toBe(true);
        });
        it('Should return 200 and cvHasBeenModified be false, if candidat checks if CV has been updated CV and candidat is the last one to have modified it', async () => {
          await cvFactory.create({
            UserId: loggedInCandidate.user.id,
            lastModifiedBy: loggedInCandidate.user.id,
          });
          const response: APIResponse<CVsController['checkCVHasBeenModified']> =
            await request(app.getHttpServer())
              .get(`${route}/checkUpdate`)
              .set('authorization', `Token ${loggedInCandidate.token}`);
          expect(response.status).toBe(200);
          expect(response.body.cvHasBeenModified).toBe(false);
        });
      });
    });
    describe('U - Update lastModifiedBy of CV', () => {
      describe('/read/:candidateId - Resets the lastModifiedBy value', () => {
        let loggedInAdmin: LoggedUser;
        let loggedInCandidate: LoggedUser;
        let loggedInCoach: LoggedUser;

        beforeEach(async () => {
          loggedInAdmin = await usersHelper.createLoggedInUser({
            role: UserRoles.ADMIN,
          });
          loggedInCoach = await usersHelper.createLoggedInUser({
            role: UserRoles.COACH,
          });
          loggedInCandidate = await usersHelper.createLoggedInUser({
            role: UserRoles.CANDIDATE,
          });
          ({ loggedInCoach, loggedInCandidate: loggedInCandidate } =
            await userCandidatsHelper.associateCoachAndCandidate(
              loggedInCoach,
              loggedInCandidate,
              true
            ));
        });

        it("Should return 403 if admin resets CV's last modified by value", async () => {
          const response: APIResponse<CVsController['setCVHasBeenRead']> =
            await request(app.getHttpServer())
              .put(`${route}/read/${loggedInCandidate.user.id}`)
              .set('authorization', `Token ${loggedInAdmin.token}`);
          expect(response.status).toBe(403);
        });
        it('Should return 404 if coach sets that he has read the last updates but candidate has no CV', async () => {
          const response: APIResponse<CVsController['setCVHasBeenRead']> =
            await request(app.getHttpServer())
              .put(`${route}/read/${loggedInCandidate.user.id}`)
              .set('authorization', `Token ${loggedInCoach.token}`);
          expect(response.status).toBe(404);
        });
        it('Should return 404 if candidat sets that he has read the last updates but candidate has no CV', async () => {
          const response: APIResponse<CVsController['setCVHasBeenRead']> =
            await request(app.getHttpServer())
              .put(`${route}/read/${loggedInCandidate.user.id}`)
              .set('authorization', `Token ${loggedInCandidate.token}`);
          expect(response.status).toBe(404);
        });
        it('Should return 403 if coach sets that he has read the last updates made by another candidate', async () => {
          const candidat = await userFactory.create({
            role: UserRoles.CANDIDATE,
          });
          await cvFactory.create({
            UserId: candidat.id,
          });
          const response: APIResponse<CVsController['setCVHasBeenRead']> =
            await request(app.getHttpServer())
              .put(`${route}/read/${candidat.id}`)
              .set('authorization', `Token ${loggedInCoach.token}`);
          expect(response.status).toBe(403);
        });
        it('Should return 403 if candidat sets that he has read the last updates made by another candidate', async () => {
          const candidat = await userFactory.create({
            role: UserRoles.CANDIDATE,
          });
          await cvFactory.create({
            UserId: candidat.id,
          });
          const response: APIResponse<CVsController['setCVHasBeenRead']> =
            await request(app.getHttpServer())
              .put(`${route}/read/${candidat.id}`)
              .set('authorization', `Token ${loggedInCandidate.token}`);
          expect(response.status).toBe(403);
        });
        it('Should return 200, if coach sets that he has read the last updates made by candidate', async () => {
          await cvFactory.create({
            UserId: loggedInCandidate.user.id,
            lastModifiedBy: loggedInCandidate.user.id,
          });
          const response: APIResponse<CVsController['setCVHasBeenRead']> =
            await request(app.getHttpServer())
              .put(`${route}/read/${loggedInCandidate.user.id}`)
              .set('authorization', `Token ${loggedInCoach.token}`);
          expect(response.status).toBe(200);
          const cv = await cvsHelper.findCVByCandidateId(
            loggedInCandidate.user.id
          );
          expect(cv.lastModifiedBy).toBeFalsy();
        });
        it('Should return 200, if candidat sets that he has read the last updates made by coach', async () => {
          await cvFactory.create({
            UserId: loggedInCandidate.user.id,
            lastModifiedBy: loggedInCoach.user.id,
          });
          const response: APIResponse<CVsController['setCVHasBeenRead']> =
            await request(app.getHttpServer())
              .put(`${route}/read/${loggedInCandidate.user.id}`)
              .set('authorization', `Token ${loggedInCandidate.token}`);
          expect(response.status).toBe(200);
          const cv = await cvsHelper.findCVByCandidateId(
            loggedInCandidate.user.id
          );
          expect(cv.lastModifiedBy).toBeFalsy();
        });
      });
    });
    describe('U - Update share count', () => {
      describe('/count - Increments the share count for specific user', () => {
        let candidat: User;
        beforeEach(async () => {
          candidat = await userFactory.create({
            role: UserRoles.CANDIDATE,
          });
          await cvFactory.create({
            UserId: candidat.id,
            status: CVStatuses.PUBLISHED.value,
          });
        });

        it('Should return 200 and increment total shares', async () => {
          const oldTotalSharesCount = await sharesHelper.countTotalShares();
          const oldCandidateSharesCount =
            await sharesHelper.countTotalSharesByCandidateId(candidat.id);

          const response: APIResponse<SharesController['updateShareCount']> =
            await request(app.getHttpServer()).post(`${route}/count`).send({
              candidateId: candidat.id,
              type: 'other',
            });
          expect(response.status).toBe(201);

          const newTotalSharesCount = await sharesHelper.countTotalShares();
          const newCandidateSharesCount =
            await sharesHelper.countTotalSharesByCandidateId(candidat.id);

          expect(newTotalSharesCount).toBe(oldTotalSharesCount + 1);
          expect(newCandidateSharesCount).toBe(oldCandidateSharesCount + 1);
        });
        it('Should return 404 if wrong candidate id', async () => {
          const response: APIResponse<SharesController['updateShareCount']> =
            await request(app.getHttpServer()).post(`${route}/count`).send({
              candidateId: uuid(),
              type: 'other',
            });
          expect(response.status).toBe(404);
        });
        it('Should return 404 if coach id', async () => {
          const coach = await userFactory.create({
            role: UserRoles.COACH,
          });
          const response: APIResponse<SharesController['updateShareCount']> =
            await request(app.getHttpServer()).post(`${route}/count`).send({
              candidateId: coach.id,
              type: 'other',
            });
          expect(response.status).toBe(404);
        });
      });
    });
  });
});
