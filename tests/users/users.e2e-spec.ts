import { getQueueToken } from '@nestjs/bull';
import { CACHE_MANAGER, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import moment from 'moment';
import request from 'supertest';
import { v4 as uuid } from 'uuid';
import { CacheMocks, QueueMocks, S3Mocks } from '../mocks.types';
import { LoggedUser } from 'src/auth/auth.types';
import { BusinessSector } from 'src/common/businessSectors/models';
import { Department } from 'src/common/locations/locations.types';
import { Occupation } from 'src/common/occupations/models';
import {
  CandidateYesNoNSPP,
  CandidateYesNo,
} from 'src/contacts/contacts.types';
import { S3Service } from 'src/external-services/aws/s3.service';
import { Organization } from 'src/organizations/models';
import { Queues } from 'src/queues/queues.types';
import { HelpNeed, HelpOffer, UserProfile } from 'src/user-profiles/models';
import { UserProfilesController } from 'src/user-profiles/user-profiles.controller';
import { HelpValue } from 'src/user-profiles/user-profiles.types';
import { User, UserCandidat } from 'src/users/models';
import { UsersController } from 'src/users/users.controller';
import { Programs, UserRoles } from 'src/users/users.types';
import { UsersCreationController } from 'src/users-creation/users-creation.controller';
import { UsersDeletionController } from 'src/users-deletion/users-deletion.controller';
import { getZoneFromDepartment } from 'src/utils/misc';
import { assertCondition } from 'src/utils/misc/asserts';
import { AdminZones, APIResponse } from 'src/utils/types';
import { SkillsHelper } from 'tests/common/skills/skills.helper';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import { InternalMessageFactory } from 'tests/messages/internal-message.factory';
import { OrganizationFactory } from 'tests/organizations/organization.factory';
import { UserCandidatsHelper } from './user-candidats.helper';
import { UserProfilesHelper } from './user-profiles.helper';
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
  let userProfilesHelper: UserProfilesHelper;
  let skillsHelper: SkillsHelper;
  let organizationFactory: OrganizationFactory;
  let internalMessageFactory: InternalMessageFactory;

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
    userProfilesHelper =
      moduleFixture.get<UserProfilesHelper>(UserProfilesHelper);
    userFactory = moduleFixture.get<UserFactory>(UserFactory);
    organizationFactory =
      moduleFixture.get<OrganizationFactory>(OrganizationFactory);
    internalMessageFactory = moduleFixture.get<InternalMessageFactory>(
      InternalMessageFactory
    );
  });

  afterAll(async () => {
    await databaseHelper.resetTestDB();
    await app.close();
    server.close();
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
            whatsappZoneCoachName,
            whatsappZoneCoachUrl,
            whatsappZoneCoachQR,
            ...user
          } = await userFactory.create({}, {}, false);
          const response: APIResponse<UsersCreationController['createUser']> =
            await request(server)
              .post(`${route}`)
              .set('authorization', `Bearer ${loggedInAdmin.token}`)
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
            whatsappZoneCoachName,
            whatsappZoneCoachUrl,
            whatsappZoneCoachQR,
            ...user
          } = await userFactory.create({}, {}, false);
          const response: APIResponse<UsersCreationController['createUser']> =
            await request(server)
              .post(`${route}`)
              .set('authorization', `Bearer ${loggedInAdmin.token}`)
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
            await request(server)
              .post(`${route}`)
              .set('authorization', `Bearer ${loggedInAdmin.token}`)
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
            await request(server)
              .post(`${route}`)
              .set('authorization', `Bearer ${loggedInAdmin.token}`)
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
            await request(server).post(`${route}`).send(candidate);
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
            await request(server)
              .post(`${route}`)
              .set('authorization', `Bearer ${loggedInCandidate.token}`)
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
            whatsappZoneCoachName,
            whatsappZoneCoachUrl,
            whatsappZoneCoachQR,
            userSocialSituation,
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
            await request(server)
              .post(`${route}`)
              .set('authorization', `Bearer ${loggedInAdmin.token}`)
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
              whatsappZoneCoachName,
              whatsappZoneCoachUrl,
              whatsappZoneCoachQR,
              ...candidate
            } = await userFactory.create(
              { role: UserRoles.CANDIDATE },
              {},
              false
            );
            const response: APIResponse<UsersCreationController['createUser']> =
              await request(server)
                .post(`${route}`)
                .set('authorization', `Bearer ${loggedInAdmin.token}`)
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
              whatsappZoneCoachName,
              whatsappZoneCoachUrl,
              whatsappZoneCoachQR,
              OrganizationId,
              userSocialSituation,
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
              readDocuments: [],
              organization,
              candidat,
              coaches,
              whatsappZoneCoachName: coachWhatsappZoneCoachName,
              whatsappZoneCoachUrl: coachWhatsappZoneCoachUrl,
              whatsappZoneCoachQR: coachWhatsappZoneCoachQR,
              OrganizationId: coachOrganizationId,
              referredCandidates: coachReferredCandidates,
              referer: coachReferer,
              userSocialSituation: coachUserSocialSituation,
              ...coach
            } = await userFactory.create({ role: UserRoles.COACH }, {}, true);

            const response: APIResponse<UsersCreationController['createUser']> =
              await request(server)
                .post(`${route}`)
                .set('authorization', `Bearer ${loggedInAdmin.token}`)
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
              whatsappZoneCoachName,
              whatsappZoneCoachUrl,
              whatsappZoneCoachQR,
              ...candidate
            } = await userFactory.create(
              { role: UserRoles.CANDIDATE },
              {},
              false
            );

            const response: APIResponse<UsersCreationController['createUser']> =
              await request(server)
                .post(`${route}`)
                .set('authorization', `Bearer ${loggedInAdmin.token}`)
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
              whatsappZoneCoachName,
              whatsappZoneCoachUrl,
              whatsappZoneCoachQR,
              ...coach
            } = await userFactory.create({ role: UserRoles.COACH }, {}, false);

            const response: APIResponse<UsersCreationController['createUser']> =
              await request(server)
                .post(`${route}`)
                .set('authorization', `Bearer ${loggedInAdmin.token}`)
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
              whatsappZoneCoachName: coachWhatsappZoneCoachName,
              whatsappZoneCoachUrl: coachWhatsappZoneCoachUrl,
              whatsappZoneCoachQR: coachWhatsappZoneCoachQR,
              referredCandidates: coachReferredCandidates,
              refererId: coachRefererId,
              userSocialSituation: coachUserSocialSituation,
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
              readDocuments: [],
              organization,
              candidat,
              coaches,
              whatsappZoneCoachName: candidateWhatappZoneCoachName,
              whatsappZoneCoachUrl: candidateWhatappZoneCoachUrl,
              whatsappZoneCoachQR: candidateWhatappZoneCoachQR,
              refererId: candidateRefererId,
              referredCandidates: candidateReferredCandidates,
              referer: candidateReferer,
              userSocialSituation: candidateUserSocialSituation,
              ...candidate
            } = await userFactory.create(
              { role: UserRoles.CANDIDATE },
              {},
              true
            );

            const response: APIResponse<UsersCreationController['createUser']> =
              await request(server)
                .post(`${route}`)
                .set('authorization', `Bearer ${loggedInAdmin.token}`)
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
              whatsappZoneCoachName,
              whatsappZoneCoachUrl,
              whatsappZoneCoachQR,
              ...coach
            } = await userFactory.create({ role: UserRoles.COACH }, {}, false);

            const response: APIResponse<UsersCreationController['createUser']> =
              await request(server)
                .post(`${route}`)
                .set('authorization', `Bearer ${loggedInAdmin.token}`)
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
              whatsappZoneCoachName,
              whatsappZoneCoachUrl,
              whatsappZoneCoachQR,
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
              await request(server)
                .post(`${route}`)
                .set('authorization', `Bearer ${loggedInAdmin.token}`)
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
              whatsappZoneCoachName,
              whatsappZoneCoachUrl,
              whatsappZoneCoachQR,
              ...coach
            } = await userFactory.create({ role: UserRoles.COACH }, {}, false);

            const { id } = await userFactory.create(
              { role: UserRoles.COACH },
              {},
              true
            );

            const response: APIResponse<UsersCreationController['createUser']> =
              await request(server)
                .post(`${route}`)
                .set('authorization', `Bearer ${loggedInAdmin.token}`)
                .send({ ...coach, userToLinkId: id });
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
              whatsappZoneCoachName,
              whatsappZoneCoachUrl,
              whatsappZoneCoachQR,
              ...candidate
            } = await userFactory.create(
              { role: UserRoles.CANDIDATE },
              {},
              false
            );

            const response: APIResponse<UsersCreationController['createUser']> =
              await request(server)
                .post(`${route}`)
                .set('authorization', `Bearer ${loggedInAdmin.token}`)
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
              whatsappZoneCoachName,
              whatsappZoneCoachUrl,
              whatsappZoneCoachQR,
              ...coach
            } = await userFactory.create({ role: UserRoles.COACH }, {}, false);

            const response: APIResponse<UsersCreationController['createUser']> =
              await request(server)
                .post(`${route}`)
                .set('authorization', `Bearer ${loggedInAdmin.token}`)
                .send({
                  ...coach,
                  OrganizationId: organization.id,
                });

            expect(response.status).toBe(400);
          });
        });
      });
      describe('/registration - Create user through registration', () => {
        it('Should return 200 and a created candidate if valid candidate data', async () => {
          const user = await userFactory.create(
            { role: UserRoles.CANDIDATE },
            {},
            false
          );

          const helpNeeds: { name: HelpValue }[] = [
            { name: 'cv' },
            { name: 'interview' },
          ];

          const userValues = {
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            phone: user.phone,
            role: user.role,
            gender: user.gender,
          };

          const userProfileValues = {
            helpNeeds: helpNeeds,
            department: 'Paris (75)' as Department,
          };

          const userToSend = {
            ...userValues,
            ...userProfileValues,
            password: user.password,
            campaign: '1234',
            workingRight: CandidateYesNoNSPP.YES,
            materialInsecurity: CandidateYesNo.YES,
            networkInsecurity: CandidateYesNo.NO,
            program: Programs.THREE_SIXTY,
            birthDate: '1996-24-04',
            businessSectors: [{ name: 'id' }] as BusinessSector[],
            occupations: [{ name: 'développeur' }] as Occupation[],
          };

          const response: APIResponse<
            UsersCreationController['createUserRegistration']
          > = await request(server)
            .post(`${route}/registration`)
            .send(userToSend);
          expect(response.status).toBe(201);
          expect(response.body).toEqual(
            expect.objectContaining({
              ...userValues,
              zone: getZoneFromDepartment(userProfileValues.department),
              userProfile: expect.objectContaining({
                department: userProfileValues.department,
                helpNeeds: expect.arrayContaining(
                  userProfileValues.helpNeeds.map((expectation) =>
                    expect.objectContaining(expectation)
                  )
                ),
              }),
            })
          );
        });
        it('Should return 200 and a created coach if valid coach data', async () => {
          const user = await userFactory.create(
            { role: UserRoles.COACH },
            {},
            false
          );

          const userValues = {
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            phone: user.phone,
            role: user.role,
            gender: user.gender,
          };

          const userProfileValues = {
            department: 'Paris (75)' as Department,
          };

          const userToSend = {
            ...userValues,
            ...userProfileValues,
            password: user.password,
            campaign: '1234',
            program: Programs.THREE_SIXTY,
            birthDate: '1996-24-04',
            materialInsecurity: CandidateYesNo.YES,
            networkInsecurity: CandidateYesNo.NO,
          };

          const response: APIResponse<
            UsersCreationController['createUserRegistration']
          > = await request(server)
            .post(`${route}/registration`)
            .send(userToSend);
          expect(response.status).toBe(201);
          expect(response.body).toEqual(
            expect.objectContaining({
              ...userValues,
              zone: getZoneFromDepartment(userProfileValues.department),
              userProfile: expect.objectContaining({
                department: userProfileValues.department,
              }),
            })
          );
        });
        it('Should return 200 and a created referer if valid referer data', async () => {
          const user = await userFactory.create(
            { role: UserRoles.REFERER },
            {},
            false
          );

          const organization = await organizationFactory.create({}, {}, true);

          const userValues = {
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            phone: user.phone,
            role: user.role,
            gender: user.gender,
          };

          const userOrganizationValues = {
            organizationId: organization.id,
          };

          const userProfileValues = {
            department: 'Paris (75)' as Department,
          };

          const userToSend = {
            ...userValues,
            ...userProfileValues,
            ...userOrganizationValues,
            password: user.password,
            birthDate: '1996-24-04',
            materialInsecurity: CandidateYesNo.YES,
            networkInsecurity: CandidateYesNo.NO,
          };

          const response: APIResponse<
            UsersCreationController['createUserRegistration']
          > = await request(server)
            .post(`${route}/registration`)
            .send(userToSend);
          expect(response.status).toBe(201);
          expect(response.body).toEqual(
            expect.objectContaining({
              ...userValues,
              zone: getZoneFromDepartment(userProfileValues.department),
              organization: {
                id: organization.id,
                name: organization.name,
                zone: organization.zone,
                address: organization.address,
              },
              userProfile: expect.objectContaining({
                department: userProfileValues.department,
              }),
            })
          );
        });
        it('Should return 201 and a created candidate if missing optional fields', async () => {
          const user = await userFactory.create(
            { role: UserRoles.CANDIDATE },
            {},
            false
          );

          const userValues = {
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            phone: user.phone,
            role: user.role,
            gender: user.gender,
          };

          const userProfileValues = {
            department: 'Paris (75)' as Department,
          };

          const userToSend = {
            ...userValues,
            ...userProfileValues,
            password: user.password,
            program: Programs.THREE_SIXTY,
            birthDate: '1996-24-04',
            materialInsecurity: CandidateYesNo.YES,
            networkInsecurity: CandidateYesNo.NO,
          };

          const response: APIResponse<
            UsersCreationController['createUserRegistration']
          > = await request(server)
            .post(`${route}/registration`)
            .send(userToSend);
          expect(response.status).toBe(201);
          expect(response.body).toEqual(
            expect.objectContaining({
              ...userValues,
              zone: getZoneFromDepartment(userProfileValues.department),
              userProfile: expect.objectContaining({
                department: userProfileValues.department,
              }),
            })
          );
        });
        it('Should return 400 when candidate has missing mandatory fields', async () => {
          const user = await userFactory.create(
            { role: UserRoles.CANDIDATE },
            {},
            false
          );

          const userValues = {
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
          };

          const userProfileValues = {
            department: 'Paris (75)' as Department,
          };

          const userToSend = {
            ...userValues,
            ...userProfileValues,
            password: user.password,
          };

          const response: APIResponse<
            UsersCreationController['createUserRegistration']
          > = await request(server)
            .post(`${route}/registration`)
            .send(userToSend);
          expect(response.status).toBe(400);
        });
        it('Should return 400 when coach has missing mandatory fields', async () => {
          const user = await userFactory.create(
            { role: UserRoles.COACH },
            {},
            false
          );

          const userValues = {
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
          };

          const userProfileValues = {
            department: 'Paris (75)' as Department,
          };

          const userToSend = {
            ...userValues,
            ...userProfileValues,
            password: user.password,
          };

          const response: APIResponse<
            UsersCreationController['createUserRegistration']
          > = await request(server)
            .post(`${route}/registration`)
            .send(userToSend);
          expect(response.status).toBe(400);
        });
        it('Should return 400 when referer has missing mandatory fields', async () => {
          const user = await userFactory.create(
            { role: UserRoles.REFERER },
            {},
            false
          );

          const userValues = {
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
          };

          const userProfileValues = {
            department: 'Paris (75)' as Department,
          };

          const userToSend = {
            ...userValues,
            ...userProfileValues,
            password: user.password,
          };

          const response: APIResponse<
            UsersCreationController['createUserRegistration']
          > = await request(server)
            .post(`${route}/registration`)
            .send(userToSend);
          expect(response.status).toBe(400);
        });
        it('Should return 400 when user has invalid email', async () => {
          const user = await userFactory.create(
            { role: UserRoles.COACH },
            {},
            false
          );

          const userValues = {
            firstName: user.firstName,
            lastName: user.lastName,
            email: 'email.fr',
            phone: user.phone,
            role: user.role,
            gender: user.gender,
          };

          const userProfileValues = {
            department: 'Paris (75)' as Department,
          };

          const userToSend = {
            ...userValues,
            ...userProfileValues,
            password: user.password,
            program: Programs.THREE_SIXTY,
            birthDate: '1996-24-04',
          };

          const response: APIResponse<
            UsersCreationController['createUserRegistration']
          > = await request(server)
            .post(`${route}/registration`)
            .send(userToSend);
          expect(response.status).toBe(400);
        });
        it('Should return 400 when user has invalid phone', async () => {
          const user = await userFactory.create(
            { role: UserRoles.CANDIDATE },
            {},
            false
          );

          const userValues = {
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            phone: '1234',
            role: user.role,
            gender: user.gender,
          };

          const userProfileValues = {
            department: 'Paris (75)' as Department,
          };

          const userToSend = {
            ...userValues,
            ...userProfileValues,
            password: user.password,
            program: Programs.THREE_SIXTY,
            birthDate: '1996-24-04',
          };

          const response: APIResponse<
            UsersCreationController['createUserRegistration']
          > = await request(server)
            .post(`${route}/registration`)
            .send(userToSend);
          expect(response.status).toBe(400);
        });

        it('Should return 409 when the email already exist', async () => {
          const existingUser = await userFactory.create({}, {}, true);

          const user = await userFactory.create(
            { role: UserRoles.CANDIDATE },
            {},
            false
          );

          const userValues = {
            firstName: user.firstName,
            lastName: user.lastName,
            email: existingUser.email,
            phone: user.phone,
            role: user.role,
            gender: user.gender,
          };

          const userProfileValues = {
            department: 'Paris (75)' as Department,
          };

          const userToSend = {
            ...userValues,
            ...userProfileValues,
            password: user.password,
            program: Programs.THREE_SIXTY,
            materialInsecurity: CandidateYesNo.YES,
            networkInsecurity: CandidateYesNo.NO,
            birthDate: '1996-24-04',
          };

          const response: APIResponse<
            UsersCreationController['createUserRegistration']
          > = await request(server)
            .post(`${route}/registration`)
            .send(userToSend);
          expect(response.status).toBe(409);
        });
      });
      describe('/refering - Create user through refering', () => {
        let loggedInReferer: LoggedUser;
        let loggedInCandidate: LoggedUser;
        let loggedInCoach: LoggedUser;
        let organization: Organization;

        beforeEach(async () => {
          organization = await organizationFactory.create({}, {}, true);
          loggedInReferer = await usersHelper.createLoggedInUser({
            role: UserRoles.REFERER,
            OrganizationId: organization.id,
          });
          loggedInCandidate = await usersHelper.createLoggedInUser({
            role: UserRoles.CANDIDATE,
            OrganizationId: organization.id,
          });
          loggedInCoach = await usersHelper.createLoggedInUser({
            role: UserRoles.COACH,
            OrganizationId: organization.id,
          });
        });

        it('Should return 200 and a created candidate if valid candidate data', async () => {
          const user = await userFactory.create(
            { role: UserRoles.CANDIDATE },
            {},
            false
          );

          const helpNeeds: { name: HelpValue }[] = [
            { name: 'cv' },
            { name: 'interview' },
          ];

          const userValues = {
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            phone: user.phone,
            gender: user.gender,
          };

          const userProfileValues = {
            helpNeeds: helpNeeds,
            department: 'Paris (75)' as Department,
          };

          const userToSend = {
            ...userValues,
            ...userProfileValues,
            campaign: '1234',
            workingRight: CandidateYesNoNSPP.YES,
            materialInsecurity: CandidateYesNo.YES,
            networkInsecurity: CandidateYesNo.NO,
            program: Programs.THREE_SIXTY,
            birthDate: '1996-24-04',
            businessSector: [{ name: 'id' }] as BusinessSector[],
            occupations: [{ name: 'développeur' }] as Occupation[],
          };

          const response: APIResponse<
            UsersCreationController['createUserRefering']
          > = await request(server)
            .post(`${route}/refering`)
            .set('authorization', `Bearer ${loggedInReferer.token}`)
            .send(userToSend);
          expect(response.status).toBe(201);
          expect(response.body).toEqual(
            expect.objectContaining({
              ...userValues,
              zone: getZoneFromDepartment(userProfileValues.department),
              userProfile: expect.objectContaining({
                department: userProfileValues.department,
                helpNeeds: expect.arrayContaining(
                  userProfileValues.helpNeeds.map((expectation) =>
                    expect.objectContaining(expectation)
                  )
                ),
              }),
            })
          );
        });

        it('Should return 200 and a created candidate if valid candidate data with minimum data', async () => {
          const user = await userFactory.create(
            { role: UserRoles.CANDIDATE },
            {},
            false
          );

          const helpNeeds: { name: HelpValue }[] = [{ name: 'cv' }];

          const userValues = {
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            phone: user.phone,
            gender: user.gender,
          };

          const userProfileValues = {
            helpNeeds: helpNeeds,
            department: 'Paris (75)' as Department,
          };

          const userToSend = {
            ...userValues,
            ...userProfileValues,
            program: Programs.THREE_SIXTY,
            workingRight: CandidateYesNoNSPP.YES,
            materialInsecurity: CandidateYesNo.YES,
            networkInsecurity: CandidateYesNo.NO,
            birthDate: '1996-24-04',
            businessSectors: [{ name: 'id' }] as BusinessSector[],
          };

          const response: APIResponse<
            UsersCreationController['createUserRefering']
          > = await request(server)
            .post(`${route}/refering`)
            .set('authorization', `Bearer ${loggedInReferer.token}`)
            .send(userToSend);
          expect(response.status).toBe(201);
          expect(response.body).toEqual(
            expect.objectContaining({
              ...userValues,
              zone: getZoneFromDepartment(userProfileValues.department),
              userProfile: expect.objectContaining({
                department: userProfileValues.department,
                helpNeeds: expect.arrayContaining(
                  userProfileValues.helpNeeds.map((expectation) =>
                    expect.objectContaining(expectation)
                  )
                ),
              }),
            })
          );
        });

        it('Should return 400 when has missing mandatory fields', async () => {
          const user = await userFactory.create(
            { role: UserRoles.CANDIDATE },
            {},
            false
          );

          const helpNeeds: { name: HelpValue }[] = [];

          const userValues = {
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
          };

          const userProfileValues = {
            helpNeeds: helpNeeds,
            department: 'Paris (75)' as Department,
          };

          const userToSend = {
            ...userValues,
            ...userProfileValues,
            campaign: '1234',
            workingRight: CandidateYesNoNSPP.YES,
            birthDate: '1996-24-04',
          };

          const response: APIResponse<
            UsersCreationController['createUserRefering']
          > = await request(server)
            .post(`${route}/refering`)
            .set('authorization', `Bearer ${loggedInReferer.token}`)
            .send(userToSend);
          expect(response.status).toBe(400);
        });

        it('Should return 400 when has invalid email', async () => {
          const user = await userFactory.create(
            { role: UserRoles.CANDIDATE },
            {},
            false
          );

          const helpNeeds: { name: HelpValue }[] = [
            { name: 'cv' },
            { name: 'interview' },
          ];

          const userValues = {
            firstName: user.firstName,
            lastName: user.lastName,
            email: 'email.fr', // This is the incorrect data
            phone: user.phone,
            gender: user.gender,
          };

          const userProfileValues = {
            helpNeeds: helpNeeds,
            department: 'Paris (75)' as Department,
          };

          const userToSend = {
            ...userValues,
            ...userProfileValues,
            campaign: '1234',
            workingRight: CandidateYesNoNSPP.YES,
            materialInsecurity: CandidateYesNo.YES,
            networkInsecurity: CandidateYesNo.NO,
            program: Programs.THREE_SIXTY,
            birthDate: '1996-24-04',
            occupations: [{ name: 'développeur' }] as Occupation[],
          };

          const response: APIResponse<
            UsersCreationController['createUserRefering']
          > = await request(server)
            .post(`${route}/refering`)
            .set('authorization', `Bearer ${loggedInReferer.token}`)
            .send(userToSend);
          expect(response.status).toBe(400);
        });

        it('Should return 400 when has invalid email', async () => {
          const user = await userFactory.create(
            { role: UserRoles.CANDIDATE },
            {},
            false
          );

          const helpNeeds: { name: HelpValue }[] = [
            { name: 'cv' },
            { name: 'interview' },
          ];

          const userValues = {
            firstName: user.firstName,
            lastName: user.lastName,
            email: 'email.fr', // This is the incorrect data
            phone: user.phone,
            gender: user.gender,
          };

          const userProfileValues = {
            helpNeeds: helpNeeds,
            department: 'Paris (75)' as Department,
          };

          const userToSend = {
            ...userValues,
            ...userProfileValues,
            campaign: '1234',
            workingRight: CandidateYesNoNSPP.YES,
            materialInsecurity: CandidateYesNo.YES,
            networkInsecurity: CandidateYesNo.NO,
            program: Programs.THREE_SIXTY,
            birthDate: '1996-24-04',
            occupations: [{ name: 'développeur' }] as Occupation[],
          };

          const response: APIResponse<
            UsersCreationController['createUserRefering']
          > = await request(server)
            .post(`${route}/refering`)
            .set('authorization', `Bearer ${loggedInReferer.token}`)
            .send(userToSend);
          expect(response.status).toBe(400);
        });

        it('Should return 400 when has invalid phone', async () => {
          const user = await userFactory.create(
            { role: UserRoles.CANDIDATE },
            {},
            false
          );

          const helpNeeds: { name: HelpValue }[] = [
            { name: 'cv' },
            { name: 'interview' },
          ];

          const userValues = {
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            phone: '1234', // This is the incorrect data
            gender: user.gender,
          };

          const userProfileValues = {
            helpNeeds: helpNeeds,
            department: 'Paris (75)' as Department,
          };

          const userToSend = {
            ...userValues,
            ...userProfileValues,
            campaign: '1234',
            workingRight: CandidateYesNoNSPP.YES,
            materialInsecurity: CandidateYesNo.YES,
            networkInsecurity: CandidateYesNo.NO,
            program: Programs.THREE_SIXTY,
            birthDate: '1996-24-04',
            occupations: [{ name: 'développeur' }] as Occupation[],
          };

          const response: APIResponse<
            UsersCreationController['createUserRefering']
          > = await request(server)
            .post(`${route}/refering`)
            .set('authorization', `Bearer ${loggedInReferer.token}`)
            .send(userToSend);
          expect(response.status).toBe(400);
        });

        it('Should return 403 when a candidate referer another valid candidate', async () => {
          const user = await userFactory.create(
            { role: UserRoles.CANDIDATE },
            {},
            false
          );

          const helpNeeds: { name: HelpValue }[] = [
            { name: 'cv' },
            { name: 'interview' },
          ];

          const userValues = {
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            phone: user.phone,
            gender: user.gender,
          };

          const userProfileValues = {
            helpNeeds: helpNeeds,
            department: 'Paris (75)' as Department,
          };

          const userToSend = {
            ...userValues,
            ...userProfileValues,
            campaign: '1234',
            workingRight: CandidateYesNoNSPP.YES,
            materialInsecurity: CandidateYesNo.YES,
            networkInsecurity: CandidateYesNo.NO,
            program: Programs.THREE_SIXTY,
            birthDate: '1996-24-04',
            businessSectors: [{ name: 'id' }] as BusinessSector[],
            occupations: [{ name: 'développeur' }] as Occupation[],
          };

          const response: APIResponse<
            UsersCreationController['createUserRefering']
          > = await request(server)
            .post(`${route}/refering`)
            .set('authorization', `Bearer ${loggedInCandidate.token}`)
            .send(userToSend);
          expect(response.status).toBe(403);
        });

        it('Should return 403 when a candidate referer another valid coach', async () => {
          const user = await userFactory.create(
            { role: UserRoles.CANDIDATE },
            {},
            false
          );

          const helpNeeds: { name: HelpValue }[] = [
            { name: 'cv' },
            { name: 'interview' },
          ];

          const userValues = {
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            phone: user.phone,
            gender: user.gender,
          };

          const userProfileValues = {
            helpNeeds: helpNeeds,
            department: 'Paris (75)' as Department,
          };

          const userToSend = {
            ...userValues,
            ...userProfileValues,
            campaign: '1234',
            workingRight: CandidateYesNoNSPP.YES,
            materialInsecurity: CandidateYesNo.YES,
            networkInsecurity: CandidateYesNo.NO,
            program: Programs.THREE_SIXTY,
            birthDate: '1996-24-04',
            businessSectors: [{ name: 'id' }] as BusinessSector[],
            occupations: [{ name: 'développeur' }] as Occupation[],
          };

          const response: APIResponse<
            UsersCreationController['createUserRefering']
          > = await request(server)
            .post(`${route}/refering`)
            .set('authorization', `Bearer ${loggedInCoach.token}`)
            .send(userToSend);
          expect(response.status).toBe(403);
        });

        it('Should return 409 when the email already exist', async () => {
          const existingUser = await userFactory.create({}, {}, true);

          const user = await userFactory.create(
            {
              role: UserRoles.CANDIDATE,
              email: existingUser.email,
            },
            {},
            false
          );

          const helpNeeds: { name: HelpValue }[] = [
            { name: 'cv' },
            { name: 'interview' },
          ];

          const userToSend = {
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            phone: user.phone,
            gender: user.gender,
            helpNeeds: helpNeeds,
            department: 'Paris (75)' as Department,
            campaign: '1234',
            workingRight: CandidateYesNoNSPP.YES,
            materialInsecurity: CandidateYesNo.YES,
            networkInsecurity: CandidateYesNo.NO,
            program: Programs.THREE_SIXTY,
            birthDate: '1996-24-04',
            businessSectors: [{ name: 'id' }] as BusinessSector[],
            occupations: [{ name: 'développeur' }] as Occupation[],
          };

          const response: APIResponse<
            UsersCreationController['createUserRefering']
          > = await request(server)
            .post(`${route}/refering`)
            .set('authorization', `Bearer ${loggedInReferer.token}`)
            .send(userToSend);
          expect(response.status).toBe(409);
        });
      });
    });
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
            whatsappZoneCoachName: loggedInCandidate.user.whatsappZoneCoachName,
            whatsappZoneCoachUrl: loggedInCandidate.user.whatsappZoneCoachUrl,
            whatsappZoneCoachQR: loggedInCandidate.user.whatsappZoneCoachQR,
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
          it('Should return 200, and all the candidates that matches the hidden filter', async () => {
            const hiddenCandidates = await databaseHelper.createEntities(
              userFactory,
              2,
              {
                role: UserRoles.CANDIDATE,
              },
              {
                userCandidat: {
                  hidden: true,
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
                  hidden: false,
                },
              }
            );

            const response: APIResponse<UsersController['findMembers']> =
              await request(server)
                .get(
                  `${route}/members?limit=50&offset=0&role[]=${UserRoles.CANDIDATE}&hidden[]=true`
                )
                .set('authorization', `Bearer ${loggedInAdmin.token}`);
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
                  `${route}/members?limit=50&offset=0&role[]=${UserRoles.CANDIDATE}&role[]=${UserRoles.CANDIDATE}&hidden[]=false&employed[]=false&query=XXX&zone[]=${AdminZones.LYON}&businessSectors[]=rh&associatedUser[]=true`
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
      });
    });
    describe('R - Read 1 Profile', () => {
      describe('/profile/:userId - Get user profile', () => {
        let loggedInUser: LoggedUser;
        let randomUser: User;
        beforeEach(async () => {
          loggedInUser = await usersHelper.createLoggedInUser();
          randomUser = await userFactory.create(
            {},
            {
              userProfile: {
                department: 'Paris (75)',
                businessSectors: [{ name: 'id' }] as BusinessSector[],
                occupations: [{ name: 'développeur' }] as Occupation[],
                helpNeeds: [{ name: 'network' }] as HelpNeed[],
                helpOffers: [{ name: 'network' }] as HelpOffer[],
              },
            }
          );
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
              userProfilesHelper.mapUserProfileFromUser(randomUser)
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
              ...userProfilesHelper.mapUserProfileFromUser(randomUser),
              lastReceivedMessage:
                internalMessageReceived.createdAt.toISOString(),
              lastSentMessage: internalMessageSent.createdAt.toISOString(),
            })
          );
        });
      });
      describe('/profile/recommendations/:userId - Get user recommendations', () => {
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
            .get(
              `${route}/profile/recommendations/${loggedInCandidate.user.id}`
            )
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
            .get(
              `${route}/profile/recommendations/${loggedInCandidate.user.id}`
            )
            .set('authorization', `Bearer ${loggedInCoach.token}`);
          expect(response.status).toBe(403);
        });
        it('Should return 403, if referer gets recommendations for another user', async () => {
          const response: APIResponse<
            UserProfilesController['findRecommendationsByUserId']
          > = await request(server)
            .get(
              `${route}/profile/recommendations/${loggedInCandidate.user.id}`
            )
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
                businessSectors: [{ name: 'bat' }] as BusinessSector[],
                helpOffers: [{ name: 'interview' }] as HelpOffer[],
                lastRecommendationsDate: moment().subtract(2, 'day').toDate(),
              },
            }
          );

          const usersToRecommend = (
            await databaseHelper.createEntities(
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
                  occupations: [{ name: 'peintre' }] as Occupation[],
                  businessSectors: [{ name: 'bat' }] as BusinessSector[],
                  helpNeeds: [{ name: 'interview' }] as HelpNeed[],
                },
              }
            )
          ).sort((userA, userB) =>
            moment(userB.createdAt).diff(userA.createdAt)
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
                businessSectors: [{ name: 'bat' }] as BusinessSector[],
                helpOffers: [{ name: 'interview' }] as HelpOffer[],
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
                occupations: [{ name: 'peintre' }] as Occupation[],
                businessSectors: [{ name: 'bat' }] as BusinessSector[],
                helpNeeds: [{ name: 'interview' }] as HelpNeed[],
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
                occupations: [{ name: 'peintre' }] as Occupation[],
                businessSectors: [{ name: 'bat' }] as BusinessSector[],
                helpNeeds: [{ name: 'interview' }] as HelpNeed[],
              },
            }
          );

          const oldRecommendedUsers = [
            ...stillAvailableUsers,
            userNotAvailable,
          ].sort((userA, userB) =>
            moment(userB.createdAt).diff(userA.createdAt)
          );

          const userAvailable = await userFactory.create(
            {
              role: UserRoles.CANDIDATE,
              zone: AdminZones.LYON,
            },
            {
              userProfile: {
                department: 'Rhône (69)',
                isAvailable: true,
                occupations: [{ name: 'peintre' }] as Occupation[],
                businessSectors: [{ name: 'bat' }] as BusinessSector[],
                helpNeeds: [{ name: 'interview' }] as HelpNeed[],
              },
            }
          );

          const usersToRecommend = [...stillAvailableUsers, userAvailable].sort(
            (userA, userB) => moment(userB.createdAt).diff(userA.createdAt)
          );

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
                businessSectors: [
                  { name: 'id' },
                  { name: 'aa' },
                  { name: 'art' },
                ] as BusinessSector[],
                helpOffers: [
                  { name: 'network' },
                  { name: 'tips' },
                  { name: 'event' },
                ] as HelpOffer[],
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
                department: 'Aisne (02)',
                isAvailable: true,
                occupations: [{ name: 'Développeur' }] as Occupation[],
                businessSectors: [
                  { name: 'id' },
                  { name: 'aa' },
                  { name: 'art' },
                ] as BusinessSector[],
                helpNeeds: [
                  { name: 'network' },
                  { name: 'tips' },
                  { name: 'event' },
                ] as HelpNeed[],
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
                occupations: [{ name: 'Développeur' }] as Occupation[],
                businessSectors: [
                  { name: 'id' },
                  { name: 'aa' },
                  { name: 'cd' },
                ] as BusinessSector[],
                helpNeeds: [
                  { name: 'network' },
                  { name: 'tips' },
                  { name: 'event' },
                ] as HelpNeed[],
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
                occupations: [{ name: 'Développeur' }] as Occupation[],
                businessSectors: [
                  { name: 'id' },
                  { name: 'aa' },
                  { name: 'art' },
                ] as BusinessSector[],
                helpNeeds: [
                  { name: 'network' },
                  { name: 'tips' },
                  { name: 'cv' },
                ] as HelpNeed[],
              },
            }
          );

          const newUsersToRecommend = [
            candidateSameRegion,
            candidate2BusinessSectorsInCommon,
            candidate2HelpsInCommon,
          ].sort((userA, userB) =>
            moment(userB.createdAt).diff(userA.createdAt)
          );

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
                occupations: [{ name: 'Développeur' }] as Occupation[],
                businessSectors: [
                  { name: 'id' },
                  { name: 'aa' },
                  { name: 'art' },
                ] as BusinessSector[],
                helpNeeds: [
                  { name: 'network' },
                  { name: 'tips' },
                  { name: 'event' },
                ] as HelpNeed[],
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
                occupations: [{ name: 'Développeur' }] as Occupation[],
                businessSectors: [
                  { name: 'id' },
                  { name: 'aa' },
                  { name: 'art' },
                ] as BusinessSector[],
                helpNeeds: [
                  { name: 'interview' },
                  { name: 'cv' },
                ] as HelpNeed[],
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
                occupations: [{ name: 'Développeur' }] as Occupation[],
                businessSectors: [
                  { name: 'id' },
                  { name: 'aa' },
                  { name: 'art' },
                ] as BusinessSector[],
                helpNeeds: [
                  { name: 'network' },
                  { name: 'interview' },
                  { name: 'cv' },
                ] as HelpNeed[],
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
                occupations: [{ name: 'Développeur' }] as Occupation[],
                businessSectors: [
                  { name: 'aa' },
                  { name: 'aev' },
                  { name: 'asp' },
                ] as BusinessSector[],
                helpNeeds: [
                  { name: 'network' },
                  { name: 'tips' },
                  { name: 'event' },
                ] as HelpNeed[],
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
                occupations: [{ name: 'Développeur' }] as Occupation[],
                businessSectors: [
                  { name: 'id' },
                  { name: 'aev' },
                  { name: 'asp' },
                ] as BusinessSector[],
                helpNeeds: [
                  { name: 'network' },
                  { name: 'tips' },
                  { name: 'event' },
                ] as HelpNeed[],
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
                occupations: [{ name: 'Développeur' }] as Occupation[],
                businessSectors: [
                  { name: 'id' },
                  { name: 'aa' },
                  { name: 'art' },
                ] as BusinessSector[],
                helpNeeds: [
                  { name: 'network' },
                  { name: 'tips' },
                  { name: 'event' },
                ] as HelpNeed[],
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
                businessSectors: [
                  { name: 'id' },
                  { name: 'aa' },
                  { name: 'art' },
                ] as BusinessSector[],
                helpOffers: [
                  { name: 'network' },
                  { name: 'tips' },
                  { name: 'event' },
                ] as HelpOffer[],
              },
            }
          );

          // Candidate who sent message
          const sentMessageCandidate = await userFactory.create(
            {
              role: UserRoles.CANDIDATE,
              zone: AdminZones.LILLE,
            },
            {
              userProfile: {
                department: 'Nord (59)',
                isAvailable: true,
                occupations: [{ name: 'Développeur' }] as Occupation[],
                businessSectors: [
                  { name: 'id' },
                  { name: 'aa' },
                  { name: 'art' },
                ] as BusinessSector[],
                helpNeeds: [
                  { name: 'network' },
                  { name: 'tips' },
                  { name: 'event' },
                ] as HelpNeed[],
              },
            }
          );

          await internalMessageFactory.create({
            senderUserId: sentMessageCandidate.id,
            addresseeUserId: loggedInCoach.user.id,
          });

          // Candidate who received message
          const receivedMessageCandidate = await userFactory.create(
            {
              role: UserRoles.CANDIDATE,
              zone: AdminZones.LILLE,
            },
            {
              userProfile: {
                department: 'Nord (59)',
                isAvailable: true,
                occupations: [{ name: 'Développeur' }] as Occupation[],
                businessSectors: [
                  { name: 'id' },
                  { name: 'aa' },
                  { name: 'art' },
                ] as BusinessSector[],
                helpNeeds: [
                  { name: 'network' },
                  { name: 'tips' },
                  { name: 'event' },
                ] as HelpNeed[],
              },
            }
          );

          await internalMessageFactory.create({
            senderUserId: loggedInCoach.user.id,
            addresseeUserId: receivedMessageCandidate.id,
          });

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
                  occupations: [{ name: 'Développeur' }] as Occupation[],
                  businessSectors: [
                    { name: 'id' },
                    { name: 'aa' },
                    { name: 'cm' },
                  ] as BusinessSector[],
                  helpNeeds: [
                    { name: 'network' },
                    { name: 'tips' },
                    { name: 'interview' },
                  ] as HelpNeed[],
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
                businessSectors: [{ name: 'bat' }] as BusinessSector[],
                occupations: [{ name: 'menuisier' }] as Occupation[],
                helpNeeds: [{ name: 'interview' }] as HelpNeed[],
                lastRecommendationsDate: moment().subtract(2, 'day').toDate(),
              },
            }
          );

          const usersToRecommend = (
            await databaseHelper.createEntities(
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
                  businessSectors: [{ name: 'bat' }] as BusinessSector[],
                  helpOffers: [{ name: 'interview' }] as HelpOffer[],
                },
              }
            )
          ).sort((userA, userB) =>
            moment(userB.createdAt).diff(userA.createdAt)
          );

          await userProfilesHelper.createUserProfileRecommendations(
            loggedInCandidate.user.id,
            usersToRecommend.map(({ id }) => id)
          );

          const response: APIResponse<
            UserProfilesController['findRecommendationsByUserId']
          > = await request(server)
            .get(
              `${route}/profile/recommendations/${loggedInCandidate.user.id}`
            )
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
                businessSectors: [{ name: 'bat' }] as BusinessSector[],
                occupations: [{ name: 'menuisier' }] as Occupation[],
                helpNeeds: [{ name: 'interview' }] as HelpNeed[],
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
                businessSectors: [{ name: 'bat' }] as BusinessSector[],
                helpOffers: [{ name: 'interview' }] as HelpOffer[],
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
                businessSectors: [{ name: 'bat' }] as BusinessSector[],
                helpOffers: [{ name: 'interview' }] as HelpOffer[],
              },
            }
          );

          const oldRecommendedUsers = [
            ...stillAvailableUsers,
            userNotAvailable,
          ].sort((userA, userB) =>
            moment(userB.createdAt).diff(userA.createdAt)
          );

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
                businessSectors: [{ name: 'bat' }] as BusinessSector[],
                helpOffers: [{ name: 'interview' }] as HelpOffer[],
              },
            }
          );

          const usersToRecommend = [...stillAvailableUsers, userAvailable].sort(
            (userA, userB) => moment(userB.createdAt).diff(userA.createdAt)
          );

          const response: APIResponse<
            UserProfilesController['findRecommendationsByUserId']
          > = await request(server)
            .get(
              `${route}/profile/recommendations/${loggedInCandidate.user.id}`
            )
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
              role: UserRoles.CANDIDATE,
              zone: AdminZones.LILLE,
            },
            {
              userProfile: {
                department: 'Nord (59)',
                isAvailable: true,
                occupations: [{ name: 'Développeur' }] as Occupation[],
                businessSectors: [
                  { name: 'id' },
                  { name: 'aa' },
                  { name: 'art' },
                ] as BusinessSector[],
                helpNeeds: [
                  { name: 'network' },
                  { name: 'tips' },
                  { name: 'event' },
                ] as HelpNeed[],
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
                department: 'Aisne (02)',
                isAvailable: true,
                currentJob: 'Développeur',
                businessSectors: [
                  { name: 'id' },
                  { name: 'aa' },
                  { name: 'art' },
                ] as BusinessSector[],
                helpOffers: [
                  { name: 'network' },
                  { name: 'tips' },
                  { name: 'event' },
                ] as HelpOffer[],
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
                businessSectors: [
                  { name: 'id' },
                  { name: 'aa' },
                  { name: 'cd' },
                ] as BusinessSector[],
                helpOffers: [
                  { name: 'network' },
                  { name: 'tips' },
                  { name: 'event' },
                ] as HelpOffer[],
              },
            }
          );

          const coach2HelpsInCommon = await userFactory.create(
            {
              role: UserRoles.COACH,
              zone: AdminZones.LILLE,
            },
            {
              userProfile: {
                department: 'Nord (59)',
                isAvailable: true,
                currentJob: 'Développeur',
                businessSectors: [
                  { name: 'id' },
                  { name: 'aa' },
                  { name: 'art' },
                ] as BusinessSector[],
                helpOffers: [
                  { name: 'network' },
                  { name: 'tips' },
                  { name: 'cv' },
                ] as HelpOffer[],
              },
            }
          );

          const newUsersToRecommend = [
            coachSameRegion,
            coach2BusinessSectorsInCommon,
            coach2HelpsInCommon,
          ].sort((userA, userB) =>
            moment(userB.createdAt).diff(userA.createdAt)
          );

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
                businessSectors: [
                  { name: 'id' },
                  { name: 'aa' },
                  { name: 'art' },
                ] as BusinessSector[],
                helpOffers: [
                  { name: 'network' },
                  { name: 'tips' },
                  { name: 'event' },
                ] as HelpOffer[],
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
                businessSectors: [
                  { name: 'id' },
                  { name: 'aa' },
                  { name: 'art' },
                ] as BusinessSector[],
                helpOffers: [
                  { name: 'interview' },
                  { name: 'cv' },
                ] as HelpOffer[],
              },
            }
          );

          // Coach 1 help in common
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
                businessSectors: [
                  { name: 'id' },
                  { name: 'aa' },
                  { name: 'art' },
                ] as BusinessSector[],
                helpOffers: [
                  { name: 'network' },
                  { name: 'interview' },
                  { name: 'cv' },
                ] as HelpOffer[],
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
                businessSectors: [
                  { name: 'aa' },
                  { name: 'aev' },
                  { name: 'asp' },
                ] as BusinessSector[],
                helpOffers: [
                  { name: 'network' },
                  { name: 'tips' },
                  { name: 'event' },
                ] as HelpOffer[],
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
                businessSectors: [
                  { name: 'id' },
                  { name: 'aev' },
                  { name: 'asp' },
                ] as BusinessSector[],
                helpOffers: [
                  { name: 'network' },
                  { name: 'tips' },
                  { name: 'event' },
                ] as HelpOffer[],
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
                businessSectors: [
                  { name: 'id' },
                  { name: 'aa' },
                  { name: 'art' },
                ] as BusinessSector[],
                helpOffers: [
                  { name: 'network' },
                  { name: 'tips' },
                  { name: 'event' },
                ] as HelpOffer[],
              },
            }
          );

          // Candidate same profile
          await userFactory.create(
            {
              role: UserRoles.CANDIDATE,
              zone: AdminZones.LILLE,
            },
            {
              userProfile: {
                department: 'Nord (59)',
                isAvailable: true,
                occupations: [{ name: 'Développeur' }] as Occupation[],
                businessSectors: [
                  { name: 'id' },
                  { name: 'aa' },
                  { name: 'art' },
                ] as BusinessSector[],
                helpNeeds: [
                  { name: 'network' },
                  { name: 'tips' },
                  { name: 'event' },
                ] as HelpNeed[],
              },
            }
          );

          // Coach who sent message
          const sentMessageCoach = await userFactory.create(
            {
              role: UserRoles.COACH,
              zone: AdminZones.LILLE,
            },
            {
              userProfile: {
                department: 'Nord (59)',
                isAvailable: true,
                currentJob: 'Développeur',
                businessSectors: [
                  { name: 'id' },
                  { name: 'aa' },
                  { name: 'art' },
                ] as BusinessSector[],
                helpOffers: [
                  { name: 'network' },
                  { name: 'tips' },
                  { name: 'event' },
                ] as HelpOffer[],
              },
            }
          );

          await internalMessageFactory.create({
            senderUserId: sentMessageCoach.id,
            addresseeUserId: loggedInCandidate.user.id,
          });

          // Coach who received message
          const receivedMessageCoach = await userFactory.create(
            {
              role: UserRoles.COACH,
              zone: AdminZones.LILLE,
            },
            {
              userProfile: {
                department: 'Nord (59)',
                isAvailable: true,
                currentJob: 'Développeur',
                businessSectors: [
                  { name: 'id' },
                  { name: 'aa' },
                  { name: 'art' },
                ] as BusinessSector[],
                helpOffers: [
                  { name: 'network' },
                  { name: 'tips' },
                  { name: 'event' },
                ] as HelpOffer[],
              },
            }
          );

          await internalMessageFactory.create({
            senderUserId: loggedInCandidate.user.id,
            addresseeUserId: receivedMessageCoach.id,
          });

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
                  businessSectors: [
                    { name: 'id' },
                    { name: 'aa' },
                    { name: 'cm' },
                  ] as BusinessSector[],
                  helpOffers: [
                    { name: 'network' },
                    { name: 'tips' },
                    { name: 'interview' },
                  ] as HelpOffer[],
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
            .get(
              `${route}/profile/recommendations/${loggedInCandidate.user.id}`
            )
            .set('authorization', `Bearer ${loggedInCandidate.token}`);
          expect(response.status).toBe(200);
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
    describe('R - Read many Profiles', () => {
      describe('/profile', () => {
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

            const userProfileCandidate: Partial<UserProfile> = {
              businessSectors: [{ name: 'bat' }] as BusinessSector[],
              occupations: [{ name: 'menuisier' }] as Occupation[],
              helpNeeds: [{ name: 'interview' }] as HelpNeed[],
              description: 'hello',
              department: 'Paris (75)',
            };
            const userProfileCoach: Partial<UserProfile> = {
              currentJob: 'peintre',
              businessSectors: [{ name: 'bat' }] as BusinessSector[],
              helpOffers: [{ name: 'interview' }] as HelpOffer[],
              description: 'hello',
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
                  `${route}/profile?limit=50&offset=0&role[]=${UserRoles.CANDIDATE}&departments[]=Rhône (69)&departments[]=Paris (75)`
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
                  `${route}/profile?limit=50&offset=0&role[]=${UserRoles.COACH}&departments[]=Rhône (69)&departments[]=Paris (75)`
                )
                .set('authorization', `Bearer ${loggedInAdmin.token}`);
            expect(response.status).toBe(200);
            expect(response.body.length).toBe(4);
            expect(expectedCoachesIds).toEqual(
              expect.arrayContaining(response.body.map(({ id }) => id))
            );
          });

          it('Should return 200, and all the candidates that matches the businessSectors filters', async () => {
            const batCandidates = await databaseHelper.createEntities(
              userFactory,
              2,
              {
                role: UserRoles.CANDIDATE,
              },
              {
                userProfile: {
                  businessSectors: [
                    { name: 'bat' },
                    { name: 'asp' },
                  ] as BusinessSector[],
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
                  businessSectors: [
                    { name: 'rh' },
                    { name: 'aa' },
                  ] as BusinessSector[],
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
                  businessSectors: [
                    { name: 'aa' },
                    { name: 'pr' },
                  ] as BusinessSector[],
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
                  businessSectors: [
                    { name: 'bat' },
                    { name: 'asp' },
                  ] as BusinessSector[],
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
                  businessSectors: [
                    { name: 'rh' },
                    { name: 'aa' },
                  ] as BusinessSector[],
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
                  businessSectors: [
                    { name: 'aa' },
                    { name: 'pr' },
                  ] as BusinessSector[],
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
                  `${route}/profile?limit=50&offset=0&role[]=${UserRoles.CANDIDATE}&businessSectors[]=bat&businessSectors[]=rh`
                )
                .set('authorization', `Bearer ${loggedInAdmin.token}`);
            expect(response.status).toBe(200);
            expect(response.body.length).toBe(4);
            expect(expectedCandidatesIds).toEqual(
              expect.arrayContaining(response.body.map(({ id }) => id))
            );
          });
          it('Should return 200, and all the coaches that matches the businessSectors filters', async () => {
            await databaseHelper.createEntities(
              userFactory,
              2,
              {
                role: UserRoles.CANDIDATE,
              },
              {
                userProfile: {
                  businessSectors: [
                    { name: 'bat' },
                    { name: 'asp' },
                  ] as BusinessSector[],
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
                  businessSectors: [
                    { name: 'rh' },
                    { name: 'aa' },
                  ] as BusinessSector[],
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
                  businessSectors: [
                    { name: 'aa' },
                    { name: 'pr' },
                  ] as BusinessSector[],
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
                  businessSectors: [
                    { name: 'bat' },
                    { name: 'asp' },
                  ] as BusinessSector[],
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
                  businessSectors: [
                    { name: 'rh' },
                    { name: 'aa' },
                  ] as BusinessSector[],
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
                  businessSectors: [
                    { name: 'aa' },
                    { name: 'pr' },
                  ] as BusinessSector[],
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
                  `${route}/profile?limit=50&offset=0&role[]=${UserRoles.COACH}&businessSectors[]=bat&businessSectors[]=rh`
                )
                .set('authorization', `Bearer ${loggedInAdmin.token}`);
            expect(response.status).toBe(200);
            expect(response.body.length).toBe(4);
            expect(expectedCoachesIds).toEqual(
              expect.arrayContaining(response.body.map(({ id }) => id))
            );
          });

          it('Should return 200, and all the candidates that matches the helps filters', async () => {
            const cvCandidates = await databaseHelper.createEntities(
              userFactory,
              2,
              {
                role: UserRoles.CANDIDATE,
              },
              {
                userProfile: {
                  helpNeeds: [
                    { name: 'cv' },
                    { name: 'network' },
                  ] as HelpNeed[],
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
                  helpNeeds: [
                    { name: 'interview' },
                    { name: 'event' },
                  ] as HelpNeed[],
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
                  helpNeeds: [{ name: 'tips' }] as HelpNeed[],
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
                  helpOffers: [
                    { name: 'cv' },
                    { name: 'network' },
                  ] as HelpOffer[],
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
                  helpOffers: [
                    { name: 'interview' },
                    { name: 'event' },
                  ] as HelpOffer[],
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
                  helpOffers: [{ name: 'tips' }] as HelpOffer[],
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
                  `${route}/profile?limit=50&offset=0&role[]=${UserRoles.CANDIDATE}&helps[]=cv&helps[]=interview`
                )
                .set('authorization', `Bearer ${loggedInAdmin.token}`);
            expect(response.status).toBe(200);
            expect(response.body.length).toBe(4);
            expect(expectedCandidatesIds).toEqual(
              expect.arrayContaining(response.body.map(({ id }) => id))
            );
          });
          it('Should return 200, and all the coaches that matches the helps filters', async () => {
            await databaseHelper.createEntities(
              userFactory,
              2,
              {
                role: UserRoles.CANDIDATE,
              },
              {
                userProfile: {
                  helpNeeds: [
                    { name: 'cv' },
                    { name: 'network' },
                  ] as HelpNeed[],
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
                  helpNeeds: [
                    { name: 'interview' },
                    { name: 'event' },
                  ] as HelpNeed[],
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
                  helpNeeds: [{ name: 'tips' }] as HelpNeed[],
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
                  helpOffers: [
                    { name: 'cv' },
                    { name: 'network' },
                  ] as HelpOffer[],
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
                  helpOffers: [
                    { name: 'interview' },
                    { name: 'event' },
                  ] as HelpOffer[],
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
                  helpOffers: [{ name: 'tips' }] as HelpOffer[],
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
                  `${route}/profile?limit=50&offset=0&role[]=${UserRoles.COACH}&helps[]=cv&helps[]=interview`
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
                  businessSectors: [
                    { name: 'rh' },
                    { name: 'aa' },
                  ] as BusinessSector[],

                  helpOffers: [
                    { name: 'cv' },
                    { name: 'network' },
                  ] as HelpOffer[],
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
                    businessSectors: [
                      { name: 'rh' },
                      { name: 'aa' },
                    ] as BusinessSector[],
                    helpNeeds: [
                      { name: 'cv' },
                      { name: 'network' },
                    ] as HelpNeed[],
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
                  `${route}/profile?limit=50&offset=0&role[]=${UserRoles.CANDIDATE}&query=XXX&departments[]=Rhône (69)&businessSectors[]=rh&helps[]=network`
                )
                .set('authorization', `Bearer ${loggedInAdmin.token}`);
            expect(response.status).toBe(200);
            expect(response.body.length).toBe(2);
            expect(expectedCandidatesIds).toEqual(
              expect.arrayContaining(response.body.map(({ id }) => id))
            );
          });
          it('Should return 200, and all the coaches that match all the filters', async () => {
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
                  businessSectors: [
                    { name: 'rh' },
                    { name: 'aa' },
                  ] as BusinessSector[],

                  helpOffers: [
                    { name: 'cv' },
                    { name: 'network' },
                  ] as HelpOffer[],
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
                    businessSectors: [
                      { name: 'rh' },
                      { name: 'aa' },
                    ] as BusinessSector[],
                    helpNeeds: [
                      { name: 'cv' },
                      { name: 'network' },
                    ] as HelpNeed[],
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
                  `${route}/profile?limit=50&offset=0&role[]=${UserRoles.COACH}&query=XXX&departments[]=Rhône (69)&businessSectors[]=rh&helps[]=network`
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

      describe('/profile/refered', () => {
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
            whatsappZoneCoachName,
            whatsappZoneCoachUrl,
            whatsappZoneCoachQR,
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
            whatsappZoneCoachName: coachWhatsappZoneCoachName,
            whatsappZoneCoachUrl: coachWhatsappZoneCoachUrl,
            whatsappZoneCoachQR: coachWhatsappZoneCoachQR,
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
            whatsappZoneCoachName,
            whatsappZoneCoachUrl,
            whatsappZoneCoachQR,
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
            whatsappZoneCoachName: coachWhatsappZoneCoachName,
            whatsappZoneCoachUrl: coachWhatsappZoneCoachUrl,
            whatsappZoneCoachQR: coachWhatsappZoneCoachQR,
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
            whatsappZoneCoachName,
            whatsappZoneCoachUrl,
            whatsappZoneCoachQR,
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
    describe('U - Update 1 Profile', () => {
      describe('/profile/:userId - Update user profile', () => {
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
                businessSectors: [{ name: 'bat' }] as BusinessSector[],
                occupations: [{ name: 'menuisier' }] as Occupation[],
                helpNeeds: [{ name: 'interview' }] as HelpNeed[],
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
                businessSectors: [{ name: 'bat' }] as BusinessSector[],
                helpOffers: [{ name: 'interview' }] as HelpOffer[],
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
              isAvailable: false,
              department: 'Paris (75)',
            });
          expect(response.status).toBe(403);
        });
        it('Should return 200, if candidate updates his profile candidate properties', async () => {
          const updatedProfile: Partial<UserProfile> = {
            description: 'hello',
            department: 'Paris (75)',
            isAvailable: false,
            businessSectors: [{ name: 'id' }] as BusinessSector[],
            occupations: [{ name: 'développeur' }] as Occupation[],
            helpNeeds: [{ name: 'network' }] as HelpNeed[],
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

          expect(response.status).toBe(200);
          expect(response.body).toEqual(
            expect.objectContaining({
              ...updatedProfile,
              businessSectors: [expect.objectContaining({ name: 'id' })],
              occupations: [expect.objectContaining({ name: 'développeur' })],
              helpNeeds: [expect.objectContaining({ name: 'network' })],
            })
          );
          expect(updatedUser.zone).toMatch(AdminZones.PARIS);
        });
        it('Should return 400, if linkedinUrl does not match the regex pattern', async () => {
          const updatedProfile: Partial<UserProfile> = {
            description: 'hello',
            department: 'Paris (75)',
            isAvailable: false,
            businessSectors: [{ name: 'id' }] as BusinessSector[],
            occupations: [{ name: 'développeur' }] as Occupation[],
            helpNeeds: [{ name: 'network' }] as HelpNeed[],
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
            currentJob: 'mécanicien',
            department: 'Paris (75)',
            isAvailable: false,
            businessSectors: [{ name: 'id' }] as BusinessSector[],
            helpOffers: [{ name: 'network' }] as HelpOffer[],
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
          const updatedProfile: Partial<UserProfile> = {
            description: 'hello',
            currentJob: 'mécanicien',
            department: 'Paris (75)',
            isAvailable: false,
            businessSectors: [{ name: 'id' }] as BusinessSector[],
            helpOffers: [{ name: 'network' }] as HelpOffer[],
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
              businessSectors: [expect.objectContaining({ name: 'id' })],
              helpOffers: [expect.objectContaining({ name: 'network' })],
            })
          );

          expect(updatedUser.zone).toMatch(AdminZones.PARIS);
        });
        it('Should return 403, if referer updates his profile referer properties', async () => {
          const updatedProfile: Partial<UserProfile> = {
            description: 'hello',
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
        it('Should return 400, if coach updates his profile with candidate properties', async () => {
          const updatedProfile: Partial<UserProfile> = {
            description: 'hello',
            department: 'Paris (75)',
            isAvailable: false,
            occupations: [{ name: 'développeur' }] as Occupation[],
            businessSectors: [{ name: 'id' }] as BusinessSector[],
            helpNeeds: [{ name: 'network' }] as HelpNeed[],
          };

          const response: APIResponse<
            UserProfilesController['updateByUserId']
          > = await request(server)
            .put(`${route}/profile/${loggedInCoach.user.id}`)
            .set('authorization', `Bearer ${loggedInCoach.token}`)
            .send(updatedProfile);
          expect(response.status).toBe(400);
        });
      });
      describe('/profile/uploadImage/:id - Upload user profile picture', () => {
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
    // TODO put in unit tests
    describe('D - Delete 1 User', () => {
      describe('/:id - Delete user and all associated dto', () => {
        let loggedInAdmin: LoggedUser;
        let loggedInCoach: LoggedUser;
        let loggedInReferer: LoggedUser;
        let candidate: User;
        let coach: User;
        let referer: User;
        const uniqIdToFind = uuid();

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

          referer = await userFactory.create({
            role: UserRoles.REFERER,
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

          loggedInReferer = await usersHelper.createLoggedInUser({
            role: UserRoles.REFERER,
          });
        });
        it('Should return 403 if logged as coach', async () => {
          const response: APIResponse<UsersDeletionController['removeUser']> =
            await request(server)
              .delete(`${route}/${candidate.id}`)
              .set('authorization', `Bearer ${loggedInCoach.token}`);
          expect(response.status).toBe(403);
        });

        it('Should return 403 if logged as referer', async () => {
          const response: APIResponse<UsersDeletionController['removeUser']> =
            await request(server)
              .delete(`${route}/${candidate.id}`)
              .set('authorization', `Bearer ${loggedInReferer.token}`);
          expect(response.status).toBe(403);
        });
        it('Should return 200 if logged in as admin and deletes candidate', async () => {
          const response: APIResponse<UsersDeletionController['removeUser']> =
            await request(server)
              .delete(`${route}/${candidate.id}`)
              .set('authorization', `Bearer ${loggedInAdmin.token}`);

          expect(response.status).toBe(200);
          expect(response.body.userDeleted).toBe(1);

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

          const userProfile = await userProfilesHelper.findOneProfileByUserId(
            candidate.id
          );
          expect(userProfile).toBeFalsy();

          const expSkillsCount = await skillsHelper.countSkillsByName(
            uniqIdToFind
          );
          expect(expSkillsCount).toBe(1);
        });
        it('Should return 200 if logged in as admin and deletes coach', async () => {
          const response: APIResponse<UsersDeletionController['removeUser']> =
            await request(server)
              .delete(`${route}/${coach.id}`)
              .set('authorization', `Bearer ${loggedInAdmin.token}`);

          expect(response.status).toBe(200);
          expect(response.body.userDeleted).toBe(1);

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

          const userProfile = await userProfilesHelper.findOneProfileByUserId(
            coach.id
          );
          expect(userProfile).toBeFalsy();
        });

        it('Should return 200 if logged in as admin and deletes referer', async () => {
          const response: APIResponse<UsersDeletionController['removeUser']> =
            await request(server)
              .delete(`${route}/${referer.id}`)
              .set('authorization', `Bearer ${loggedInAdmin.token}`);

          expect(response.status).toBe(200);
          expect(response.body.userDeleted).toBe(1);

          const user = await usersHelper.findUser(referer.id);
          expect(user).toBeFalsy();

          const userProfile = await userProfilesHelper.findOneProfileByUserId(
            referer.id
          );
          expect(userProfile).toBeFalsy();
        });
      });
    });
  });
});
