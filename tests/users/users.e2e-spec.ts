import { getQueueToken } from '@nestjs/bull';
import { CACHE_MANAGER, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { v4 as uuid } from 'uuid';
import { CacheMocks, QueueMocks, S3Mocks } from '../mocks.types';
import { LoggedUser } from 'src/auth/auth.types';
import { Ambition } from 'src/common/ambitions/models';
import { BusinessLine } from 'src/common/businessLines/models';
import { Experience } from 'src/common/experiences/models';
import { Review } from 'src/common/reviews/models';
import { Skill } from 'src/common/skills/models';
import { S3Service } from 'src/external-services/aws/s3.service';
import { Queues } from 'src/queues/queues.types';
import { UsersCreationController } from 'src/users-creation/users-creation.controller';
import { UsersDeletionController } from 'src/users-deletion/users-deletion.controller';
import { User } from 'src/users/models';
import { UsersController } from 'src/users/users.controller';
import { UserRoles, CVStatuses } from 'src/users/users.types';
import { AdminZones, APIResponse } from 'src/utils/types';
import { AmbitionsHelper } from 'tests/common/ambitions/ambitions.helper';
import { BusinessLinesHelper } from 'tests/common/businessLines/businessLines.helper';
import { ContractsHelper } from 'tests/common/contracts/contracts.helper';
import { ExperiencesSkillsHelper } from 'tests/common/experiences/experiences-skills.helper';
import { ExperiencesHelper } from 'tests/common/experiences/experiences.helper';
import { LanguagesHelper } from 'tests/common/languages/languages.helper';
import { LocationsHelper } from 'tests/common/locations/locations.helper';
import { PassionsHelper } from 'tests/common/passions/passions.helper';
import { ReviewsHelper } from 'tests/common/reviews/reviews.helper';
import { SkillsHelper } from 'tests/common/skills/skills.helper';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { CVAmbitionsHelper } from 'tests/cvs/cv-ambitions.helper';
import { CVBusinessLinesHelper } from 'tests/cvs/cv-businessLines.helper';
import { CVContractsHelper } from 'tests/cvs/cv-contracts.helper';
import { CVLanguagesHelper } from 'tests/cvs/cv-languages.helper';
import { CVLocationsHelper } from 'tests/cvs/cv-locations.helper';
import { CVPassionsHelper } from 'tests/cvs/cv-passions.helper';
import { CVSearchesHelper } from 'tests/cvs/cv-searches.helper';
import { CVSkillsHelper } from 'tests/cvs/cv-skills.helper';
import { CVFactory } from 'tests/cvs/cv.factory';
import { CVsHelper } from 'tests/cvs/cvs.helper';
import { DatabaseHelper } from 'tests/database.helper';
import { UserCandidatsHelper } from './user-candidats.helper';
import { UserFactory } from './user.factory';
import { UsersHelper } from './users.helper';

describe('Users', () => {
  let app: INestApplication;

  let databaseHelper: DatabaseHelper;
  let userFactory: UserFactory;
  let usersHelper: UsersHelper;
  let userCandidatsHelper: UserCandidatsHelper;
  let cvsHelper: CVsHelper;
  let cvFactory: CVFactory;
  let cvBusinessLinesHelper: CVBusinessLinesHelper;
  let cvLocationsHelper: CVLocationsHelper;
  let cvPassionsHelper: CVPassionsHelper;
  let cvAmbitionsHelper: CVAmbitionsHelper;
  let cvContractsHelper: CVContractsHelper;
  let cvLanguagesHelper: CVLanguagesHelper;
  let cvSkillsHelper: CVSkillsHelper;
  let cvSearchesHelper: CVSearchesHelper;
  let experiencesHelper: ExperiencesHelper;
  let businessLinesHelper: BusinessLinesHelper;
  let locationsHelper: LocationsHelper;
  let passionsHelper: PassionsHelper;
  let ambitionsHelper: AmbitionsHelper;
  let contractsHelper: ContractsHelper;
  let languagesHelper: LanguagesHelper;
  let skillsHelper: SkillsHelper;
  let experiencesSkillsHelper: ExperiencesSkillsHelper;
  let reviewsHelper: ReviewsHelper;

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

    databaseHelper = moduleFixture.get<DatabaseHelper>(DatabaseHelper);
    usersHelper = moduleFixture.get<UsersHelper>(UsersHelper);
    userCandidatsHelper =
      moduleFixture.get<UserCandidatsHelper>(UserCandidatsHelper);
    userFactory = moduleFixture.get<UserFactory>(UserFactory);
    cvsHelper = moduleFixture.get<CVsHelper>(CVsHelper);
    cvFactory = moduleFixture.get<CVFactory>(CVFactory);
    cvBusinessLinesHelper = moduleFixture.get<CVBusinessLinesHelper>(
      CVBusinessLinesHelper
    );
    cvLocationsHelper = moduleFixture.get<CVLocationsHelper>(CVLocationsHelper);
    cvPassionsHelper = moduleFixture.get<CVPassionsHelper>(CVPassionsHelper);
    cvAmbitionsHelper = moduleFixture.get<CVAmbitionsHelper>(CVAmbitionsHelper);
    cvContractsHelper = moduleFixture.get<CVContractsHelper>(CVContractsHelper);
    cvLanguagesHelper = moduleFixture.get<CVLanguagesHelper>(CVLanguagesHelper);
    cvSkillsHelper = moduleFixture.get<CVSkillsHelper>(CVSkillsHelper);
    experiencesHelper = moduleFixture.get<ExperiencesHelper>(ExperiencesHelper);
    cvSearchesHelper = moduleFixture.get<CVSearchesHelper>(CVSearchesHelper);
    businessLinesHelper =
      moduleFixture.get<BusinessLinesHelper>(BusinessLinesHelper);
    locationsHelper = moduleFixture.get<LocationsHelper>(LocationsHelper);
    passionsHelper = moduleFixture.get<PassionsHelper>(PassionsHelper);
    ambitionsHelper = moduleFixture.get<AmbitionsHelper>(AmbitionsHelper);
    contractsHelper = moduleFixture.get<ContractsHelper>(ContractsHelper);
    languagesHelper = moduleFixture.get<LanguagesHelper>(LanguagesHelper);
    skillsHelper = moduleFixture.get<SkillsHelper>(SkillsHelper);
    experiencesSkillsHelper = moduleFixture.get<ExperiencesSkillsHelper>(
      ExperiencesSkillsHelper
    );
    reviewsHelper = moduleFixture.get<ReviewsHelper>(ReviewsHelper);
  });

  afterAll(async () => {
    await databaseHelper.resetTestDB();
    await app.close();
  });

  beforeEach(async () => {
    await databaseHelper.resetTestDB();
  });

  describe('CRUD User', () => {
    describe('C - Create 1 User', () => {
      describe('/ - Create user', () => {
        let loggedInAdmin: LoggedUser;
        let loggedInCandidate: LoggedUser;

        beforeEach(async () => {
          loggedInAdmin = await usersHelper.createLoggedInUser({
            role: UserRoles.ADMIN,
          });
          loggedInCandidate = await usersHelper.createLoggedInUser({
            role: UserRoles.CANDIDAT,
          });
        });

        it('Should return 200 and a created user', async () => {
          const candidat = await userFactory.create(
            { role: UserRoles.CANDIDAT },
            {},
            false
          );
          const response: APIResponse<UsersCreationController['createUser']> =
            await request(app.getHttpServer())
              .post(`${route}`)
              .set('authorization', `Token ${loggedInAdmin.token}`)
              .send(candidat);
          expect(response.status).toBe(201);
        });
        it('Should return 401 when user data has invalid phone', async () => {
          const candidat = await userFactory.create({}, {}, false);
          const wrongData = {
            ...candidat,
            phone: '1234',
          };
          const response: APIResponse<UsersCreationController['createUser']> =
            await request(app.getHttpServer())
              .post(`${route}`)
              .set('authorization', `Token ${loggedInAdmin.token}`)
              .send(wrongData);
          expect(response.status).toBe(400);
        });
        it('Should return 401 when the user is not logged in.', async () => {
          const candidat = await userFactory.create(
            {
              role: UserRoles.CANDIDAT,
            },
            {},
            false
          );
          const response: APIResponse<UsersCreationController['createUser']> =
            await request(app.getHttpServer()).post(`${route}`).send(candidat);
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
          const response: APIResponse<UsersCreationController['createUser']> =
            await request(app.getHttpServer())
              .post(`${route}`)
              .set('authorization', `Token ${loggedInCandidate.token}`)
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
          const response: APIResponse<UsersCreationController['createUser']> =
            await request(app.getHttpServer())
              .post(`${route}`)
              .set('authorization', `Token ${loggedInAdmin.token}`)
              .send(candidat);
          expect(response.status).toBe(409);
        });
      });
    });
    describe('R - Read 1 User', () => {
      describe('/:id - Get a user by id or email', () => {
        let loggedInAdmin: LoggedUser;
        let loggedInCandidate: LoggedUser;
        let loggedInCoach: LoggedUser;

        beforeEach(async () => {
          loggedInAdmin = await usersHelper.createLoggedInUser({
            role: UserRoles.ADMIN,
          });
          loggedInCandidate = await usersHelper.createLoggedInUser({
            role: UserRoles.CANDIDAT,
          });
          loggedInCoach = await usersHelper.createLoggedInUser({
            role: UserRoles.COACH,
          });
        });
        it('Should return 401 when the user is not logged in.', async () => {
          const candidat = await userFactory.create(
            {
              role: UserRoles.CANDIDAT,
            },
            {},
            true
          );
          const response: APIResponse<UsersController['findUser']> =
            await request(app.getHttpServer()).get(
              `${route}/${candidat.email}`
            );
          expect(response.status).toBe(401);
        });
        it('Should return 200 when logged in candidat get himself', async () => {
          const response: APIResponse<UsersController['findUser']> =
            await request(app.getHttpServer())
              .get(`${route}/${loggedInCandidate.user.email}`)
              .set('authorization', `Token ${loggedInCandidate.token}`);
          expect(response.status).toBe(200);
          expect(response.body.email).toEqual(loggedInCandidate.user.email);
        });
        it('Should return 200 when logged in coach get himself', async () => {
          const response: APIResponse<UsersController['findUser']> =
            await request(app.getHttpServer())
              .get(`${route}/${loggedInCoach.user.email}`)
              .set('authorization', `Token ${loggedInCoach.token}`);
          expect(response.status).toBe(200);
          expect(response.body.email).toEqual(loggedInCoach.user.email);
        });
        it('Should return 403 when logged in coach get a candidat', async () => {
          const response: APIResponse<UsersController['findUser']> =
            await request(app.getHttpServer())
              .get(`${route}/${loggedInCandidate.user.email}`)
              .set('authorization', `Token ${loggedInCoach.token}`);
          expect(response.status).toBe(403);
        });
        it('Should return 200 and get a user by email when logged in as admin', async () => {
          const response: APIResponse<UsersController['findUser']> =
            await request(app.getHttpServer())
              .get(`${route}/${loggedInCandidate.user.email}`)
              .set('authorization', `Token ${loggedInAdmin.token}`);
          expect(response.status).toBe(200);
          const receivedUser = response.body;
          expect(receivedUser.email).toEqual(loggedInCandidate.user.email);
        });
        it('Should return 200 and get a user by id when logged in as admin', async () => {
          const response: APIResponse<UsersController['findUser']> =
            await request(app.getHttpServer())
              .get(`${route}/${loggedInCandidate.user.id}`)
              .set('authorization', `Token ${loggedInAdmin.token}`);
          expect(response.status).toBe(200);
          expect(response.body.id).toEqual(loggedInCandidate.user.id);
        });
        it('Should return 404 if user not found', async () => {
          const response: APIResponse<UsersController['findUser']> =
            await request(app.getHttpServer())
              .get(`${route}/${uuid()}`)
              .set('authorization', `Token ${loggedInAdmin.token}`);
          expect(response.status).toBe(404);
        });
      });
      describe('/candidat?coachId=&candidatId= - Get user associated to a candidate or coach', () => {
        let loggedInAdmin: LoggedUser;
        let loggedInCandidate: LoggedUser;
        let loggedInCoach: LoggedUser;

        beforeEach(async () => {
          loggedInAdmin = await usersHelper.createLoggedInUser({
            role: UserRoles.ADMIN,
          });
          loggedInCandidate = await usersHelper.createLoggedInUser({
            role: UserRoles.CANDIDAT,
          });
          loggedInCoach = await usersHelper.createLoggedInUser({
            role: UserRoles.COACH,
          });
        });
        it('Should return 401 if user is not a logged in user', async () => {
          const candidat = await userFactory.create(
            {
              role: UserRoles.CANDIDAT,
            },
            {},
            true
          );
          const response: APIResponse<UsersController['findRelatedUser']> =
            await request(app.getHttpServer()).get(`${route}/candidat`).send({
              candidatId: candidat.id,
            });
          expect(response.status).toBe(401);
        });
        it('Should return 404 if coach searching for himself and is not associated to candidat', async () => {
          const response: APIResponse<UsersController['findRelatedUser']> =
            await request(app.getHttpServer())
              .get(`${route}/candidat`)
              .set('authorization', `Token ${loggedInCoach.token}`)
              .query({
                coachId: loggedInCoach.user.id,
              });

          expect(response.status).toBe(404);
        });
        it('Should return 200 if candidat searching for himself and is not associated to coach', async () => {
          const response: APIResponse<UsersController['findRelatedUser']> =
            await request(app.getHttpServer())
              .get(`${route}/candidat`)
              .set('authorization', `Token ${loggedInCandidate.token}`)
              .query({
                candidatId: loggedInCandidate.user.id,
              });

          expect(response.status).toBe(200);
          expect(response.body.coach).toBeFalsy();
          expect(response.body.candidat).toBeTruthy();
          expect(response.body.candidat.id).toBe(loggedInCandidate.user.id);
        });
        it('Should return 200 and related coach if candidat searching for himself and is associated to coach', async () => {
          ({ loggedInCoach, loggedInCandidate } =
            await userCandidatsHelper.associateCoachAndCandidate(
              loggedInCoach,
              loggedInCandidate,
              true
            ));
          const response: APIResponse<UsersController['findRelatedUser']> =
            await request(app.getHttpServer())
              .get(`${route}/candidat`)
              .set('authorization', `Token ${loggedInCandidate.token}`)
              .query({
                candidatId: loggedInCandidate.user.id,
              });

          expect(response.status).toBe(200);
          expect(response.body.coach).toBeTruthy();
          expect(response.body.candidat).toBeTruthy();
          expect(response.body.coach.id).toBe(loggedInCoach.user.id);
          expect(response.body.candidat.id).toBe(loggedInCandidate.user.id);
        });
        it('Should return 200 and related candidat if coach searching for himself and is associated to candidat', async () => {
          ({ loggedInCoach, loggedInCandidate } =
            await userCandidatsHelper.associateCoachAndCandidate(
              loggedInCoach,
              loggedInCandidate,
              true
            ));
          const response: APIResponse<UsersController['findRelatedUser']> =
            await request(app.getHttpServer())
              .get(`${route}/candidat`)
              .set('authorization', `Token ${loggedInCoach.token}`)
              .query({
                coachId: loggedInCoach.user.id,
              });

          expect(response.status).toBe(200);
          expect(response.body.coach).toBeTruthy();
          expect(response.body.candidat).toBeTruthy();
          expect(response.body.coach.id).toBe(loggedInCoach.user.id);
          expect(response.body.candidat.id).toBe(loggedInCandidate.user.id);
        });
        it('Should return 403 if a not admin user search for others than himself.', async () => {
          const otherCoach = await userFactory.create(
            {
              role: UserRoles.COACH,
            },
            {},
            true
          );
          const response: APIResponse<UsersController['findRelatedUser']> =
            await request(app.getHttpServer())
              .get(`${route}/candidat`)
              .set('authorization', `Token ${loggedInCoach.token}`)
              .query({
                coachId: otherCoach.id,
              });

          expect(response.status).toBe(403);
        });
        it('Should return 200 and related candidate, admin searching for coach', async () => {
          ({ loggedInCoach, loggedInCandidate } =
            await userCandidatsHelper.associateCoachAndCandidate(
              loggedInCoach,
              loggedInCandidate,
              true
            ));
          const response: APIResponse<UsersController['findRelatedUser']> =
            await request(app.getHttpServer())
              .get(`${route}/candidat`)
              .set('authorization', `Token ${loggedInAdmin.token}`)
              .query({
                coachId: loggedInCoach.user.id,
              });
          expect(response.status).toBe(200);
          expect(response.body.coach).toBeTruthy();
          expect(response.body.candidat).toBeTruthy();
          expect(response.body.coach.id).toBe(loggedInCoach.user.id);
          expect(response.body.candidat.id).toBe(loggedInCandidate.user.id);
        });
        it('Should return 200 and related coach, admin searching for candidate', async () => {
          ({ loggedInCoach, loggedInCandidate } =
            await userCandidatsHelper.associateCoachAndCandidate(
              loggedInCoach,
              loggedInCandidate,
              true
            ));
          const response: APIResponse<UsersController['findRelatedUser']> =
            await request(app.getHttpServer())
              .get(`${route}/candidat`)
              .set('authorization', `Token ${loggedInAdmin.token}`)
              .query({
                candidatId: loggedInCandidate.user.id,
              });
          expect(response.status).toBe(200);
          expect(response.body.coach).toBeTruthy();
          expect(response.body.candidat).toBeTruthy();
          expect(response.body.coach.id).toBe(loggedInCoach.user.id);
          expect(response.body.candidat.id).toBe(loggedInCandidate.user.id);
        });
      });
    });
    describe('R - Read many Users', () => {
      describe('/search?query=&role= - Search a user where query string in email, first name or last name', () => {
        let loggedInAdmin: LoggedUser;
        let loggedInCandidate: LoggedUser;
        let loggedInCoach: LoggedUser;

        beforeEach(async () => {
          loggedInAdmin = await usersHelper.createLoggedInUser({
            role: UserRoles.ADMIN,
          });
          loggedInCandidate = await usersHelper.createLoggedInUser({
            role: UserRoles.CANDIDAT,
          });
          loggedInCoach = await usersHelper.createLoggedInUser({
            role: UserRoles.COACH,
          });
        });
        it('Should return 200 and part of candidates if user is logged in as admin', async () => {
          const privateCandidateInfo = [
            {
              id: loggedInCandidate.user.id,
              firstName: loggedInCandidate.user.firstName,
              lastName: loggedInCandidate.user.lastName,
              role: loggedInCandidate.user.role,
              adminRole: loggedInCandidate.user.adminRole,
              address: loggedInCandidate.user.address,
              email: loggedInCandidate.user.email,
              gender: loggedInCandidate.user.gender,
              lastConnection:
                loggedInCandidate.user.lastConnection?.toISOString(),
              phone: loggedInCandidate.user.phone,
              zone: loggedInCandidate.user.zone,
            },
          ];

          const response: APIResponse<UsersController['findUsers']> =
            await request(app.getHttpServer())
              .get(
                `${route}/search?query=${loggedInCandidate.user.firstName}&role=${UserRoles.CANDIDAT}`
              )
              .set('authorization', `Token ${loggedInAdmin.token}`);

          expect(response.status).toBe(200);
          expect(response.body).toStrictEqual(privateCandidateInfo);
        });
        it('Should return 403 if user is not logged in as candidate', async () => {
          const response: APIResponse<UsersController['findUsers']> =
            await request(app.getHttpServer())
              .get(`${route}/search?query=e&role=${UserRoles.CANDIDAT}`)
              .set('authorization', `Token ${loggedInCandidate.token}`);
          expect(response.status).toBe(403);
        });
        it('Should return 403 if user is not logged in as candidate', async () => {
          const response: APIResponse<UsersController['findUsers']> =
            await request(app.getHttpServer())
              .get(`${route}/search?query=e&role=${UserRoles.CANDIDAT}`)
              .set('authorization', `Token ${loggedInCoach.token}`);
          expect(response.status).toBe(403);
        });
      });
      describe('/search/candidates?query= - Search a public candidate where query string in email, first name or last name', () => {
        let candidat: User;

        beforeEach(async () => {
          candidat = await userFactory.create({
            role: UserRoles.CANDIDAT,
          });
        });
        it('Should return 200 and part of candidates if candidates have a published CV', async () => {
          await cvFactory.create({
            UserId: candidat.id,
            status: CVStatuses.PUBLISHED.value,
          });

          const publicCandidateInfo = [
            {
              id: candidat.id,
              firstName: candidat.firstName,
              lastName: candidat.lastName,
              role: candidat.role,
            },
          ];

          const response: APIResponse<UsersController['findCandidates']> =
            await request(app.getHttpServer()).get(
              `${route}/search/candidates?query=${candidat.firstName}`
            );

          expect(response.status).toBe(200);
          expect(response.body).toStrictEqual(publicCandidateInfo);
        });
        it('Should return 200 and no candidates if candidates have not a published CV', async () => {
          await cvFactory.create({
            UserId: candidat.id,
            status: CVStatuses.PROGRESS.value,
          });

          const response: APIResponse<UsersController['findCandidates']> =
            await request(app.getHttpServer()).get(
              `${route}/search/candidates?query=${candidat.firstName}`
            );

          expect(response.status).toBe(200);
          expect(response.body.length).toBe(0);
        });
      });
      describe('/members - Read all members', () => {
        it('Should return 401 if user is not logged in', async () => {
          const response: APIResponse<UsersController['findMembers']> =
            await request(app.getHttpServer()).get(`${route}/members`);
          expect(response.status).toBe(401);
        });
        it('Should return 403 if user is not a logged in admin', async () => {
          const loggedInCandidate = await usersHelper.createLoggedInUser({
            role: UserRoles.CANDIDAT,
          });

          const response: APIResponse<UsersController['findMembers']> =
            await request(app.getHttpServer())
              .get(`${route}/members`)
              .set('authorization', `Token ${loggedInCandidate.token}`);
          expect(response.status).toBe(403);
        });
        describe('/members?limit=&offset= - Get paginated and alphabetically sorted users', () => {
          let loggedInAdmin: LoggedUser;

          beforeEach(async () => {
            loggedInAdmin = await usersHelper.createLoggedInUser({
              role: UserRoles.ADMIN,
            });
            await userFactory.create({
              role: UserRoles.CANDIDAT,
              firstName: 'A',
            });
            await userFactory.create({
              role: UserRoles.CANDIDAT,
              firstName: 'B',
            });
            await userFactory.create({
              role: UserRoles.CANDIDAT,
              firstName: 'C',
            });
            await userFactory.create({
              role: UserRoles.CANDIDAT,
              firstName: 'D',
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
          });
          it('Should return 200 and 2 first candidates', async () => {
            const response: APIResponse<UsersController['findMembers']> =
              await request(app.getHttpServer())
                .get(`${route}/members?limit=2&role=${UserRoles.CANDIDAT}`)
                .set('authorization', `Token ${loggedInAdmin.token}`);
            expect(response.status).toBe(200);
            expect(response.body.length).toBe(2);
            expect(response.body.map(({ role }) => role)).toStrictEqual([
              UserRoles.CANDIDAT,
              UserRoles.CANDIDAT,
            ]);
            expect(response.body[0].firstName).toMatch('A');
            expect(response.body[1].firstName).toMatch('B');
          });
          it('Should return 200 and 3 first coaches', async () => {
            const response: APIResponse<UsersController['findMembers']> =
              await request(app.getHttpServer())
                .get(`${route}/members?limit=3&role=${UserRoles.COACH}`)
                .set('authorization', `Token ${loggedInAdmin.token}`);
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
              await request(app.getHttpServer())
                .get(
                  `${route}/members?limit=2&offset=2&role=${UserRoles.CANDIDAT}`
                )
                .set('authorization', `Token ${loggedInAdmin.token}`);
            expect(response.status).toBe(200);
            expect(response.body.length).toBe(2);
            expect(response.body.map(({ role }) => role)).toStrictEqual([
              UserRoles.CANDIDAT,
              UserRoles.CANDIDAT,
            ]);
            expect(response.body[0].firstName).toMatch('C');
            expect(response.body[1].firstName).toMatch('D');
          });
          it('Should return 200 and the 3rd and 4th coach', async () => {
            const response: APIResponse<UsersController['findMembers']> =
              await request(app.getHttpServer())
                .get(
                  `${route}/members?limit=2&offset=2&role=${UserRoles.COACH}`
                )
                .set('authorization', `Token ${loggedInAdmin.token}`);
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
        describe('/members?zone[]=&employed[]=&hidden[]=&businessLines[]=&associatedUser[]=&cvStatus[]= - Read all members as admin with filters', () => {
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
                role: UserRoles.CANDIDAT,
                zone: AdminZones.LYON,
              }
            );
            const parisCandidates = await databaseHelper.createEntities(
              userFactory,
              2,
              {
                role: UserRoles.CANDIDAT,
                zone: AdminZones.PARIS,
              }
            );
            await databaseHelper.createEntities(userFactory, 2, {
              role: UserRoles.CANDIDAT,
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
              await request(app.getHttpServer())
                .get(
                  `${route}/members?role=${UserRoles.CANDIDAT}&zone[]=${AdminZones.LYON}&zone[]=${AdminZones.PARIS}`
                )
                .set('authorization', `Token ${loggedInAdmin.token}`);
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
              role: UserRoles.CANDIDAT,
              zone: AdminZones.LYON,
            });

            const expectedCoachesIds = [
              ...lyonCoaches.map(({ id }) => id),
              ...parisCoaches.map(({ id }) => id),
            ];

            const response: APIResponse<UsersController['findMembers']> =
              await request(app.getHttpServer())
                .get(
                  `${route}/members?role=${UserRoles.COACH}&zone[]=${AdminZones.LYON}&zone[]=${AdminZones.PARIS}`
                )
                .set('authorization', `Token ${loggedInAdmin.token}`);
            expect(response.status).toBe(200);
            expect(response.body.length).toBe(4);
            expect(expectedCoachesIds).toEqual(
              expect.arrayContaining(response.body.map(({ id }) => id))
            );
          });
          it('Should return 200, and all the candidates that matches the hidden filter', async () => {
            const hiddenCandidates = await databaseHelper.createEntities(
              userFactory,
              2,
              {
                role: UserRoles.CANDIDAT,
              },
              { hidden: true }
            );
            await databaseHelper.createEntities(
              userFactory,
              2,
              {
                role: UserRoles.CANDIDAT,
              },
              { hidden: false }
            );

            const response: APIResponse<UsersController['findMembers']> =
              await request(app.getHttpServer())
                .get(
                  `${route}/members?role=${UserRoles.CANDIDAT}&hidden[]=true`
                )
                .set('authorization', `Token ${loggedInAdmin.token}`);
            expect(response.status).toBe(200);
            expect(response.body.length).toBe(2);
            expect(hiddenCandidates.map(({ id }) => id)).toEqual(
              expect.arrayContaining(response.body.map(({ id }) => id))
            );
          });
          it('Should return 200, and all the candidates that matches the employed filter', async () => {
            const employedCandidates = await databaseHelper.createEntities(
              userFactory,
              2,
              {
                role: UserRoles.CANDIDAT,
              },
              { employed: true }
            );
            await databaseHelper.createEntities(
              userFactory,
              2,
              {
                role: UserRoles.CANDIDAT,
              },
              { employed: false }
            );
            const response: APIResponse<UsersController['findMembers']> =
              await request(app.getHttpServer())
                .get(
                  `${route}/members?role=${UserRoles.CANDIDAT}&employed[]=true`
                )
                .set('authorization', `Token ${loggedInAdmin.token}`);
            expect(response.status).toBe(200);
            expect(response.body.length).toBe(2);
            expect(employedCandidates.map(({ id }) => id)).toEqual(
              expect.arrayContaining(response.body.map(({ id }) => id))
            );
          });
          it('Should return 200, and all the candidates that matches the cvStatus filters', async () => {
            const publishedCandidates = await databaseHelper.createEntities(
              userFactory,
              2,
              {
                role: UserRoles.CANDIDAT,
              }
            );

            const pendingCandidates = await databaseHelper.createEntities(
              userFactory,
              2,
              {
                role: UserRoles.CANDIDAT,
              }
            );

            const progressCandidates = await databaseHelper.createEntities(
              userFactory,
              2,
              {
                role: UserRoles.CANDIDAT,
              }
            );

            await Promise.all(
              publishedCandidates.map(async ({ id }) => {
                return cvFactory.create({
                  UserId: id,
                  status: CVStatuses.PUBLISHED.value,
                });
              })
            );
            await Promise.all(
              pendingCandidates.map(async ({ id }) => {
                return cvFactory.create({
                  UserId: id,
                  status: CVStatuses.PENDING.value,
                });
              })
            );
            await Promise.all(
              progressCandidates.map(async ({ id }) => {
                return cvFactory.create({
                  UserId: id,
                  status: CVStatuses.PROGRESS.value,
                });
              })
            );

            const expectedCandidatesIds = [
              ...publishedCandidates.map(({ id }) => id),
              ...pendingCandidates.map(({ id }) => id),
            ];

            const response: APIResponse<UsersController['findMembers']> =
              await request(app.getHttpServer())
                .get(
                  `${route}/members?role=${UserRoles.CANDIDAT}&cvStatus[]=${CVStatuses.PUBLISHED.value}&cvStatus[]=${CVStatuses.PENDING.value}`
                )
                .set('authorization', `Token ${loggedInAdmin.token}`);
            expect(response.status).toBe(200);
            expect(response.body.length).toBe(4);
            expect(expectedCandidatesIds).toEqual(
              expect.arrayContaining(response.body.map(({ id }) => id))
            );
          });
          it('Should return 200, and all the candidates that matches the businessLines filters', async () => {
            const batCandidates = await databaseHelper.createEntities(
              userFactory,
              2,
              {
                role: UserRoles.CANDIDAT,
              }
            );

            const rhCandidates = await databaseHelper.createEntities(
              userFactory,
              2,
              {
                role: UserRoles.CANDIDAT,
              }
            );

            const aaCandidates = await databaseHelper.createEntities(
              userFactory,
              2,
              {
                role: UserRoles.CANDIDAT,
              }
            );

            await Promise.all(
              rhCandidates.map(async ({ id }) => {
                return cvFactory.create(
                  {
                    UserId: id,
                  },
                  { businessLines: ['rh', 'aa'] }
                );
              })
            );

            await Promise.all(
              batCandidates.map(async ({ id }) => {
                return cvFactory.create(
                  {
                    UserId: id,
                  },
                  { businessLines: ['bat', 'asp'] }
                );
              })
            );
            await Promise.all(
              aaCandidates.map(async ({ id }) => {
                return cvFactory.create(
                  {
                    UserId: id,
                  },
                  { businessLines: ['aa', 'pr'] }
                );
              })
            );

            const expectedCandidatesIds = [
              ...batCandidates.map(({ id }) => id),
              ...rhCandidates.map(({ id }) => id),
            ];

            const response: APIResponse<UsersController['findMembers']> =
              await request(app.getHttpServer())
                .get(
                  `${route}/members?role=${UserRoles.CANDIDAT}&businessLines[]=bat&businessLines[]=rh`
                )
                .set('authorization', `Token ${loggedInAdmin.token}`);
            expect(response.status).toBe(200);
            expect(response.body.length).toBe(4);
            expect(expectedCandidatesIds).toEqual(
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
                role: UserRoles.CANDIDAT,
              });

            const notAssociatedUserCandidates =
              await databaseHelper.createEntities(userFactory, 2, {
                role: UserRoles.CANDIDAT,
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
              await request(app.getHttpServer())
                .get(
                  `${route}/members?role=${UserRoles.CANDIDAT}&associatedUser[]=false`
                )
                .set('authorization', `Token ${loggedInAdmin.token}`);
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
                role: UserRoles.CANDIDAT,
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
              await request(app.getHttpServer())
                .get(
                  `${route}/members?role=${UserRoles.COACH}&associatedUser[]=false`
                )
                .set('authorization', `Token ${loggedInAdmin.token}`);
            expect(response.status).toBe(200);
            expect(response.body.length).toBe(2);
            expect(notAssociatedUserCoaches.map(({ id }) => id)).toEqual(
              expect.arrayContaining(response.body.map(({ id }) => id))
            );
          });
        });
      });

      describe('/members/count - Count all pending members', () => {
        it('Should return 403 if user is not a logged in admin', async () => {
          const loggedInCandidate = await usersHelper.createLoggedInUser({
            role: UserRoles.CANDIDAT,
          });
          const response: APIResponse<
            UsersController['countSubmittedCVMembers']
          > = await request(app.getHttpServer())
            .get(`${route}/members/count`)
            .set('authorization', `Token ${loggedInCandidate.token}`);
          expect(response.status).toBe(403);
        });
        it('Should return 200 and count of members with pending CVs', async () => {
          const loggedInAdmin = await usersHelper.createLoggedInUser({
            role: UserRoles.ADMIN,
          });

          const pendingCandidates = await databaseHelper.createEntities(
            userFactory,
            2,
            {
              role: UserRoles.CANDIDAT,
            }
          );

          const progressCandidates = await databaseHelper.createEntities(
            userFactory,
            2,
            {
              role: UserRoles.CANDIDAT,
            }
          );

          await Promise.all(
            pendingCandidates.map(async ({ id }) => {
              return cvFactory.create({
                UserId: id,
                status: CVStatuses.PENDING.value,
              });
            })
          );
          await Promise.all(
            progressCandidates.map(async ({ id }) => {
              return cvFactory.create({
                UserId: id,
                status: CVStatuses.PROGRESS.value,
              });
            })
          );

          const response: APIResponse<
            UsersController['countSubmittedCVMembers']
          > = await request(app.getHttpServer())
            .get(`${route}/members/count`)
            .set('authorization', `Token ${loggedInAdmin.token}`);
          expect(response.status).toBe(200);
          expect(response.body.pendingCVs).toBe(2);
        });
      });
    });
    describe('U - Update 1 User', () => {
      describe('/:id - Update user', () => {
        let loggedInAdmin: LoggedUser;
        let loggedInCandidate: LoggedUser;
        let loggedInCoach: LoggedUser;

        beforeEach(async () => {
          loggedInAdmin = await usersHelper.createLoggedInUser({
            role: UserRoles.ADMIN,
          });
          loggedInCandidate = await usersHelper.createLoggedInUser({
            role: UserRoles.CANDIDAT,
          });
          loggedInCoach = await usersHelper.createLoggedInUser({
            role: UserRoles.COACH,
          });
        });
        it('Should return 401 if user is not logged in', async () => {
          const updates = await userFactory.create({}, {}, false);
          const response: APIResponse<UsersController['updateUser']> =
            await request(app.getHttpServer())
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
            await request(app.getHttpServer())
              .put(`${route}/${loggedInCandidate.user.id}`)
              .set('authorization', `Token ${loggedInCoach.token}`)
              .send({
                phone: updates.phone,
                firstName: updates.firstName,
              });
          expect(response.status).toBe(403);
        });
        it('Should return 200 and updated user when a candidate update himself', async () => {
          const updates = await userFactory.create({}, {}, false);
          const response: APIResponse<UsersController['updateUser']> =
            await request(app.getHttpServer())
              .put(`${route}/${loggedInCandidate.user.id}`)
              .set('authorization', `Token ${loggedInCandidate.token}`)
              .send({
                phone: updates.phone,
                address: updates.address,
                email: updates.email,
              });
          expect(response.status).toBe(200);
          expect(response.body.phone).toEqual(updates.phone);
          expect(response.body.address).toEqual(updates.address);
        });
        it('Should return 400 when a candidate update himself with invalid phone', async () => {
          const response: APIResponse<UsersController['updateUser']> =
            await request(app.getHttpServer())
              .put(`${route}/${loggedInCandidate.user.id}`)
              .set('authorization', `Token ${loggedInCandidate.token}`)
              .send({
                phone: '1234',
              });
          expect(response.status).toBe(400);
        });
        it('Should return 200 and updated user when coach update himself', async () => {
          const updates = await userFactory.create({}, {}, false);
          const response: APIResponse<UsersController['updateUser']> =
            await request(app.getHttpServer())
              .put(`${route}/${loggedInCoach.user.id}`)
              .set('authorization', `Token ${loggedInCoach.token}`)
              .send({
                phone: updates.phone,
                address: updates.address,
                email: updates.email,
              });
          expect(response.status).toBe(200);
          expect(response.body.phone).toEqual(updates.phone);
        });
        it('Should return 400 when coach update himself with invalid phone', async () => {
          const response: APIResponse<UsersController['updateUser']> =
            await request(app.getHttpServer())
              .put(`${route}/${loggedInCoach.user.id}`)
              .set('authorization', `Token ${loggedInCoach.token}`)
              .send({
                phone: '1234',
              });
          expect(response.status).toBe(400);
        });
        it('Should return 400 when candidat other than phone, address, email', async () => {
          const updates = await userFactory.create({}, {}, false);
          const response: APIResponse<UsersController['updateUser']> =
            await request(app.getHttpServer())
              .put(`${route}/${loggedInCandidate.user.id}`)
              .set('authorization', `Token ${loggedInCandidate.token}`)
              .send({
                firstName: updates.firstName,
              });
          expect(response.status).toBe(400);
        });
        it('Should return 400 when coach updates other than phone, address, email', async () => {
          const updates = await userFactory.create({}, {}, false);
          const response: APIResponse<UsersController['updateUser']> =
            await request(app.getHttpServer())
              .put(`${route}/${loggedInCoach.user.id}`)
              .set('authorization', `Token ${loggedInCoach.token}`)
              .send({
                lastName: updates.lastName,
              });
          expect(response.status).toBe(400);
        });
        it('Should return 200 and updated user when an admin update a user', async () => {
          const updates = await userFactory.create({}, {}, false);
          const response: APIResponse<UsersController['updateUser']> =
            await request(app.getHttpServer())
              .put(`${route}/${loggedInCandidate.user.id}`)
              .set('authorization', `Token ${loggedInAdmin.token}`)
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
            await request(app.getHttpServer())
              .put(`${route}/${loggedInCandidate.user.id}`)
              .set('authorization', `Token ${loggedInAdmin.token}`)
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
            await request(app.getHttpServer())
              .put(`${route}/${loggedInCandidate.user.id}`)
              .set('authorization', `Token ${loggedInAdmin.token}`)
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
      describe('/change-pwd - Update password', () => {
        let loggedInCandidate: LoggedUser;
        const password = 'Candidat123!';

        beforeEach(async () => {
          loggedInCandidate = await usersHelper.createLoggedInUser({
            role: UserRoles.CANDIDAT,
            password,
          });
        });
        it('Should return 401 if not connected', async () => {
          const response: APIResponse<UsersController['updatePassword']> =
            await request(app.getHttpServer()).put(`${route}/change-pwd`).send({
              oldPassword: password,
              newPassword: 'Candidat123?',
            });
          expect(response.status).toBe(401);
        });
        it('Should return 401 if old password is invalid', async () => {
          const response: APIResponse<UsersController['updatePassword']> =
            await request(app.getHttpServer())
              .put(`${route}/change-pwd`)
              .set('authorization', `Token ${loggedInCandidate.token}`)
              .send({
                oldPassword: 'falsePassword123!',
                newPassword: 'Candidat123?',
              });
          expect(response.status).toBe(401);
        });
        it("Should return 400 if new password doesn't contain uppercase and lowercase letters, numbers & special characters password", async () => {
          const response: APIResponse<UsersController['updatePassword']> =
            await request(app.getHttpServer())
              .put(`${route}/change-pwd`)
              .set('authorization', `Token ${loggedInCandidate.token}`)
              .send({
                oldPassword: password,
                newPassword: 'candidat123?',
              });
          expect(response.status).toBe(400);
        });
        it('Should return 200 and updated user', async () => {
          const response: APIResponse<UsersController['updatePassword']> =
            await request(app.getHttpServer())
              .put(`${route}/change-pwd`)
              .set('authorization', `Token ${loggedInCandidate.token}`)
              .send({
                email: loggedInCandidate.user.email,
                oldPassword: password,
                newPassword: 'Candidat123?',
              });
          expect(response.status).toBe(200);
        });
      });
      describe('/candidat/:candidateId - Update userCandidat', () => {
        let loggedInAdmin: LoggedUser;
        let loggedInCandidate: LoggedUser;
        let loggedInCoach: LoggedUser;

        beforeEach(async () => {
          loggedInAdmin = await usersHelper.createLoggedInUser({
            role: UserRoles.ADMIN,
          });
          loggedInCandidate = await usersHelper.createLoggedInUser({
            role: UserRoles.CANDIDAT,
          });
          loggedInCoach = await usersHelper.createLoggedInUser({
            role: UserRoles.COACH,
          });
        });
        it('Should return 401, if user not logged in', async () => {
          const response: APIResponse<UsersController['updateUserCandidat']> =
            await request(app.getHttpServer())
              .put(`${route}/candidat/${loggedInCandidate.user.id}`)
              .send({
                hidden: false,
                note: 'updated note',
              });
          expect(response.status).toBe(401);
        });
        it("Should return 403, if candidat doesn't update himself", async () => {
          const otherCandidat = await userFactory.create({
            role: UserRoles.CANDIDAT,
          });
          const response: APIResponse<UsersController['updateUserCandidat']> =
            await request(app.getHttpServer())
              .put(`${route}/candidat/${otherCandidat.id}`)
              .set('authorization', `Token ${loggedInCandidate.token}`)
              .send({
                employed: false,
                note: 'updated note by other',
              });
          expect(response.status).toBe(403);
        });
        it('Should return 403, if coach updates candidate not associated to him', async () => {
          const response: APIResponse<UsersController['updateUserCandidat']> =
            await request(app.getHttpServer())
              .put(`${route}/candidat/${loggedInCandidate.user.id}`)
              .set('authorization', `Token ${loggedInCoach.token}`)
              .send({
                employed: false,
                note: 'updated note by not associated coach',
              });
          expect(response.status).toBe(403);
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
            await request(app.getHttpServer())
              .put(`${route}/candidat/${loggedInCandidate.user.id}`)
              .set('authorization', `Token ${loggedInAdmin.token}`)
              .send({
                employed: false,
                note: updatedNote,
              });
          expect(response.status).toBe(200);
          expect(response.body.note).toMatch(updatedNote);
          expect(response.body.lastModifiedBy).toBe(loggedInAdmin.user.id);
        });
        it('Should return 200 and updated userCandidat, if candidat updates himself', async () => {
          ({ loggedInCoach, loggedInCandidate } =
            await userCandidatsHelper.associateCoachAndCandidate(
              loggedInCoach,
              loggedInCandidate,
              true
            ));
          const updatedNote = 'updated note by candidat';
          const response: APIResponse<UsersController['updateUserCandidat']> =
            await request(app.getHttpServer())
              .put(`${route}/candidat/${loggedInCandidate.user.id}`)
              .set('authorization', `Token ${loggedInCandidate.token}`)
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
            await request(app.getHttpServer())
              .put(`${route}/candidat/${loggedInCandidate.user.id}`)
              .set('authorization', `Token ${loggedInCoach.token}`)
              .send({
                employed: false,
                note: updatedNote,
              });
          expect(response.status).toBe(200);
          expect(response.body.note).toMatch(updatedNote);
          expect(response.body.lastModifiedBy).toBe(loggedInCoach.user.id);
        });
      });
      describe('/candidat/checkUpdate - Check if update has been made on userCandidat note', () => {
        let loggedInAdmin: LoggedUser;
        let loggedInCandidate: LoggedUser;
        let loggedInCoach: LoggedUser;

        beforeEach(async () => {
          loggedInAdmin = await usersHelper.createLoggedInUser({
            role: UserRoles.ADMIN,
          });
          const candidat = await userFactory.create({
            role: UserRoles.CANDIDAT,
          });
          const coach = await userFactory.create({
            role: UserRoles.COACH,
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
        });
        it('Should return 401, if user not logged in', async () => {
          const response: APIResponse<
            UsersController['checkNoteHasBeenModified']
          > = await request(app.getHttpServer()).get(
            `${route}/candidat/checkUpdate`
          );

          expect(response.status).toBe(401);
        });
        it('Should return 403, if admin checks if note has been updated', async () => {
          const response: APIResponse<
            UsersController['checkNoteHasBeenModified']
          > = await request(app.getHttpServer())
            .get(`${route}/candidat/checkUpdate`)
            .set('authorization', `Token ${loggedInAdmin.token}`);
          expect(response.status).toBe(403);
        });
        it('Should return 200 and noteHasBeenModified, if coach checks if note has been updated', async () => {
          await userCandidatsHelper.setLastModifiedBy(
            loggedInCandidate.user.id,
            loggedInCandidate.user.id
          );
          const response: APIResponse<
            UsersController['checkNoteHasBeenModified']
          > = await request(app.getHttpServer())
            .get(`${route}/candidat/checkUpdate`)
            .set('authorization', `Token ${loggedInCoach.token}`);
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
          > = await request(app.getHttpServer())
            .get(`${route}/candidat/checkUpdate`)
            .set('authorization', `Token ${loggedInCoach.token}`);
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
          > = await request(app.getHttpServer())
            .get(`${route}/candidat/checkUpdate`)
            .set('authorization', `Token ${loggedInCoach.token}`);
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
          > = await request(app.getHttpServer())
            .get(`${route}/candidat/checkUpdate`)
            .set('authorization', `Token ${loggedInCandidate.token}`);
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
          > = await request(app.getHttpServer())
            .get(`${route}/candidat/checkUpdate`)
            .set('authorization', `Token ${loggedInCandidate.token}`);
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
          > = await request(app.getHttpServer())
            .get(`${route}/candidat/checkUpdate`)
            .set('authorization', `Token ${loggedInCandidate.token}`);
          expect(response.status).toBe(200);
          expect(response.body.noteHasBeenModified).toBe(false);
        });
      });
      describe('/candidat/read/:candidateId - Set note to has been read', () => {
        let loggedInAdmin: LoggedUser;
        let loggedInCandidate: LoggedUser;
        let loggedInCoach: LoggedUser;

        beforeEach(async () => {
          loggedInAdmin = await usersHelper.createLoggedInUser({
            role: UserRoles.ADMIN,
          });
          loggedInCandidate = await usersHelper.createLoggedInUser({
            role: UserRoles.CANDIDAT,
          });
          loggedInCoach = await usersHelper.createLoggedInUser({
            role: UserRoles.COACH,
          });
        });
        it('Should return 401, if user not logged in', async () => {
          const response: APIResponse<UsersController['setNoteHasBeenRead']> =
            await request(app.getHttpServer()).put(
              `${route}/candidat/read/${loggedInCandidate.user.id}`
            );

          expect(response.status).toBe(401);
        });
        it('Should return 403, if admin sets the note has been read', async () => {
          const response: APIResponse<UsersController['setNoteHasBeenRead']> =
            await request(app.getHttpServer())
              .put(`${route}/candidat/read/${loggedInCandidate.user.id}`)
              .set('authorization', `Token ${loggedInAdmin.token}`);
          expect(response.status).toBe(403);
        });
        it('Should return 403, if coach sets the note has been read on candidate not related', async () => {
          const response: APIResponse<UsersController['setNoteHasBeenRead']> =
            await request(app.getHttpServer())
              .put(`${route}/candidat/read/${loggedInCandidate.user.id}`)
              .set('authorization', `Token ${loggedInCoach.token}`);
          expect(response.status).toBe(403);
        });
        it('Should return 200, if candidat sets the note and is not related to a coach', async () => {
          const response: APIResponse<UsersController['setNoteHasBeenRead']> =
            await request(app.getHttpServer())
              .put(`${route}/candidat/read/${loggedInCandidate.user.id}`)
              .set('authorization', `Token ${loggedInCandidate.token}`);
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
            await request(app.getHttpServer())
              .put(`${route}/candidat/read/${loggedInCandidate.user.id}`)
              .set('authorization', `Token ${loggedInCoach.token}`);
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
            await request(app.getHttpServer())
              .put(`${route}/candidat/read/${loggedInCandidate.user.id}`)
              .set('authorization', `Token ${loggedInCandidate.token}`);
          expect(response.status).toBe(200);
          expect(response.body.lastModifiedBy).toBe(null);
        });
      });
    });
    // TODO put in unit tests
    describe('D - Delete 1 User', () => {
      describe('/:id - Delete user and all associated models', () => {
        let loggedInAdmin: LoggedUser;
        let loggedInCoach: LoggedUser;
        let candidate: User;
        let coach: User;
        const uniqIdToFind = uuid();
        const uniqId2ToFind = uuid();
        let cvId: string;
        let experienceId: string;

        beforeEach(async () => {
          loggedInAdmin = await usersHelper.createLoggedInUser({
            role: UserRoles.ADMIN,
          });

          candidate = await userFactory.create({
            role: UserRoles.CANDIDAT,
          });

          coach = await userFactory.create({
            role: UserRoles.COACH,
          });

          ({ candidate, coach } =
            await userCandidatsHelper.associateCoachAndCandidate(
              coach,
              candidate,
              false
            ));

          loggedInCoach = await usersHelper.createLoggedInUser({
            role: UserRoles.COACH,
          });

          ({
            id: cvId,
            experiences: [{ id: experienceId }],
          } = await cvFactory.create(
            {
              UserId: candidate.id,
              urlImg: `images/${candidate.id}.Published.jpg`,
              intro: null,
              story: 'test',
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
                { prefix: 'dans', name: uniqIdToFind, order: 0 } as Ambition,
                { prefix: 'dans', name: uniqId2ToFind, order: 1 } as Ambition,
              ],
              businessLines: [
                { name: uniqIdToFind, order: 0 } as BusinessLine,
                { name: uniqId2ToFind, order: 1 } as BusinessLine,
              ],
              locations: [uniqIdToFind],
              experiences: [
                {
                  description: uniqIdToFind,
                  skills: [{ name: uniqId2ToFind } as Skill],
                  order: 0,
                } as Experience,
              ],
              reviews: [
                {
                  text: uniqIdToFind,
                  status: uniqIdToFind,
                  name: uniqIdToFind,
                } as Review,
              ],
            },
            true
          ));
        });
        it('Should return 403 if not logged in admin', async () => {
          const response: APIResponse<UsersDeletionController['removeUser']> =
            await request(app.getHttpServer())
              .delete(`${route}/${candidate.id}`)
              .set('authorization', `Token ${loggedInCoach.token}`);
          expect(response.status).toBe(403);
        });
        it('Should return 200 if logged in as admin and deletes candidate', async () => {
          const response: APIResponse<UsersDeletionController['removeUser']> =
            await request(app.getHttpServer())
              .delete(`${route}/${candidate.id}`)
              .set('authorization', `Token ${loggedInAdmin.token}`);

          expect(response.status).toBe(200);
          expect(response.body.usersDeleted).toBe(1);
          expect(response.body.cvsDeleted).toBe(1);

          const user = await usersHelper.findUser(candidate.id);
          expect(user).toBeFalsy();

          const userCandidatByCoachIdAndCandidateId =
            await userCandidatsHelper.findOneUserCandidat({
              candidateId: candidate.id,
              coachId: coach.id,
            });
          const userCandidatByCandidateId =
            await userCandidatsHelper.findOneUserCandidat({
              candidateId: candidate.id,
            });
          const userCandidatByCoachId =
            await userCandidatsHelper.findOneUserCandidat({
              coachId: coach.id,
            });
          expect(userCandidatByCoachIdAndCandidateId).toBeFalsy();
          expect(userCandidatByCandidateId).toBeTruthy();
          expect(userCandidatByCoachId).toBeFalsy();

          const cvs = await cvsHelper.findAllCVsByCandidateId(candidate.id);
          expect(cvs.length).toBeFalsy();

          const locationsCount = await locationsHelper.countLocationByName(
            uniqIdToFind
          );
          const cvLocationsCount =
            await cvLocationsHelper.countCVLocationsByCVId(cvId);
          expect(locationsCount).toBe(1);
          expect(cvLocationsCount).toBe(0);

          const businessLinesCount =
            await businessLinesHelper.countBusinessLinesByName([
              uniqIdToFind,
              uniqId2ToFind,
            ]);
          const cvBusinessLinesCount =
            await cvBusinessLinesHelper.countCVBusinessLinesByCVId(cvId);
          expect(businessLinesCount).toBe(2);
          expect(cvBusinessLinesCount).toBe(0);

          const ambitionsCount = await ambitionsHelper.countAmbitionsByName([
            uniqIdToFind,
            uniqId2ToFind,
          ]);
          const cvAmbitionsCount =
            await cvAmbitionsHelper.countCVAmbitionsByCVId(cvId);
          expect(ambitionsCount).toBe(2);
          expect(cvAmbitionsCount).toBe(0);

          const contractsCount = await contractsHelper.countContractsByName(
            uniqIdToFind
          );
          const cvContractsCount =
            await cvContractsHelper.countCVContractsByCVId(cvId);
          expect(contractsCount).toBe(1);
          expect(cvContractsCount).toBe(0);

          const languagesCount = await languagesHelper.countLanguagesByName(
            uniqIdToFind
          );
          const cvLanguagesCount =
            await cvLanguagesHelper.countCVLanguagesByCVId(cvId);
          expect(languagesCount).toBe(1);
          expect(cvLanguagesCount).toBe(0);

          const passionsCount = await passionsHelper.countPassionsByName(
            uniqIdToFind
          );
          const cvPassionsCount = await cvPassionsHelper.countCVPassionsByCVId(
            cvId
          );
          expect(passionsCount).toBe(1);
          expect(cvPassionsCount).toBe(0);

          const skillsCount = await skillsHelper.countSkillsByName(
            uniqIdToFind
          );
          const cvSkillsCount = await cvSkillsHelper.countCVSkillsByCVId(cvId);
          expect(skillsCount).toBe(1);
          expect(cvSkillsCount).toBe(0);

          const expSkillsCount = await skillsHelper.countSkillsByName(
            uniqId2ToFind
          );
          const cvExperiencesCount =
            await experiencesHelper.countExperiencesByCVId(cvId);
          const cvExpSkillsCount =
            await experiencesSkillsHelper.countExperienceSkillsByExperienceId(
              experienceId
            );

          expect(cvExperiencesCount).toBe(0);
          expect(cvExpSkillsCount).toBe(0);
          expect(expSkillsCount).toBe(1);

          const searchesCount = await cvSearchesHelper.countCVSearchesByCVId(
            cvId
          );
          expect(searchesCount).toBe(0);

          const reviewsCount = await reviewsHelper.countReviewsByCVId(cvId);
          expect(reviewsCount).toBe(0);
        });
        it('Should return 200 if logged in as admin and deletes coach', async () => {
          const response: APIResponse<UsersDeletionController['removeUser']> =
            await request(app.getHttpServer())
              .delete(`${route}/${coach.id}`)
              .set('authorization', `Token ${loggedInAdmin.token}`);

          expect(response.status).toBe(200);
          expect(response.body.usersDeleted).toBe(1);
          expect(response.body.cvsDeleted).toBe(0);

          const user = await usersHelper.findUser(coach.id);
          expect(user).toBeFalsy();

          const userCandidatByCoachIdAndCandidateId =
            await userCandidatsHelper.findOneUserCandidat({
              candidateId: candidate.id,
              coachId: coach.id,
            });
          const userCandidatByCandidateId =
            await userCandidatsHelper.findOneUserCandidat({
              candidateId: candidate.id,
            });
          const userCandidatByCoachId =
            await userCandidatsHelper.findOneUserCandidat({
              coachId: coach.id,
            });
          expect(userCandidatByCoachIdAndCandidateId).toBeFalsy();
          expect(userCandidatByCandidateId).toBeTruthy();
          expect(userCandidatByCoachId).toBeFalsy();
        });
      });
    });
  });
});
