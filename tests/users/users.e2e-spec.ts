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
import { Organization } from 'src/organizations/models';
import { Queues } from 'src/queues/queues.types';
import { UsersCreationController } from 'src/users-creation/users-creation.controller';
import { UsersDeletionController } from 'src/users-deletion/users-deletion.controller';
import { User, UserCandidat } from 'src/users/models';
import { UsersController } from 'src/users/users.controller';
import { CVStatuses, UserRoles } from 'src/users/users.types';
import { assertCondition } from 'src/utils/misc/asserts';
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
import { OrganizationFactory } from 'tests/organizations/organization.factory';
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
  let organizationFactory: OrganizationFactory;

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
    organizationFactory =
      moduleFixture.get<OrganizationFactory>(OrganizationFactory);
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
        let organization: Organization;

        beforeEach(async () => {
          loggedInAdmin = await usersHelper.createLoggedInUser({
            role: UserRoles.ADMIN,
          });
          loggedInCandidate = await usersHelper.createLoggedInUser({
            role: UserRoles.CANDIDATE,
          });

          organization = await organizationFactory.create({}, {}, true);
        });

        it('Should return 200 and a created user if valid data', async () => {
          const {
            password,
            hashReset,
            salt,
            saltReset,
            revision,
            updatedAt,
            createdAt,
            lastConnection,
            ...user
          } = await userFactory.create({}, {}, false);
          const response: APIResponse<UsersCreationController['createUser']> =
            await request(app.getHttpServer())
              .post(`${route}`)
              .set('authorization', `Token ${loggedInAdmin.token}`)
              .send(user);
          expect(response.status).toBe(201);
          expect(response.body).toEqual(
            expect.objectContaining({
              ...user,
            })
          );
        });
        it('Should return 200 and a created user if missing optional fields', async () => {
          const {
            password,
            hashReset,
            salt,
            saltReset,
            revision,
            updatedAt,
            createdAt,
            lastConnection,
            address,
            ...user
          } = await userFactory.create({}, {}, false);
          const response: APIResponse<UsersCreationController['createUser']> =
            await request(app.getHttpServer())
              .post(`${route}`)
              .set('authorization', `Token ${loggedInAdmin.token}`)
              .send(user);
          expect(response.status).toBe(201);
          expect(response.body).toEqual(
            expect.objectContaining({
              ...user,
            })
          );
        });
        it('Should return 400 when user data has missing mandatory fields', async () => {
          const user = await userFactory.create({}, {}, false);
          const wrongData = {
            lastName: user.lastName,
            email: user.email,
            zone: user.zone,
            role: user.role,
            gender: user.gender,
            phone: user.phone,
          };
          const response: APIResponse<UsersCreationController['createUser']> =
            await request(app.getHttpServer())
              .post(`${route}`)
              .set('authorization', `Token ${loggedInAdmin.token}`)
              .send(wrongData);
          expect(response.status).toBe(400);
        });
        it('Should return 400 when user data has invalid phone', async () => {
          const candidate = await userFactory.create({}, {}, false);
          const wrongData = {
            ...candidate,
            phone: '1234',
          };
          const response: APIResponse<UsersCreationController['createUser']> =
            await request(app.getHttpServer())
              .post(`${route}`)
              .set('authorization', `Token ${loggedInAdmin.token}`)
              .send(wrongData);
          expect(response.status).toBe(400);
        });
        it('Should return 401 when the user is not logged in', async () => {
          const candidate = await userFactory.create(
            {
              role: UserRoles.CANDIDATE,
            },
            {},
            false
          );
          const response: APIResponse<UsersCreationController['createUser']> =
            await request(app.getHttpServer()).post(`${route}`).send(candidate);
          expect(response.status).toBe(401);
        });
        it('Should return 403 when the user is not an administrator', async () => {
          const candidate = await userFactory.create(
            {
              role: UserRoles.CANDIDATE,
            },
            {},
            false
          );
          const response: APIResponse<UsersCreationController['createUser']> =
            await request(app.getHttpServer())
              .post(`${route}`)
              .set('authorization', `Token ${loggedInCandidate.token}`)
              .send(candidate);
          expect(response.status).toBe(403);
        });
        it('Should return 409 when the email already exist', async () => {
          const existingCandidate = await userFactory.create(
            {
              role: UserRoles.CANDIDATE,
            },
            {},
            true
          );

          const {
            password,
            hashReset,
            salt,
            saltReset,
            revision,
            updatedAt,
            createdAt,
            lastConnection,
            ...candidate
          } = await userFactory.create(
            {
              role: UserRoles.CANDIDATE,
              email: existingCandidate.email,
            },
            {},
            false
          );
          const response: APIResponse<UsersCreationController['createUser']> =
            await request(app.getHttpServer())
              .post(`${route}`)
              .set('authorization', `Token ${loggedInAdmin.token}`)
              .send(candidate);
          expect(response.status).toBe(409);
        });

        describe('/ - Create normal candidate or coach', () => {
          it('Should return 200 and a created candidate without coach', async () => {
            const {
              password,
              hashReset,
              salt,
              saltReset,
              revision,
              updatedAt,
              createdAt,
              lastConnection,
              ...candidate
            } = await userFactory.create(
              { role: UserRoles.CANDIDATE },
              {},
              false
            );
            const response: APIResponse<UsersCreationController['createUser']> =
              await request(app.getHttpServer())
                .post(`${route}`)
                .set('authorization', `Token ${loggedInAdmin.token}`)
                .send(candidate);
            expect(response.status).toBe(201);
            expect(response.body).toEqual(
              expect.objectContaining({
                ...candidate,
              })
            );
          });
          it('Should return 200 and a created candidate with coach', async () => {
            const {
              password,
              hashReset,
              salt,
              saltReset,
              revision,
              updatedAt,
              createdAt,
              lastConnection,
              ...candidate
            } = await userFactory.create(
              { role: UserRoles.CANDIDATE },
              {},
              false
            );

            const {
              password: coachPassword,
              hashReset: coachHashReset,
              salt: coachSalt,
              saltReset: coachSaltReset,
              revision: coachRevision,
              updatedAt: coachUpdatedAt,
              createdAt: coachCreatedAt,
              lastConnection: coachLastConnection,
              organization,
              candidat,
              coaches,
              ...coach
            } = await userFactory.create({ role: UserRoles.COACH }, {}, true);

            const response: APIResponse<UsersCreationController['createUser']> =
              await request(app.getHttpServer())
                .post(`${route}`)
                .set('authorization', `Token ${loggedInAdmin.token}`)
                .send({ ...candidate, userToLinkId: coach.id });
            expect(response.status).toBe(201);
            expect(response.body).toEqual(
              expect.objectContaining({
                ...candidate,
                candidat: expect.objectContaining({
                  coach: expect.objectContaining({
                    ...coach,
                  }),
                }),
              })
            );
          });
          it('Should return 404 if create candidate with unexisting coach', async () => {
            const {
              password,
              hashReset,
              salt,
              saltReset,
              revision,
              updatedAt,
              createdAt,
              lastConnection,
              ...candidate
            } = await userFactory.create(
              { role: UserRoles.CANDIDATE },
              {},
              false
            );

            const response: APIResponse<UsersCreationController['createUser']> =
              await request(app.getHttpServer())
                .post(`${route}`)
                .set('authorization', `Token ${loggedInAdmin.token}`)
                .send({ ...candidate, userToLinkId: uuid() });
            expect(response.status).toBe(404);
          });

          it('Should return 200 and a created coach without candidate', async () => {
            const {
              password,
              hashReset,
              salt,
              saltReset,
              revision,
              updatedAt,
              createdAt,
              lastConnection,
              ...coach
            } = await userFactory.create({ role: UserRoles.COACH }, {}, false);

            const response: APIResponse<UsersCreationController['createUser']> =
              await request(app.getHttpServer())
                .post(`${route}`)
                .set('authorization', `Token ${loggedInAdmin.token}`)
                .send(coach);
            expect(response.status).toBe(201);
            expect(response.body).toEqual(
              expect.objectContaining({
                ...coach,
              })
            );
          });
          it('Should return 200 and a created coach with candidate', async () => {
            const {
              password,
              hashReset,
              salt,
              saltReset,
              revision,
              updatedAt,
              createdAt,
              lastConnection,
              ...coach
            } = await userFactory.create({ role: UserRoles.COACH }, {}, false);

            const {
              password: candidatePassword,
              hashReset: candidateHashReset,
              salt: candidateSalt,
              saltReset: candidateSaltReset,
              revision: candidateRevision,
              updatedAt: candidateUpdatedAt,
              createdAt: candidateCreatedAt,
              lastConnection: candidateLastConnection,
              organization,
              candidat,
              coaches,
              ...candidate
            } = await userFactory.create(
              { role: UserRoles.CANDIDATE },
              {},
              true
            );

            const response: APIResponse<UsersCreationController['createUser']> =
              await request(app.getHttpServer())
                .post(`${route}`)
                .set('authorization', `Token ${loggedInAdmin.token}`)
                .send({ ...coach, userToLinkId: candidate.id });
            expect(response.status).toBe(201);
            expect(response.body).toEqual(
              expect.objectContaining({
                ...coach,
                coaches: [
                  expect.objectContaining({
                    candidat: expect.objectContaining({
                      ...candidate,
                    }),
                  }),
                ],
              })
            );
          });
          it('Should return 404 if created coach with unexisting candidate', async () => {
            const {
              password,
              hashReset,
              salt,
              saltReset,
              revision,
              updatedAt,
              createdAt,
              lastConnection,
              ...coach
            } = await userFactory.create({ role: UserRoles.COACH }, {}, false);

            const response: APIResponse<UsersCreationController['createUser']> =
              await request(app.getHttpServer())
                .post(`${route}`)
                .set('authorization', `Token ${loggedInAdmin.token}`)
                .send({ ...coach, userToLinkId: uuid() });

            expect(response.status).toBe(404);
          });

          it('Should return 400 if candidate with another candidate as coach', async () => {
            const {
              password,
              hashReset,
              salt,
              saltReset,
              revision,
              updatedAt,
              createdAt,
              lastConnection,
              ...candidate
            } = await userFactory.create(
              { role: UserRoles.CANDIDATE },
              {},
              false
            );

            const { id } = await userFactory.create(
              { role: UserRoles.CANDIDATE },
              {},
              true
            );

            const response: APIResponse<UsersCreationController['createUser']> =
              await request(app.getHttpServer())
                .post(`${route}`)
                .set('authorization', `Token ${loggedInAdmin.token}`)
                .send({ ...candidate, userToLinkId: id });
            expect(response.status).toBe(400);
          });
          it('Should return 400 if coach with another coach as candidate', async () => {
            const {
              password,
              hashReset,
              salt,
              saltReset,
              revision,
              updatedAt,
              createdAt,
              lastConnection,
              ...coach
            } = await userFactory.create({ role: UserRoles.COACH }, {}, false);

            const { id } = await userFactory.create(
              { role: UserRoles.COACH },
              {},
              true
            );

            const response: APIResponse<UsersCreationController['createUser']> =
              await request(app.getHttpServer())
                .post(`${route}`)
                .set('authorization', `Token ${loggedInAdmin.token}`)
                .send({ ...coach, userToLinkId: id });
            expect(response.status).toBe(400);
          });

          it('Should return 400 if candidate with multiple coaches', async () => {
            const {
              password,
              hashReset,
              salt,
              saltReset,
              revision,
              updatedAt,
              createdAt,
              lastConnection,
              ...candidate
            } = await userFactory.create(
              { role: UserRoles.CANDIDATE },
              {},
              false
            );

            const { id: coach1Id } = await userFactory.create(
              { role: UserRoles.COACH },
              {},
              true
            );
            const { id: coach2Id } = await userFactory.create(
              { role: UserRoles.COACH },
              {},
              true
            );

            const response: APIResponse<UsersCreationController['createUser']> =
              await request(app.getHttpServer())
                .post(`${route}`)
                .set('authorization', `Token ${loggedInAdmin.token}`)
                .send({
                  ...candidate,
                  userToLinkId: [coach1Id, coach2Id],
                });
            expect(response.status).toBe(400);
          });
          it('Should return 400 if coach with multiple candidates', async () => {
            const {
              password,
              hashReset,
              salt,
              saltReset,
              revision,
              updatedAt,
              createdAt,
              lastConnection,
              ...coach
            } = await userFactory.create({ role: UserRoles.COACH }, {}, false);

            const { id: candidate1Id } = await userFactory.create(
              { role: UserRoles.CANDIDATE },
              {},
              true
            );
            const { id: candidate2Id } = await userFactory.create(
              { role: UserRoles.CANDIDATE },
              {},
              true
            );

            const response: APIResponse<UsersCreationController['createUser']> =
              await request(app.getHttpServer())
                .post(`${route}`)
                .set('authorization', `Token ${loggedInAdmin.token}`)
                .send({
                  ...coach,
                  userToLinkId: [candidate1Id, candidate2Id],
                });
            expect(response.status).toBe(400);
          });

          it('Should return 400 if candidate with organization', async () => {
            const {
              password,
              hashReset,
              salt,
              saltReset,
              revision,
              updatedAt,
              createdAt,
              lastConnection,
              ...candidate
            } = await userFactory.create(
              { role: UserRoles.CANDIDATE },
              {},
              false
            );

            const response: APIResponse<UsersCreationController['createUser']> =
              await request(app.getHttpServer())
                .post(`${route}`)
                .set('authorization', `Token ${loggedInAdmin.token}`)
                .send({
                  ...candidate,
                  OrganizationId: organization.id,
                });
            expect(response.status).toBe(400);
          });
          it('Should return 400 if coach with organization', async () => {
            const {
              password,
              hashReset,
              salt,
              saltReset,
              revision,
              updatedAt,
              createdAt,
              lastConnection,
              ...coach
            } = await userFactory.create({ role: UserRoles.COACH }, {}, false);

            const response: APIResponse<UsersCreationController['createUser']> =
              await request(app.getHttpServer())
                .post(`${route}`)
                .set('authorization', `Token ${loggedInAdmin.token}`)
                .send({
                  ...coach,
                  OrganizationId: organization.id,
                });

            expect(response.status).toBe(400);
          });

          it('Should return 400 if candidate with external coach', async () => {
            const {
              password,
              hashReset,
              salt,
              saltReset,
              revision,
              updatedAt,
              createdAt,
              lastConnection,
              ...candidate
            } = await userFactory.create(
              { role: UserRoles.CANDIDATE },
              {},
              false
            );

            const externalCoach = await userFactory.create(
              { role: UserRoles.COACH_EXTERNAL },
              {},
              true
            );

            const response: APIResponse<UsersCreationController['createUser']> =
              await request(app.getHttpServer())
                .post(`${route}`)
                .set('authorization', `Token ${loggedInAdmin.token}`)
                .send({
                  ...candidate,
                  userToLinkId: externalCoach.id,
                });
            expect(response.status).toBe(400);
          });
          it('Should return 400 if coach with external candidate', async () => {
            const {
              password,
              hashReset,
              salt,
              saltReset,
              revision,
              updatedAt,
              createdAt,
              lastConnection,
              ...coach
            } = await userFactory.create({ role: UserRoles.COACH }, {}, false);

            const externalCandidate = await userFactory.create(
              { role: UserRoles.CANDIDATE_EXTERNAL },
              {},
              true
            );

            const response: APIResponse<UsersCreationController['createUser']> =
              await request(app.getHttpServer())
                .post(`${route}`)
                .set('authorization', `Token ${loggedInAdmin.token}`)
                .send({
                  ...coach,
                  userToLinkId: externalCandidate.id,
                });
            expect(response.status).toBe(400);
          });
        });
        describe('/ - Create external candidate or coach', () => {
          it('Should return 200 and a created external candidate without external coach', async () => {
            const {
              password,
              hashReset,
              salt,
              saltReset,
              revision,
              updatedAt,
              createdAt,
              lastConnection,
              OrganizationId,
              ...candidate
            } = await userFactory.create(
              {
                role: UserRoles.CANDIDATE_EXTERNAL,
              },
              {},
              false
            );

            const {
              createdAt: organizationCreatedAt,
              updatedAt: organizationUpdatedAt,
              organizationReferent,
              ...restOrganization
            } = organization;

            const response: APIResponse<UsersCreationController['createUser']> =
              await request(app.getHttpServer())
                .post(`${route}`)
                .set('authorization', `Token ${loggedInAdmin.token}`)
                .send({ ...candidate, OrganizationId: organization.id });
            expect(response.status).toBe(201);
            expect(response.body).toEqual(
              expect.objectContaining({
                ...candidate,
                organization: expect.objectContaining({ ...restOrganization }),
              })
            );
          });
          it('Should return 200 and a created external candidate with external coach', async () => {
            const candidate = await userFactory.create(
              {
                role: UserRoles.CANDIDATE_EXTERNAL,
              },
              {},
              false
            );

            let coach = await userFactory.create(
              {
                role: UserRoles.COACH_EXTERNAL,
                OrganizationId: organization.id,
              },
              {},
              true
            );

            const {
              createdAt: organizationCreatedAt,
              updatedAt: organizationUpdatedAt,
              organizationReferent,
              ...restOrganization
            } = organization;

            let otherExternalCandidate = await userFactory.create(
              {
                role: UserRoles.CANDIDATE_EXTERNAL,
                OrganizationId: organization.id,
              },
              {},
              true
            );

            ({ coach: coach, candidate: otherExternalCandidate } =
              await userCandidatsHelper.associateCoachAndCandidate(
                coach,
                otherExternalCandidate,
                false
              ));

            const {
              password: coachPassword,
              hashReset: coachHashReset,
              salt: coachSalt,
              saltReset: coachSaltReset,
              revision: coachRevision,
              updatedAt: coachUpdatedAt,
              createdAt: coachCreatedAt,
              lastConnection: coachLastConnection,
              candidat,
              coaches,
              organization: coachOrganization,
              ...restCoach
            } = coach;

            const {
              password,
              hashReset,
              salt,
              saltReset,
              revision,
              updatedAt,
              createdAt,
              lastConnection,
              candidat: candidateCandidat,
              ...restCandidate
            } = candidate;

            const {
              candidat: {
                coach: otherExternalCandidateCoach,
                ...restOtherExternalCandidateCandidat
              },
              coaches: otherExternalCandidateCoaches,
              lastConnection: otherCandidateLastConnection,
              organization: otherCandidateOrganization,
              ...restOtherExternalCandidate
            } = otherExternalCandidate;

            const response: APIResponse<UsersCreationController['createUser']> =
              await request(app.getHttpServer())
                .post(`${route}`)
                .set('authorization', `Token ${loggedInAdmin.token}`)
                .send({
                  ...restCandidate,
                  OrganizationId: organization.id,
                  userToLinkId: coach.id,
                });

            const coachFromDB = await usersHelper.findUser(coach.id);

            expect(response.status).toBe(201);
            expect(response.body).toEqual(
              expect.objectContaining({
                ...restCandidate,
                candidat: expect.objectContaining({
                  coach: expect.objectContaining({
                    ...restCoach,
                  }),
                }),
                organization: expect.objectContaining({
                  ...restOrganization,
                }),
              })
            );

            const {
              candidat: { coach: candidateCoach, ...restCandidateCandidat },
            } = response.body;

            expect(coachFromDB).toEqual(
              expect.objectContaining({
                ...restCoach,
                coaches: expect.arrayContaining([
                  expect.objectContaining({
                    ...restCandidateCandidat,
                    candidat: expect.objectContaining({
                      ...restCandidate,
                    }),
                  }),
                  expect.objectContaining({
                    ...restOtherExternalCandidateCandidat,
                    candidat: expect.objectContaining({
                      ...restOtherExternalCandidate,
                    }),
                  }),
                ]),
              })
            );
          });
          it('Should return 404 if create external candidate with unexisting coach', async () => {
            const {
              password,
              hashReset,
              salt,
              saltReset,
              revision,
              updatedAt,
              createdAt,
              lastConnection,
              ...candidate
            } = await userFactory.create(
              {
                role: UserRoles.CANDIDATE_EXTERNAL,
              },
              {},
              false
            );

            const response: APIResponse<UsersCreationController['createUser']> =
              await request(app.getHttpServer())
                .post(`${route}`)
                .set('authorization', `Token ${loggedInAdmin.token}`)
                .send({
                  ...candidate,
                  OrganizationId: organization.id,
                  userToLinkId: uuid(),
                });
            expect(response.status).toBe(404);
          });

          it('Should return 200 and a created external coach without external candidate', async () => {
            const {
              password,
              hashReset,
              salt,
              saltReset,
              revision,
              updatedAt,
              createdAt,
              lastConnection,
              ...coach
            } = await userFactory.create(
              {
                role: UserRoles.COACH_EXTERNAL,
              },
              {},
              false
            );

            const {
              createdAt: organizationCreatedAt,
              updatedAt: organizationUpdatedAt,
              organizationReferent,
              ...restOrganization
            } = organization;

            const response: APIResponse<UsersCreationController['createUser']> =
              await request(app.getHttpServer())
                .post(`${route}`)
                .set('authorization', `Token ${loggedInAdmin.token}`)
                .send({ ...coach, OrganizationId: organization.id });
            expect(response.status).toBe(201);
            expect(response.body).toEqual(
              expect.objectContaining({
                ...coach,
                organization: expect.objectContaining({
                  ...restOrganization,
                }),
              })
            );
          });
          it('Should return 200 and a created external coach with external candidate', async () => {
            const {
              password,
              hashReset,
              salt,
              saltReset,
              revision,
              updatedAt,
              createdAt,
              lastConnection,
              ...coach
            } = await userFactory.create(
              {
                role: UserRoles.COACH_EXTERNAL,
              },
              {},
              false
            );

            const {
              password: candidatePassword,
              hashReset: candidateHashReset,
              salt: candidateSalt,
              saltReset: candidateSaltReset,
              revision: candidateRevision,
              updatedAt: candidateUpdatedAt,
              createdAt: candidateCreatedAt,
              lastConnection: candidateLastConnection,
              candidat,
              coaches,
              organization: candidateOrganization,
              ...candidate
            } = await userFactory.create(
              {
                role: UserRoles.CANDIDATE_EXTERNAL,
                OrganizationId: organization.id,
              },
              {},
              true
            );

            const {
              createdAt: organizationCreatedAt,
              updatedAt: organizationUpdatedAt,
              organizationReferent,
              ...restOrganization
            } = organization;

            const response: APIResponse<UsersCreationController['createUser']> =
              await request(app.getHttpServer())
                .post(`${route}`)
                .set('authorization', `Token ${loggedInAdmin.token}`)
                .send({
                  ...coach,
                  OrganizationId: organization.id,
                  userToLinkId: [candidate.id],
                });
            expect(response.status).toBe(201);
            expect(response.body).toEqual(
              expect.objectContaining({
                ...coach,
                coaches: [
                  expect.objectContaining({
                    candidat: expect.objectContaining({
                      ...candidate,
                    }),
                  }),
                ],
                organization: expect.objectContaining({
                  ...restOrganization,
                }),
              })
            );
          });
          it('Should return 404 if created external coach with unexisting candidate', async () => {
            const {
              password,
              hashReset,
              salt,
              saltReset,
              revision,
              updatedAt,
              createdAt,
              lastConnection,
              ...coach
            } = await userFactory.create(
              {
                role: UserRoles.COACH_EXTERNAL,
              },
              {},
              false
            );

            const response: APIResponse<UsersCreationController['createUser']> =
              await request(app.getHttpServer())
                .post(`${route}`)
                .set('authorization', `Token ${loggedInAdmin.token}`)
                .send({
                  ...coach,
                  OrganizationId: organization.id,
                  userToLinkId: [uuid()],
                });

            expect(response.status).toBe(404);
          });

          it('Should return 400 if external candidate with another external candidate as coach', async () => {
            const {
              password,
              hashReset,
              salt,
              saltReset,
              revision,
              updatedAt,
              createdAt,
              lastConnection,
              ...candidate
            } = await userFactory.create(
              {
                role: UserRoles.CANDIDATE_EXTERNAL,
              },
              {},
              false
            );

            const { id } = await userFactory.create(
              {
                role: UserRoles.CANDIDATE_EXTERNAL,
                OrganizationId: organization.id,
              },
              {},
              true
            );

            const response: APIResponse<UsersCreationController['createUser']> =
              await request(app.getHttpServer())
                .post(`${route}`)
                .set('authorization', `Token ${loggedInAdmin.token}`)
                .send({
                  ...candidate,
                  OrganizationId: organization.id,
                  userToLinkId: id,
                });
            expect(response.status).toBe(400);
          });
          it('Should return 400 if external coach with another external coach as candidate', async () => {
            const {
              password,
              hashReset,
              salt,
              saltReset,
              revision,
              updatedAt,
              createdAt,
              lastConnection,
              ...coach
            } = await userFactory.create(
              {
                role: UserRoles.COACH_EXTERNAL,
              },
              {},
              false
            );

            const { id } = await userFactory.create(
              {
                role: UserRoles.COACH_EXTERNAL,
                OrganizationId: organization.id,
              },
              {},
              true
            );

            const response: APIResponse<UsersCreationController['createUser']> =
              await request(app.getHttpServer())
                .post(`${route}`)
                .set('authorization', `Token ${loggedInAdmin.token}`)
                .send({
                  ...coach,
                  OrganizationId: organization.id,
                  userToLinkId: id,
                });
            expect(response.status).toBe(400);
          });

          it('Should return 400 if external candidate with multiple external coaches', async () => {
            const {
              password,
              hashReset,
              salt,
              saltReset,
              revision,
              updatedAt,
              createdAt,
              lastConnection,
              ...candidate
            } = await userFactory.create(
              {
                role: UserRoles.CANDIDATE_EXTERNAL,
              },
              {},
              false
            );

            const { id: coach1Id } = await userFactory.create(
              {
                role: UserRoles.COACH_EXTERNAL,
                OrganizationId: organization.id,
              },
              {},
              true
            );
            const { id: coach2Id } = await userFactory.create(
              {
                role: UserRoles.COACH_EXTERNAL,
                OrganizationId: organization.id,
              },
              {},
              true
            );

            const response: APIResponse<UsersCreationController['createUser']> =
              await request(app.getHttpServer())
                .post(`${route}`)
                .set('authorization', `Token ${loggedInAdmin.token}`)
                .send({
                  ...candidate,
                  OrganizationId: organization.id,
                  userToLinkId: [coach1Id, coach2Id],
                });
            expect(response.status).toBe(400);
          });

          it('Should return 400 if external candidate without organization', async () => {
            const {
              password,
              hashReset,
              salt,
              saltReset,
              revision,
              updatedAt,
              createdAt,
              lastConnection,
              ...coach
            } = await userFactory.create(
              { role: UserRoles.COACH_EXTERNAL },
              {},
              false
            );

            const response: APIResponse<UsersCreationController['createUser']> =
              await request(app.getHttpServer())
                .post(`${route}`)
                .set('authorization', `Token ${loggedInAdmin.token}`)
                .send({
                  ...coach,
                });
            expect(response.status).toBe(400);
          });
          it('Should return 400 if external coach without organization', async () => {
            const {
              password,
              hashReset,
              salt,
              saltReset,
              revision,
              updatedAt,
              createdAt,
              lastConnection,
              ...candidate
            } = await userFactory.create(
              { role: UserRoles.CANDIDATE_EXTERNAL },
              {},
              false
            );

            const response: APIResponse<UsersCreationController['createUser']> =
              await request(app.getHttpServer())
                .post(`${route}`)
                .set('authorization', `Token ${loggedInAdmin.token}`)
                .send({
                  ...candidate,
                });
            expect(response.status).toBe(400);
          });

          it('Should return 400 if external candidate with external coach from another organization', async () => {
            const otherOrganization = await organizationFactory.create(
              {},
              {},
              true
            );

            const {
              password,
              hashReset,
              salt,
              saltReset,
              revision,
              updatedAt,
              createdAt,
              lastConnection,
              ...candidate
            } = await userFactory.create(
              {
                role: UserRoles.CANDIDATE_EXTERNAL,
              },
              {},
              false
            );

            const {
              password: coachPassword,
              hashReset: coachHashReset,
              salt: coachSalt,
              saltReset: coachSaltReset,
              revision: coachRevision,
              updatedAt: coachUpdatedAt,
              createdAt: coachCreatedAt,
              lastConnection: coachLastConnection,
              candidat,
              coaches,
              ...coach
            } = await userFactory.create(
              {
                role: UserRoles.COACH_EXTERNAL,
                OrganizationId: otherOrganization.id,
              },
              {},
              true
            );

            const response: APIResponse<UsersCreationController['createUser']> =
              await request(app.getHttpServer())
                .post(`${route}`)
                .set('authorization', `Token ${loggedInAdmin.token}`)
                .send({
                  ...candidate,
                  OrganizationId: organization.id,
                  userToLinkId: coach.id,
                });
            expect(response.status).toBe(400);
          });
          it('Should return 400 if external coach with external candidate from another organization', async () => {
            const otherOrganization = await organizationFactory.create(
              {},
              {},
              true
            );

            const {
              password,
              hashReset,
              salt,
              saltReset,
              revision,
              updatedAt,
              createdAt,
              lastConnection,
              ...coach
            } = await userFactory.create(
              {
                role: UserRoles.COACH_EXTERNAL,
              },
              {},
              false
            );

            const {
              password: candidatePassword,
              hashReset: candidateHashReset,
              salt: candidateSalt,
              saltReset: candidateSaltReset,
              revision: candidateRevision,
              updatedAt: candidateUpdatedAt,
              createdAt: candidateCreatedAt,
              lastConnection: candidateLastConnection,
              candidat,
              coaches,
              ...candidate
            } = await userFactory.create(
              {
                role: UserRoles.CANDIDATE_EXTERNAL,
                OrganizationId: otherOrganization.id,
              },
              {},
              true
            );

            const response: APIResponse<UsersCreationController['createUser']> =
              await request(app.getHttpServer())
                .post(`${route}`)
                .set('authorization', `Token ${loggedInAdmin.token}`)
                .send({
                  ...coach,
                  OrganizationId: organization.id,
                  userToLinkId: candidate.id,
                });
            expect(response.status).toBe(400);
          });

          it('Should return 400 if external candidate with normal coach', async () => {
            const {
              password,
              hashReset,
              salt,
              saltReset,
              revision,
              updatedAt,
              createdAt,
              lastConnection,
              ...externalCandidate
            } = await userFactory.create(
              {
                role: UserRoles.CANDIDATE_EXTERNAL,
              },
              {},
              false
            );

            const normalCoach = await userFactory.create(
              { role: UserRoles.COACH },
              {},
              true
            );

            const response: APIResponse<UsersCreationController['createUser']> =
              await request(app.getHttpServer())
                .post(`${route}`)
                .set('authorization', `Token ${loggedInAdmin.token}`)
                .send({
                  ...externalCandidate,
                  OrganizationId: organization.id,
                  userToLinkId: normalCoach.id,
                });
            expect(response.status).toBe(400);
          });
          it('Should return 400 if external coach with normal candidate', async () => {
            const {
              password,
              hashReset,
              salt,
              saltReset,
              revision,
              updatedAt,
              createdAt,
              lastConnection,
              ...externalCoach
            } = await userFactory.create(
              {
                role: UserRoles.COACH_EXTERNAL,
              },
              {},
              false
            );

            const normalCandidate = await userFactory.create(
              { role: UserRoles.CANDIDATE },
              {},
              true
            );

            const response: APIResponse<UsersCreationController['createUser']> =
              await request(app.getHttpServer())
                .post(`${route}`)
                .set('authorization', `Token ${loggedInAdmin.token}`)
                .send({
                  ...externalCoach,
                  OrganizationId: organization.id,
                  userToLinkId: normalCandidate.id,
                });
            expect(response.status).toBe(400);
          });
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
            role: UserRoles.CANDIDATE,
          });
          loggedInCoach = await usersHelper.createLoggedInUser({
            role: UserRoles.COACH,
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
            await request(app.getHttpServer()).get(
              `${route}/${candidate.email}`
            );
          expect(response.status).toBe(401);
        });
        it('Should return 200 when logged in candidate gets himself', async () => {
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
        it('Should return 403 when logged in coach get a candidate', async () => {
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
            await request(app.getHttpServer()).get(`${route}/candidate`);
          expect(response.status).toBe(401);
        });
        it('Should return 404 if coach is not associated to candidate', async () => {
          const response: APIResponse<UsersController['findRelatedUser']> =
            await request(app.getHttpServer())
              .get(`${route}/candidate`)
              .set('authorization', `Token ${loggedInCoach.token}`)
              .query({
                coachId: loggedInCoach.user.id,
              });

          expect(response.status).toBe(404);
        });
        it('Should return 200 if candidate not associated to coach', async () => {
          const response: APIResponse<UsersController['findRelatedUser']> =
            await request(app.getHttpServer())
              .get(`${route}/candidate`)
              .set('authorization', `Token ${loggedInCandidate.token}`)
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
            await request(app.getHttpServer())
              .get(`${route}/candidate`)
              .set('authorization', `Token ${loggedInCandidate.token}`)
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
            await request(app.getHttpServer())
              .get(`${route}/candidate`)
              .set('authorization', `Token ${loggedInCoach.token}`)
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
        it('Should return 200 and related user candidates if external coach is associated to multiple candidate', async () => {
          const organization = await organizationFactory.create({}, {}, true);

          let externalLoggedInCoach = await usersHelper.createLoggedInUser(
            { role: UserRoles.COACH_EXTERNAL, OrganizationId: organization.id },
            {},
            true
          );

          let externalLoggedInCandidate1 = await usersHelper.createLoggedInUser(
            {
              role: UserRoles.CANDIDATE_EXTERNAL,
              OrganizationId: organization.id,
            },
            {},
            true
          );

          let externalLoggedInCandidate2 = await usersHelper.createLoggedInUser(
            {
              role: UserRoles.CANDIDATE_EXTERNAL,
              OrganizationId: organization.id,
            },
            {},
            true
          );

          ({
            loggedInCoach: externalLoggedInCoach,
            loggedInCandidate: externalLoggedInCandidate1,
          } = await userCandidatsHelper.associateCoachAndCandidate(
            externalLoggedInCoach,
            externalLoggedInCandidate1,
            true
          ));

          ({
            loggedInCoach: externalLoggedInCoach,
            loggedInCandidate: externalLoggedInCandidate2,
          } = await userCandidatsHelper.associateCoachAndCandidate(
            externalLoggedInCoach,
            externalLoggedInCandidate2,
            true
          ));

          const {
            user: {
              password,
              hashReset,
              salt,
              saltReset,
              revision,
              updatedAt,
              createdAt,
              lastConnection,
              candidat,
              coaches,
              organization: coachOrganization,
              ...restExternalLoggedInCoach
            },
          } = externalLoggedInCoach;

          const {
            user: {
              password: candidate1Password,
              hashReset: candidate1HashReset,
              salt: candidate1Salt,
              saltReset: candidate1SaltReset,
              revision: candidate1Revision,
              updatedAt: candidate1UpdatedAt,
              createdAt: candidate1CreatedAt,
              lastConnection: candidate1LastConnection,
              candidat: candidate1Candidat,
              coaches: candidate1Coaches,
              organization: candidate1Organization,
              ...restExternalLoggedInCandidate1
            },
          } = externalLoggedInCandidate1;

          const {
            user: {
              password: candidate2Password,
              hashReset: candidate2HashReset,
              salt: candidate2Salt,
              saltReset: candidate2SaltReset,
              revision: candidate2Revision,
              updatedAt: candidate2UpdatedAt,
              createdAt: candidate2CreatedAt,
              lastConnection: candidate2LastConnection,
              candidat: candidate2Candidat,
              coaches: candidate2Coaches,
              organization: candidate2Organization,
              ...restExternalLoggedInCandidate2
            },
          } = externalLoggedInCandidate2;

          const response: APIResponse<UsersController['findRelatedUser']> =
            await request(app.getHttpServer())
              .get(`${route}/candidate`)
              .set('authorization', `Token ${externalLoggedInCoach.token}`)
              .query({
                coachId: externalLoggedInCoach.user.id,
              });

          expect(response.status).toBe(200);
          expect(Array.isArray(response.body)).toBeTruthy();
          assertCondition(Array.isArray(response.body));
          expect(response.body).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                ...candidate1Candidat,
                coach: expect.objectContaining({
                  ...restExternalLoggedInCoach,
                }),
                candidat: expect.objectContaining({
                  ...restExternalLoggedInCandidate1,
                }),
              }),
              expect.objectContaining({
                ...candidate2Candidat,
                coach: expect.objectContaining({
                  ...restExternalLoggedInCoach,
                }),
                candidat: expect.objectContaining({
                  ...restExternalLoggedInCandidate2,
                }),
              }),
            ])
          );
        });
        it('Should return 403 if logged in user is admin ', async () => {
          const response: APIResponse<UsersController['findRelatedUser']> =
            await request(app.getHttpServer())
              .get(`${route}/candidate`)
              .set('authorization', `Token ${loggedInAdmin.token}`);

          expect(response.status).toBe(403);
        });
      });
    });
    describe('R - Read many Users', () => {
      describe('/search?query=&role=&organizationId= - Search a user where query string in email, first name or last name', () => {
        let loggedInAdmin: LoggedUser;
        let loggedInCandidate: LoggedUser;
        let loggedInCoach: LoggedUser;

        let candidates: User[];
        let externalCandidates: User[];
        let coaches: User[];
        let externalCoaches: User[];
        let organization: Organization;
        let otherOrganization: Organization;
        let otherExternalCandidates: User[];
        let otherExternalCoaches: User[];

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

          externalCandidates = await databaseHelper.createEntities(
            userFactory,
            3,
            {
              role: UserRoles.CANDIDATE_EXTERNAL,
              OrganizationId: organization.id,
            },
            {},
            true
          );

          externalCoaches = await databaseHelper.createEntities(
            userFactory,
            3,
            {
              role: UserRoles.COACH_EXTERNAL,
              OrganizationId: organization.id,
            },
            {},
            true
          );

          otherOrganization = await organizationFactory.create({}, {}, true);

          otherExternalCandidates = await databaseHelper.createEntities(
            userFactory,
            3,
            {
              role: UserRoles.CANDIDATE_EXTERNAL,
              OrganizationId: otherOrganization.id,
            },
            {},
            true
          );

          otherExternalCoaches = await databaseHelper.createEntities(
            userFactory,
            3,
            {
              role: UserRoles.COACH_EXTERNAL,
              OrganizationId: otherOrganization.id,
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
            organization: null,
          };

          const response: APIResponse<UsersController['findUsers']> =
            await request(app.getHttpServer())
              .get(
                `${route}/search?query=${loggedInCandidate.user.firstName}&role=${UserRoles.CANDIDATE}`
              )
              .set('authorization', `Token ${loggedInAdmin.token}`);

          expect(response.status).toBe(200);
          expect(response.body).toStrictEqual([
            {
              ...privateCandidateInfo,
              lastConnection:
                loggedInCandidate.user.lastConnection?.toISOString(),
            },
          ]);
        });

        it('Should return 200 and normal candidates if user is logged in as admin and filters by normal candidates', async () => {
          const expectedUsersId = [
            ...candidates.map(({ id }) => id),
            loggedInCandidate.user.id,
          ];

          const response: APIResponse<UsersController['findUsers']> =
            await request(app.getHttpServer())
              .get(`${route}/search?&role=${UserRoles.CANDIDATE}`)
              .set('authorization', `Token ${loggedInAdmin.token}`);

          expect(response.status).toBe(200);
          expect(expectedUsersId).toEqual(
            expect.arrayContaining(response.body.map(({ id }) => id))
          );
        });
        it('Should return 200 and external candidates if user is logged in as admin and filters by external candidates', async () => {
          const expectedUsersId = [
            ...externalCandidates.map(({ id }) => id),
            ...otherExternalCandidates.map(({ id }) => id),
          ];

          const response: APIResponse<UsersController['findUsers']> =
            await request(app.getHttpServer())
              .get(`${route}/search?&role=${UserRoles.CANDIDATE_EXTERNAL}`)
              .set('authorization', `Token ${loggedInAdmin.token}`);

          expect(response.status).toBe(200);
          expect(expectedUsersId).toEqual(
            expect.arrayContaining(response.body.map(({ id }) => id))
          );
        });
        it('Should return 200 and all candidates if user is logged in as admin and filters by all candidates', async () => {
          const expectedUsersId = [
            ...candidates.map(({ id }) => id),
            ...externalCandidates.map(({ id }) => id),
            ...otherExternalCandidates.map(({ id }) => id),
            loggedInCandidate.user.id,
          ];

          const response: APIResponse<UsersController['findUsers']> =
            await request(app.getHttpServer())
              .get(
                `${route}/search?&role[]=${UserRoles.CANDIDATE_EXTERNAL}&role[]=${UserRoles.CANDIDATE}`
              )
              .set('authorization', `Token ${loggedInAdmin.token}`);

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
            await request(app.getHttpServer())
              .get(`${route}/search?&role=${UserRoles.COACH}`)
              .set('authorization', `Token ${loggedInAdmin.token}`);

          expect(response.status).toBe(200);
          expect(expectedUsersId).toEqual(
            expect.arrayContaining(response.body.map(({ id }) => id))
          );
        });
        it('Should return 200 and external coaches if user is logged in as admin and filters by external coaches', async () => {
          const expectedUsersId = [
            ...externalCoaches.map(({ id }) => id),
            ...otherExternalCoaches.map(({ id }) => id),
          ];

          const response: APIResponse<UsersController['findUsers']> =
            await request(app.getHttpServer())
              .get(`${route}/search?&role=${UserRoles.COACH_EXTERNAL}`)
              .set('authorization', `Token ${loggedInAdmin.token}`);

          expect(response.status).toBe(200);
          expect(expectedUsersId).toEqual(
            expect.arrayContaining(response.body.map(({ id }) => id))
          );
        });
        it('Should return 200 and all coaches if user is logged in as admin and filters by all coaches', async () => {
          const expectedUsersId = [
            ...coaches.map(({ id }) => id),
            ...externalCoaches.map(({ id }) => id),
            ...otherExternalCoaches.map(({ id }) => id),
            loggedInCoach.user.id,
          ];

          const response: APIResponse<UsersController['findUsers']> =
            await request(app.getHttpServer())
              .get(
                `${route}/search?&role[]=${UserRoles.COACH_EXTERNAL}&role[]=${UserRoles.COACH}`
              )
              .set('authorization', `Token ${loggedInAdmin.token}`);

          expect(response.status).toBe(200);
          expect(expectedUsersId).toEqual(
            expect.arrayContaining(response.body.map(({ id }) => id))
          );
        });

        it('Should return 200 and part of external candidates from specific organization if user is logged in as admin and filters by external candidates from an organization', async () => {
          const expectedUsersId = externalCandidates.map(({ id }) => id);

          const response: APIResponse<UsersController['findUsers']> =
            await request(app.getHttpServer())
              .get(
                `${route}/search?&role=${UserRoles.CANDIDATE_EXTERNAL}&organizationId=${organization.id}`
              )
              .set('authorization', `Token ${loggedInAdmin.token}`);

          expect(response.status).toBe(200);
          expect(expectedUsersId).toEqual(
            expect.arrayContaining(response.body.map(({ id }) => id))
          );
        });
        it('Should return 200 and part of external coaches from specific organization if user is logged in as admin and filters by external coaches from an organization', async () => {
          const expectedUsersId = externalCoaches.map(({ id }) => id);

          const response: APIResponse<UsersController['findUsers']> =
            await request(app.getHttpServer())
              .get(
                `${route}/search?&role=${UserRoles.COACH_EXTERNAL}&organizationId=${organization.id}`
              )
              .set('authorization', `Token ${loggedInAdmin.token}`);

          expect(response.status).toBe(200);
          expect(expectedUsersId).toEqual(
            expect.arrayContaining(response.body.map(({ id }) => id))
          );
        });

        it('Should return 200 and empty users if user is logged in as admin and filters by normal candidates from an organization', async () => {
          const response: APIResponse<UsersController['findUsers']> =
            await request(app.getHttpServer())
              .get(
                `${route}/search?&role=${UserRoles.CANDIDATE}&organizationId=${organization.id}`
              )
              .set('authorization', `Token ${loggedInAdmin.token}`);

          expect(response.status).toBe(200);
          expect(response.body.length).toBe(0);
        });
        it('Should return 200 and empty users if user is logged in as admin and filters by normal coaches from an organization', async () => {
          const response: APIResponse<UsersController['findUsers']> =
            await request(app.getHttpServer())
              .get(
                `${route}/search?&role=${UserRoles.COACH}&organizationId=${organization.id}`
              )
              .set('authorization', `Token ${loggedInAdmin.token}`);

          expect(response.status).toBe(200);
          expect(response.body.length).toBe(0);
        });

        it('Should return 403 if user is logged in as candidate', async () => {
          const response: APIResponse<UsersController['findUsers']> =
            await request(app.getHttpServer())
              .get(`${route}/search?query=e&role=${UserRoles.CANDIDATE}`)
              .set('authorization', `Token ${loggedInCandidate.token}`);
          expect(response.status).toBe(403);
        });
        it('Should return 403 if user is logged in as coach', async () => {
          const response: APIResponse<UsersController['findUsers']> =
            await request(app.getHttpServer())
              .get(`${route}/search?query=e&role=${UserRoles.CANDIDATE}`)
              .set('authorization', `Token ${loggedInCoach.token}`);
          expect(response.status).toBe(403);
        });
      });
      describe('/search/candidates?query= - Search a public candidate where query string in email, first name or last name', () => {
        let candidate: User;

        beforeEach(async () => {
          candidate = await userFactory.create({
            role: UserRoles.CANDIDATE,
          });
        });
        it('Should return 200 and part of candidates if candidates have a published CV', async () => {
          await cvFactory.create({
            UserId: candidate.id,
            status: CVStatuses.PUBLISHED.value,
          });

          const publicCandidateInfo = [
            {
              id: candidate.id,
              firstName: candidate.firstName,
              lastName: candidate.lastName,
              role: candidate.role,
            },
          ];

          const response: APIResponse<UsersController['findCandidates']> =
            await request(app.getHttpServer()).get(
              `${route}/search/candidates?query=${candidate.firstName}`
            );

          expect(response.status).toBe(200);
          expect(response.body).toStrictEqual(publicCandidateInfo);
        });
        it('Should return 200 and no candidates if candidates have not a published CV', async () => {
          await cvFactory.create({
            UserId: candidate.id,
            status: CVStatuses.PROGRESS.value,
          });

          const response: APIResponse<UsersController['findCandidates']> =
            await request(app.getHttpServer()).get(
              `${route}/search/candidates?query=${candidate.firstName}`
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
            role: UserRoles.CANDIDATE,
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
              await request(app.getHttpServer())
                .get(
                  `${route}/members?limit=2&offset=0&role[]=${UserRoles.CANDIDATE}`
                )
                .set('authorization', `Token ${loggedInAdmin.token}`);
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
              await request(app.getHttpServer())
                .get(
                  `${route}/members?limit=3&offset=0&role[]=${UserRoles.COACH}`
                )
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
                  `${route}/members?limit=2&offset=2&role[]=${UserRoles.CANDIDATE}`
                )
                .set('authorization', `Token ${loggedInAdmin.token}`);
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
              await request(app.getHttpServer())
                .get(
                  `${route}/members?limit=2&offset=2&role[]=${UserRoles.COACH}`
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
              await request(app.getHttpServer())
                .get(
                  `${route}/members?limit=50&offset=0&role[]=${UserRoles.CANDIDATE}&zone[]=${AdminZones.LYON}&zone[]=${AdminZones.PARIS}`
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
              role: UserRoles.CANDIDATE,
              zone: AdminZones.LYON,
            });

            const expectedCoachesIds = [
              ...lyonCoaches.map(({ id }) => id),
              ...parisCoaches.map(({ id }) => id),
            ];

            const response: APIResponse<UsersController['findMembers']> =
              await request(app.getHttpServer())
                .get(
                  `${route}/members?limit=50&offset=0&role[]=${UserRoles.COACH}&zone[]=${AdminZones.LYON}&zone[]=${AdminZones.PARIS}`
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
                role: UserRoles.CANDIDATE,
              },
              { hidden: true }
            );
            await databaseHelper.createEntities(
              userFactory,
              2,
              {
                role: UserRoles.CANDIDATE,
              },
              { hidden: false }
            );

            const response: APIResponse<UsersController['findMembers']> =
              await request(app.getHttpServer())
                .get(
                  `${route}/members?limit=50&offset=0&role[]=${UserRoles.CANDIDATE}&hidden[]=true`
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
                role: UserRoles.CANDIDATE,
              },
              { employed: true }
            );
            await databaseHelper.createEntities(
              userFactory,
              2,
              {
                role: UserRoles.CANDIDATE,
              },
              { employed: false }
            );
            const response: APIResponse<UsersController['findMembers']> =
              await request(app.getHttpServer())
                .get(
                  `${route}/members?limit=50&offset=0&role[]=${UserRoles.CANDIDATE}&employed[]=true`
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
                role: UserRoles.CANDIDATE,
              }
            );

            const pendingCandidates = await databaseHelper.createEntities(
              userFactory,
              2,
              {
                role: UserRoles.CANDIDATE,
              }
            );

            const progressCandidates = await databaseHelper.createEntities(
              userFactory,
              2,
              {
                role: UserRoles.CANDIDATE,
              }
            );

            await Promise.all(
              publishedCandidates.map(async ({ id }) => {
                return cvFactory.create({
                  UserId: id,
                  status: CVStatuses.PENDING.value,
                  version: 1,
                });
              })
            );
            const publishedLatestCVs = await Promise.all(
              publishedCandidates.map(async ({ id }) => {
                return cvFactory.create({
                  UserId: id,
                  status: CVStatuses.PUBLISHED.value,
                  version: 3,
                });
              })
            );

            await Promise.all(
              pendingCandidates.map(async ({ id }) => {
                return cvFactory.create({
                  UserId: id,
                  status: CVStatuses.PUBLISHED.value,
                  version: 3,
                });
              })
            );
            const pendingLatestCVs = await Promise.all(
              pendingCandidates.map(async ({ id }) => {
                return cvFactory.create({
                  UserId: id,
                  status: CVStatuses.PENDING.value,
                  version: 6,
                });
              })
            );

            await Promise.all(
              progressCandidates.map(async ({ id }) => {
                return cvFactory.create({
                  UserId: id,
                  status: CVStatuses.PUBLISHED.value,
                  version: 7,
                });
              })
            );
            await Promise.all(
              progressCandidates.map(async ({ id }) => {
                return cvFactory.create({
                  UserId: id,
                  status: CVStatuses.PROGRESS.value,
                  version: 10,
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
                  `${route}/members?limit=50&offset=0&role[]=${UserRoles.CANDIDATE}&cvStatus[]=${CVStatuses.PUBLISHED.value}&cvStatus[]=${CVStatuses.PENDING.value}`
                )
                .set('authorization', `Token ${loggedInAdmin.token}`);
            expect(response.status).toBe(200);
            expect(response.body.length).toBe(4);
            expect(expectedCandidatesIds).toEqual(
              expect.arrayContaining(response.body.map(({ id }) => id))
            );
            expect(response.body).toEqual(
              expect.arrayContaining([
                ...pendingLatestCVs.map((cv) =>
                  expect.objectContaining({
                    candidat: expect.objectContaining({
                      cvs: [
                        expect.objectContaining({
                          status: cv.status,
                          urlImg: cv.urlImg,
                          version: cv.version,
                        }),
                      ],
                    }),
                  })
                ),
                ...publishedLatestCVs.map((cv) =>
                  expect.objectContaining({
                    candidat: expect.objectContaining({
                      cvs: [
                        expect.objectContaining({
                          status: cv.status,
                          urlImg: cv.urlImg,
                          version: cv.version,
                        }),
                      ],
                    }),
                  })
                ),
              ])
            );
          });
          it('Should return 200, and all the candidates that matches the businessLines filters', async () => {
            const batCandidates = await databaseHelper.createEntities(
              userFactory,
              2,
              {
                role: UserRoles.CANDIDATE,
              }
            );

            const rhCandidates = await databaseHelper.createEntities(
              userFactory,
              2,
              {
                role: UserRoles.CANDIDATE,
              }
            );

            const aaCandidates = await databaseHelper.createEntities(
              userFactory,
              2,
              {
                role: UserRoles.CANDIDATE,
              }
            );

            await Promise.all(
              rhCandidates.map(async ({ id }) => {
                return cvFactory.create(
                  {
                    UserId: id,
                    version: 1,
                  },
                  { businessLines: ['id'] }
                );
              })
            );
            const rhLatestCVs = await Promise.all(
              rhCandidates.map(async ({ id }) => {
                return cvFactory.create(
                  {
                    UserId: id,
                    version: 4,
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
                    version: 2,
                  },
                  { businessLines: ['id'] }
                );
              })
            );
            const batLatestCVs = await Promise.all(
              batCandidates.map(async ({ id }) => {
                return cvFactory.create(
                  {
                    UserId: id,
                    version: 7,
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
                    version: 5,
                  },
                  { businessLines: ['id'] }
                );
              })
            );

            await Promise.all(
              aaCandidates.map(async ({ id }) => {
                return cvFactory.create(
                  {
                    UserId: id,
                    version: 6,
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
                  `${route}/members?limit=50&offset=0&role[]=${UserRoles.CANDIDATE}&businessLines[]=bat&businessLines[]=rh`
                )
                .set('authorization', `Token ${loggedInAdmin.token}`);
            expect(response.status).toBe(200);
            expect(response.body.length).toBe(4);
            expect(expectedCandidatesIds).toEqual(
              expect.arrayContaining(response.body.map(({ id }) => id))
            );
            expect(response.body).toEqual(
              expect.arrayContaining([
                ...rhLatestCVs.map((cv) =>
                  expect.objectContaining({
                    candidat: expect.objectContaining({
                      cvs: [
                        expect.objectContaining({
                          businessLines: expect.arrayContaining([
                            expect.objectContaining({
                              name: 'rh',
                            }),
                          ]),
                          status: cv.status,
                          urlImg: cv.urlImg,
                          version: cv.version,
                        }),
                      ],
                    }),
                  })
                ),
                ...batLatestCVs.map((cv) =>
                  expect.objectContaining({
                    candidat: expect.objectContaining({
                      cvs: [
                        expect.objectContaining({
                          businessLines: expect.arrayContaining([
                            expect.objectContaining({
                              name: 'bat',
                            }),
                          ]),
                          status: cv.status,
                          urlImg: cv.urlImg,
                          version: cv.version,
                        }),
                      ],
                    }),
                  })
                ),
              ])
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
              await request(app.getHttpServer())
                .get(
                  `${route}/members?limit=50&offset=0&role[]=${UserRoles.CANDIDATE}&associatedUser[]=false`
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
              await request(app.getHttpServer())
                .get(
                  `${route}/members?limit=50&offset=0&role[]=${UserRoles.COACH}&associatedUser[]=false`
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
            role: UserRoles.CANDIDATE,
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
              role: UserRoles.CANDIDATE,
            }
          );

          const progressCandidates = await databaseHelper.createEntities(
            userFactory,
            2,
            {
              role: UserRoles.CANDIDATE,
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
            role: UserRoles.CANDIDATE,
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
            await request(app.getHttpServer()).put(`${route}/changePwd`).send({
              oldPassword: password,
              newPassword: 'Candidat123?',
            });
          expect(response.status).toBe(401);
        });
        it('Should return 401 if old password is invalid', async () => {
          const response: APIResponse<UsersController['updatePassword']> =
            await request(app.getHttpServer())
              .put(`${route}/changePwd`)
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
              .put(`${route}/changePwd`)
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
              .put(`${route}/changePwd`)
              .set('authorization', `Token ${loggedInCandidate.token}`)
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
            await request(app.getHttpServer())
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
            await request(app.getHttpServer())
              .put(`${route}/candidate/${otherCandidat.id}`)
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
              .put(`${route}/candidate/${loggedInCandidate.user.id}`)
              .set('authorization', `Token ${loggedInCoach.token}`)
              .send({
                employed: false,
                note: 'updated note by not associated coach',
              });
          expect(response.status).toBe(403);
        });
        it('Should return 400, if candidate updates associated coach id', async () => {
          const response: APIResponse<UsersController['updateUserCandidat']> =
            await request(app.getHttpServer())
              .put(`${route}/candidate/${loggedInCandidate.user.id}`)
              .set('authorization', `Token ${loggedInCandidate.token}`)
              .send({
                coachId: loggedInCoach.user.id,
              });
          expect(response.status).toBe(400);
        });
        it('Should return 400, if coach updates associated candidate id', async () => {
          const response: APIResponse<UsersController['updateUserCandidat']> =
            await request(app.getHttpServer())
              .put(`${route}/candidate/${loggedInCoach.user.id}`)
              .set('authorization', `Token ${loggedInCoach.token}`)
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
            await request(app.getHttpServer())
              .put(`${route}/candidate/${loggedInCandidate.user.id}`)
              .set('authorization', `Token ${loggedInAdmin.token}`)
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
            await request(app.getHttpServer())
              .put(`${route}/candidate/${loggedInCandidate.user.id}`)
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
              .put(`${route}/candidate/${loggedInCandidate.user.id}`)
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
      describe('/linkUser/:userId - Link a user', () => {
        let loggedInAdmin: LoggedUser;
        let loggedInCandidate: LoggedUser;
        let loggedInCoach: LoggedUser;
        let externalCoach: User;
        let externalCandidate: User;
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

          organization = await organizationFactory.create({}, {}, true);

          externalCoach = await userFactory.create(
            { role: UserRoles.COACH_EXTERNAL, OrganizationId: organization.id },
            {},
            true
          );

          externalCandidate = await userFactory.create(
            {
              role: UserRoles.CANDIDATE_EXTERNAL,
              OrganizationId: organization.id,
            },
            {},
            true
          );
        });

        it('Should return 401, if user not logged in', async () => {
          const response: APIResponse<UsersController['linkUser']> =
            await request(app.getHttpServer())
              .put(`${route}/linkUser/${loggedInCandidate.user.id}`)
              .send({
                userToLinkId: loggedInCoach.user.id,
              });
          expect(response.status).toBe(401);
        });
        it('Should return 403, if user is not admin', async () => {
          const response: APIResponse<UsersController['linkUser']> =
            await request(app.getHttpServer())
              .put(`${route}/linkUser/${loggedInCandidate.user.id}`)
              .set('authorization', `Token ${loggedInCandidate.token}`)
              .send({
                userToLinkId: loggedInCoach.user.id,
              });
          expect(response.status).toBe(403);
        });

        it('Should return 404 if admin updates candidate with unexisting coach', async () => {
          const response: APIResponse<UsersController['linkUser']> =
            await request(app.getHttpServer())
              .put(`${route}/linkUser/${loggedInCandidate.user.id}`)
              .set('authorization', `Token ${loggedInAdmin.token}`)
              .send({
                userToLinkId: uuid(),
              });
          expect(response.status).toBe(404);
        });
        it('Should return 404 if admin updates coach with unexisting candidate', async () => {
          const response: APIResponse<UsersController['linkUser']> =
            await request(app.getHttpServer())
              .put(`${route}/linkUser/${loggedInCoach.user.id}`)
              .set('authorization', `Token ${loggedInAdmin.token}`)
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
            organization,
            ...restCandidate
          } = loggedInCandidate.user;

          const {
            candidat: coachCandidat,
            coaches: coachCoaches,
            lastConnection: lastConnectionCoach,
            organization: coachOrganization,
            ...restCoach
          } = loggedInCoach.user;

          const response: APIResponse<UsersController['linkUser']> =
            await request(app.getHttpServer())
              .put(`${route}/linkUser/${loggedInCandidate.user.id}`)
              .set('authorization', `Token ${loggedInAdmin.token}`)
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
            organization,
            ...restCandidate
          } = loggedInCandidate.user;

          const {
            candidat: coachCandidat,
            coaches: coachCoaches,
            lastConnection: lastConnectionCoach,
            organization: coachOrganization,
            ...restCoach
          } = loggedInCoach.user;

          const response: APIResponse<UsersController['linkUser']> =
            await request(app.getHttpServer())
              .put(`${route}/linkUser/${loggedInCoach.user.id}`)
              .set('authorization', `Token ${loggedInAdmin.token}`)
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
            organization,
            ...restCandidate
          } = loggedInCandidate.user;

          const response: APIResponse<UsersController['linkUser']> =
            await request(app.getHttpServer())
              .put(`${route}/linkUser/${loggedInCandidate.user.id}`)
              .set('authorization', `Token ${loggedInAdmin.token}`)
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
            candidat: coachCandidat,
            coaches: coachCoaches,
            lastConnection: lastConnectionCoach,
            organization: coachOrganization,
            ...restCoach
          } = loggedInCoach.user;

          const response: APIResponse<UsersController['linkUser']> =
            await request(app.getHttpServer())
              .put(`${route}/linkUser/${loggedInCoach.user.id}`)
              .set('authorization', `Token ${loggedInAdmin.token}`)
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

        it('Should return 400 if admin updates linked multiple coaches for candidate', async () => {
          const otherCoach = await userFactory.create(
            { role: UserRoles.COACH },
            {},
            true
          );

          const response: APIResponse<UsersController['linkUser']> =
            await request(app.getHttpServer())
              .put(`${route}/linkUser/${loggedInCandidate.user.id}`)
              .set('authorization', `Token ${loggedInAdmin.token}`)
              .send({
                userToLinkId: [loggedInCoach.user.id, otherCoach.id],
              });
          expect(response.status).toBe(400);
        });
        it('Should return 400 if admin updates linked multiple candidates for coach', async () => {
          const otherCandidate = await userFactory.create(
            { role: UserRoles.CANDIDATE },
            {},
            true
          );
          const response: APIResponse<UsersController['linkUser']> =
            await request(app.getHttpServer())
              .put(`${route}/linkUser/${loggedInCoach.user.id}`)
              .set('authorization', `Token ${loggedInAdmin.token}`)
              .send({
                userToLinkId: [loggedInCandidate.user.id, otherCandidate.id],
              });
          expect(response.status).toBe(400);
        });

        it('Should return 200 if admin updates linked external coach for external candidate with same organization', async () => {
          const {
            candidat: { coach, ...restExternalCandidateCandidat },
            coaches,
            lastConnection,
            organization: candidateOrganization,
            ...restExternalCandidate
          } = externalCandidate;

          let otherExternalCandidate = await userFactory.create(
            {
              role: UserRoles.CANDIDATE_EXTERNAL,
              OrganizationId: organization.id,
            },
            {},
            true
          );

          ({ coach: externalCoach, candidate: otherExternalCandidate } =
            await userCandidatsHelper.associateCoachAndCandidate(
              externalCoach,
              otherExternalCandidate,
              false
            ));

          const {
            candidat: {
              coach: otherExternalCandidateCoach,
              ...restOtherExternalCandidateCandidat
            },
            coaches: otherCandidateCoaches,
            lastConnection: otherCandidateLastConnection,
            organization: otherCandidateOrganization,
            ...restOtherExternalCandidate
          } = otherExternalCandidate;

          const {
            candidat: coachCandidat,
            coaches: coachCoaches,
            lastConnection: lastConnectionCoach,
            organization: coachOrganization,
            ...restExternalCoach
          } = externalCoach;

          const response: APIResponse<UsersController['linkUser']> =
            await request(app.getHttpServer())
              .put(`${route}/linkUser/${externalCandidate.id}`)
              .set('authorization', `Token ${loggedInAdmin.token}`)
              .send({
                userToLinkId: externalCoach.id,
              });

          const coachFromDB = await usersHelper.findUser(externalCoach.id);

          expect(response.status).toBe(200);
          expect(response.body).toEqual(
            expect.objectContaining({
              ...restExternalCandidate,
              candidat: expect.objectContaining({
                ...restExternalCandidateCandidat,
                coach: expect.objectContaining({
                  ...restExternalCoach,
                }),
              }),
            })
          );
          expect(coachFromDB).toEqual(
            expect.objectContaining({
              ...restExternalCoach,
              coaches: expect.arrayContaining([
                expect.objectContaining({
                  ...restExternalCandidateCandidat,
                  candidat: expect.objectContaining({
                    ...restExternalCandidate,
                  }),
                }),
                expect.objectContaining({
                  ...restOtherExternalCandidateCandidat,
                  candidat: expect.objectContaining({
                    ...restOtherExternalCandidate,
                  }),
                }),
              ]),
            })
          );
        });
        it('Should return 200 if admin updates linked multiple external candidate for external coach with same organization', async () => {
          const {
            candidat: {
              coach: otherExternalCandidateCoach,
              ...restOtherExternalCandidateCandidat
            },
            coaches: otherCandidateCoaches,
            lastConnection: otherCandidateLastConnection,
            organization: otherCandidateOrganization,
            ...restOtherExternalCandidate
          } = await userFactory.create(
            {
              role: UserRoles.CANDIDATE_EXTERNAL,
              OrganizationId: organization.id,
            },
            {},
            true
          );

          const {
            candidat: { coach, ...restExternalCandidateCandidat },
            coaches,
            lastConnection,
            organization: candidateOrganization,
            ...restExternalCandidate
          } = externalCandidate;

          const {
            candidat: coachCandidat,
            coaches: coachCoaches,
            lastConnection: lastConnectionCoach,
            organization: coachOrganization,
            ...restExternalCoach
          } = externalCoach;

          const response: APIResponse<UsersController['linkUser']> =
            await request(app.getHttpServer())
              .put(`${route}/linkUser/${externalCoach.id}`)
              .set('authorization', `Token ${loggedInAdmin.token}`)
              .send({
                userToLinkId: [
                  externalCandidate.id,
                  restOtherExternalCandidate.id,
                ],
              });
          expect(response.status).toBe(200);
          expect(response.body).toEqual(
            expect.objectContaining({
              ...restExternalCoach,
              coaches: expect.arrayContaining([
                expect.objectContaining({
                  ...restExternalCandidateCandidat,
                  candidat: expect.objectContaining({
                    ...restExternalCandidate,
                  }),
                }),
                expect.objectContaining({
                  ...restOtherExternalCandidateCandidat,
                  candidat: expect.objectContaining({
                    ...restOtherExternalCandidate,
                  }),
                }),
              ]),
            })
          );
        });

        it('Should return 200 if admin removes linked external coach for external candidate', async () => {
          ({ coach: externalCoach, candidate: externalCandidate } =
            await userCandidatsHelper.associateCoachAndCandidate(
              externalCoach,
              externalCandidate,
              false
            ));

          const {
            candidat,
            coaches,
            lastConnection,
            organization: candidateOrganization,
            ...restExternalCandidate
          } = externalCandidate;

          const response: APIResponse<UsersController['linkUser']> =
            await request(app.getHttpServer())
              .put(`${route}/linkUser/${externalCandidate.id}`)
              .set('authorization', `Token ${loggedInAdmin.token}`)
              .send({
                userToLinkId: null,
              });

          expect(response.status).toBe(200);
          expect(response.body).toEqual(
            expect.objectContaining({
              ...restExternalCandidate,
              candidat: expect.objectContaining({
                ...candidat,
                coach: null,
              }),
            })
          );
        });
        it('Should return 200 if admin removes linked multiple external candidate for external coach', async () => {
          ({ coach: externalCoach, candidate: externalCandidate } =
            await userCandidatsHelper.associateCoachAndCandidate(
              externalCoach,
              externalCandidate,
              false
            ));

          const {
            candidat: coachCandidat,
            coaches: coachCoaches,
            lastConnection: lastConnectionCoach,
            organization: coachOrganization,
            ...restExternalCoach
          } = externalCoach;

          const response: APIResponse<UsersController['linkUser']> =
            await request(app.getHttpServer())
              .put(`${route}/linkUser/${externalCoach.id}`)
              .set('authorization', `Token ${loggedInAdmin.token}`)
              .send({
                userToLinkId: null,
              });
          expect(response.status).toBe(200);
          expect(response.body).toEqual(
            expect.objectContaining({
              ...restExternalCoach,
              coaches: [],
            })
          );
        });

        it('Should return 400 if admin updates linked external multiple coaches for candidate', async () => {
          const otherExternalCoach = await userFactory.create(
            { role: UserRoles.COACH, OrganizationId: organization.id },
            {},
            true
          );

          const response: APIResponse<UsersController['linkUser']> =
            await request(app.getHttpServer())
              .put(`${route}/linkUser/${externalCandidate.id}`)
              .set('authorization', `Token ${loggedInAdmin.token}`)
              .send({
                userToLinkId: [externalCoach.id, otherExternalCoach.id],
              });
          expect(response.status).toBe(400);
        });

        it('Should return 400 if admin updates normal candidate with another normal candidate as coach', async () => {
          const otherCandidate = await userFactory.create(
            { role: UserRoles.CANDIDATE },
            {},
            true
          );

          const response: APIResponse<UsersController['linkUser']> =
            await request(app.getHttpServer())
              .put(`${route}/linkUser/${loggedInCandidate.user.id}`)
              .set('authorization', `Token ${loggedInAdmin.token}`)
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
            await request(app.getHttpServer())
              .put(`${route}/linkUser/${otherCoach.id}`)
              .set('authorization', `Token ${loggedInAdmin.token}`)
              .send({
                userToLinkId: otherCoach.id,
              });
          expect(response.status).toBe(400);
        });

        it('Should return 400 if admin updates external candidate with another external candidate as coach', async () => {
          const otherExternalCandidate = await userFactory.create(
            {
              role: UserRoles.CANDIDATE_EXTERNAL,
              OrganizationId: organization.id,
            },
            {},
            true
          );

          const response: APIResponse<UsersController['linkUser']> =
            await request(app.getHttpServer())
              .put(`${route}/linkUser/${externalCandidate.id}`)
              .set('authorization', `Token ${loggedInAdmin.token}`)
              .send({
                userToLinkId: otherExternalCandidate.id,
              });
          expect(response.status).toBe(400);
        });
        it('Should return 400 if admin updates external coach with another external coach as candidate', async () => {
          const otherExternalCoach = await userFactory.create(
            {
              role: UserRoles.COACH_EXTERNAL,
              OrganizationId: organization.id,
            },
            {},
            true
          );

          const response: APIResponse<UsersController['linkUser']> =
            await request(app.getHttpServer())
              .put(`${route}/linkUser/${externalCoach.id}`)
              .set('authorization', `Token ${loggedInAdmin.token}`)
              .send({
                userToLinkId: otherExternalCoach.id,
              });
          expect(response.status).toBe(400);
        });

        it('Should return 400 if admin updates normal candidate with external coach', async () => {
          const externalCoach = await userFactory.create(
            { role: UserRoles.COACH_EXTERNAL },
            {},
            true
          );
          const response: APIResponse<UsersController['linkUser']> =
            await request(app.getHttpServer())
              .put(`${route}/linkUser/${loggedInCandidate.user.id}`)
              .set('authorization', `Token ${loggedInAdmin.token}`)
              .send({
                userToLinkId: externalCoach.id,
              });
          expect(response.status).toBe(400);
        });
        it('Should return 400 if admin updates normal coach with external candidate', async () => {
          const externalCandidate = await userFactory.create(
            { role: UserRoles.CANDIDATE_EXTERNAL },
            {},
            true
          );

          const response: APIResponse<UsersController['linkUser']> =
            await request(app.getHttpServer())
              .put(`${route}/linkUser/${loggedInCoach.user.id}`)
              .set('authorization', `Token ${loggedInAdmin.token}`)
              .send({
                userToLinkId: externalCandidate.id,
              });
          expect(response.status).toBe(400);
        });

        it('Should return 400 if admin updates external candidate with normal coach', async () => {
          const response: APIResponse<UsersController['linkUser']> =
            await request(app.getHttpServer())
              .put(`${route}/linkUser/${externalCandidate.id}`)
              .set('authorization', `Token ${loggedInAdmin.token}`)
              .send({
                userToLinkId: loggedInCoach.user.id,
              });
          expect(response.status).toBe(400);
        });
        it('Should return 400 if admin updates external coach with normal candidate', async () => {
          const response: APIResponse<UsersController['linkUser']> =
            await request(app.getHttpServer())
              .put(`${route}/linkUser/${externalCoach.id}`)
              .set('authorization', `Token ${loggedInAdmin.token}`)
              .send({
                userToLinkId: loggedInCandidate.user.id,
              });
          expect(response.status).toBe(400);
        });

        it('Should return 400 if admin updates external candidate with external coach from another organization', async () => {
          const otherOrganization = await organizationFactory.create(
            {},
            {},
            true
          );

          const otherExternalCoach = await userFactory.create(
            {
              role: UserRoles.COACH_EXTERNAL,
              OrganizationId: otherOrganization.id,
            },
            {},
            true
          );
          const response: APIResponse<UsersController['linkUser']> =
            await request(app.getHttpServer())
              .put(`${route}/linkUser/${externalCandidate.id}`)
              .set('authorization', `Token ${loggedInAdmin.token}`)
              .send({
                userToLinkId: otherExternalCoach.id,
              });
          expect(response.status).toBe(400);
        });
        it('Should return 400 if admin updates external coach with external candidate from another organization', async () => {
          const otherOrganization = await organizationFactory.create(
            {},
            {},
            true
          );

          const otherExternalCandidate = await userFactory.create(
            {
              role: UserRoles.CANDIDATE_EXTERNAL,
              OrganizationId: otherOrganization.id,
            },
            {},
            true
          );

          const response: APIResponse<UsersController['linkUser']> =
            await request(app.getHttpServer())
              .put(`${route}/linkUser/${externalCoach.id}`)
              .set('authorization', `Token ${loggedInAdmin.token}`)
              .send({
                userToLinkId: otherExternalCandidate.id,
              });
          expect(response.status).toBe(400);
        });
      });
      describe('/candidate/checkUpdate - Check if update has been made on userCandidat note', () => {
        let loggedInAdmin: LoggedUser;
        let loggedInCandidate: LoggedUser;
        let loggedInCoach: LoggedUser;

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
            `${route}/candidate/checkUpdate/${loggedInCandidate.user.id}`
          );

          expect(response.status).toBe(401);
        });
        it('Should return 403, if admin checks if note has been updated', async () => {
          const response: APIResponse<
            UsersController['checkNoteHasBeenModified']
          > = await request(app.getHttpServer())
            .get(`${route}/candidate/checkUpdate/${loggedInCandidate.user.id}`)
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
            .get(`${route}/candidate/checkUpdate/${loggedInCandidate.user.id}`)
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
            .get(`${route}/candidate/checkUpdate/${loggedInCandidate.user.id}`)
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
            .get(`${route}/candidate/checkUpdate/${loggedInCandidate.user.id}`)
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
            .get(`${route}/candidate/checkUpdate/${loggedInCandidate.user.id}`)
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
            .get(`${route}/candidate/checkUpdate/${loggedInCandidate.user.id}`)
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
            .get(`${route}/candidate/checkUpdate/${loggedInCandidate.user.id}`)
            .set('authorization', `Token ${loggedInCandidate.token}`);
          expect(response.status).toBe(200);
          expect(response.body.noteHasBeenModified).toBe(false);
        });
      });
      describe('/candidate/read/:candidateId - Set note to has been read', () => {
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
          const response: APIResponse<UsersController['setNoteHasBeenRead']> =
            await request(app.getHttpServer()).put(
              `${route}/candidate/read/${loggedInCandidate.user.id}`
            );

          expect(response.status).toBe(401);
        });
        it('Should return 403, if admin sets the note has been read', async () => {
          const response: APIResponse<UsersController['setNoteHasBeenRead']> =
            await request(app.getHttpServer())
              .put(`${route}/candidate/read/${loggedInCandidate.user.id}`)
              .set('authorization', `Token ${loggedInAdmin.token}`);
          expect(response.status).toBe(403);
        });
        it('Should return 403, if coach sets the note has been read on candidate not related', async () => {
          const response: APIResponse<UsersController['setNoteHasBeenRead']> =
            await request(app.getHttpServer())
              .put(`${route}/candidate/read/${loggedInCandidate.user.id}`)
              .set('authorization', `Token ${loggedInCoach.token}`);
          expect(response.status).toBe(403);
        });
        it('Should return 200, if candidat sets the note and is not related to a coach', async () => {
          const response: APIResponse<UsersController['setNoteHasBeenRead']> =
            await request(app.getHttpServer())
              .put(`${route}/candidate/read/${loggedInCandidate.user.id}`)
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
              .put(`${route}/candidate/read/${loggedInCandidate.user.id}`)
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
              .put(`${route}/candidate/read/${loggedInCandidate.user.id}`)
              .set('authorization', `Token ${loggedInCandidate.token}`);
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

        it('Should return 200, and updated opportunities ids, if admin bulk updates some users', async () => {
          const originalUsers = await databaseHelper.createEntities(
            userFactory,
            5,
            {
              role: UserRoles.CANDIDATE,
              userCandidat: { hidden: true },
            }
          );
          const originalUsersIds = originalUsers.map(({ id }) => {
            return id;
          });
          const response: APIResponse<UsersController['updateAll']> =
            await request(app.getHttpServer())
              .put(`${route}/candidate/bulk`)
              .set('authorization', `Token ${loggedInAdmin.token}`)
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
        it('Should return 403, if not logged in as candidate', async () => {
          const originalUsers = await databaseHelper.createEntities(
            userFactory,
            5,
            {
              role: UserRoles.CANDIDATE,
              userCandidat: { hidden: true },
            }
          );
          const originalUsersIds = originalUsers.map(({ id }) => {
            return id;
          });
          const responseCandidate: APIResponse<UsersController['updateAll']> =
            await request(app.getHttpServer())
              .put(`${route}/candidate/bulk`)
              .set('authorization', `Token ${loggedInCandidate.token}`)
              .send({
                attributes: {
                  hidden: true,
                },
                ids: originalUsersIds,
              });
          expect(responseCandidate.status).toBe(403);
        });
        it('Should return 403, if not logged in as coach', async () => {
          const originalUsers = await databaseHelper.createEntities(
            userFactory,
            5,
            {
              role: UserRoles.CANDIDATE,
              userCandidat: { hidden: true },
            }
          );
          const originalUsersIds = originalUsers.map(({ id }) => {
            return id;
          });
          const responseCoach: APIResponse<UsersController['updateAll']> =
            await request(app.getHttpServer())
              .put(`${route}/candidate/bulk`)
              .set('authorization', `Token ${loggedInCoach.token}`)
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
            role: UserRoles.CANDIDATE,
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
