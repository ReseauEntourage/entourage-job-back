/* eslint-disable no-console */
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { QueueMocks, S3Mocks } from '../mocks.types';
import { LoggedUser } from 'src/auth/auth.types';
import { BusinessSector } from 'src/common/business-sectors/models';
import { Department } from 'src/common/locations/locations.types';
import { Nudge } from 'src/common/nudge/models';
import {
  CandidateYesNoNSPP,
  CandidateYesNo,
} from 'src/contacts/contacts.types';
import { S3Service } from 'src/external-services/aws/s3.service';
import { Organization } from 'src/organizations/models';
import { QueuesService } from 'src/queues/producers/queues.service';
import { UserRoles } from 'src/users/users.types';
import { UsersCreationController } from 'src/users-creation/users-creation.controller';
import { getZoneFromDepartment } from 'src/utils/misc';
import { APIResponse } from 'src/utils/types';
import { BusinessSectorHelper } from 'tests/business-sectors/business-sector.helper';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import { NudgesHelper } from 'tests/nudges/nudges.helper';
import { OrganizationFactory } from 'tests/organizations/organization.factory';
import { QueuesServiceMock } from 'tests/queues/queues.service.mock';
import { UserFactory } from 'tests/users/user.factory';
import { UsersHelper } from 'tests/users/users.helper';

describe('UserCreation', () => {
  let app: INestApplication;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let server: any;

  let databaseHelper: DatabaseHelper;
  let userFactory: UserFactory;
  let usersHelper: UsersHelper;
  let organizationFactory: OrganizationFactory;
  let businessSectorsHelper: BusinessSectorHelper;
  let nudgesHelper: NudgesHelper;

  let businessSector1: BusinessSector;
  let nudgeCv: Nudge;
  let nudgeTips: Nudge;
  let nudgeNetwork: Nudge;
  let nudgeInterview: Nudge;

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
    nudgesHelper = moduleFixture.get<NudgesHelper>(NudgesHelper);
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

    // Intialize the nudges
    await nudgesHelper.deleteAllNudges();
    await nudgesHelper.seedNudges();

    nudgeCv = await nudgesHelper.findOne({ value: 'cv' });
    nudgeTips = await nudgesHelper.findOne({ value: 'tips' });
    nudgeNetwork = await nudgesHelper.findOne({ value: 'network' });
    nudgeInterview = await nudgesHelper.findOne({ value: 'interview' });
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

  describe('POST /user - From admin', () => {
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
        whatsappZoneName,
        whatsappZoneUrl,
        whatsappZoneQR,
        company,
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
        whatsappZoneName,
        whatsappZoneUrl,
        whatsappZoneQR,
        company,
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
        whatsappZoneName,
        whatsappZoneUrl,
        whatsappZoneQR,
        userSocialSituation,
        company,
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
      it('Should return 200 and a created candidate', async () => {
        const {
          password,
          hashReset,
          salt,
          saltReset,
          revision,
          updatedAt,
          createdAt,
          lastConnection,
          whatsappZoneName,
          whatsappZoneUrl,
          whatsappZoneQR,
          company,
          ...candidate
        } = await userFactory.create({ role: UserRoles.CANDIDATE }, {}, false);
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

      it('Should return 200 and a created coach', async () => {
        const {
          password,
          hashReset,
          salt,
          saltReset,
          revision,
          updatedAt,
          createdAt,
          lastConnection,
          whatsappZoneName,
          whatsappZoneUrl,
          whatsappZoneQR,
          company,
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
          whatsappZoneName,
          whatsappZoneUrl,
          whatsappZoneQR,
          ...candidate
        } = await userFactory.create({ role: UserRoles.CANDIDATE }, {}, false);

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
          whatsappZoneName,
          whatsappZoneUrl,
          whatsappZoneQR,
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
  describe('POST /registration - Create user through registration', () => {
    it('Should return 200 and a created candidate if valid candidate data', async () => {
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
        nudges: [{ id: nudgeTips.id }, { id: nudgeNetwork.id }],
        department: 'Paris (75)' as Department,
      };

      const businessSector = await businessSectorsHelper.findOne({
        name: 'Sector 1',
      });

      const userToSend = {
        ...userValues,
        ...userProfileValues,
        password: user.password,
        campaign: '1234',
        workingRight: CandidateYesNoNSPP.YES,
        materialInsecurity: CandidateYesNo.YES,
        networkInsecurity: CandidateYesNo.NO,
        birthDate: '1996-24-04',
        sectorOccupations: [
          {
            businessSectorId: businessSector.id,
          },
        ],
      };

      const response: APIResponse<
        UsersCreationController['createUserRegistration']
      > = await request(server).post(`${route}/registration`).send(userToSend);
      expect(response.status).toBe(201);
      expect(response.body).toEqual(
        expect.objectContaining({
          ...userValues,
          zone: getZoneFromDepartment(userProfileValues.department),
          userProfile: expect.objectContaining({
            department: userProfileValues.department,
            nudges: expect.arrayContaining(
              userProfileValues.nudges.map((nudge) =>
                expect.objectContaining({
                  id: nudge.id,
                })
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
        birthDate: '1996-24-04',
        materialInsecurity: CandidateYesNo.YES,
        networkInsecurity: CandidateYesNo.NO,
      };

      const response: APIResponse<
        UsersCreationController['createUserRegistration']
      > = await request(server).post(`${route}/registration`).send(userToSend);
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
      > = await request(server).post(`${route}/registration`).send(userToSend);
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
        birthDate: '1996-24-04',
        materialInsecurity: CandidateYesNo.YES,
        networkInsecurity: CandidateYesNo.NO,
      };

      const response: APIResponse<
        UsersCreationController['createUserRegistration']
      > = await request(server).post(`${route}/registration`).send(userToSend);
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
      > = await request(server).post(`${route}/registration`).send(userToSend);
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
      > = await request(server).post(`${route}/registration`).send(userToSend);
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
      > = await request(server).post(`${route}/registration`).send(userToSend);
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
        birthDate: '1996-24-04',
      };

      const response: APIResponse<
        UsersCreationController['createUserRegistration']
      > = await request(server).post(`${route}/registration`).send(userToSend);
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
        birthDate: '1996-24-04',
      };

      const response: APIResponse<
        UsersCreationController['createUserRegistration']
      > = await request(server).post(`${route}/registration`).send(userToSend);
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
        materialInsecurity: CandidateYesNo.YES,
        networkInsecurity: CandidateYesNo.NO,
        birthDate: '1996-24-04',
      };

      const response: APIResponse<
        UsersCreationController['createUserRegistration']
      > = await request(server).post(`${route}/registration`).send(userToSend);
      expect(response.status).toBe(409);
    });
  });
  describe('POST /refering - Create user through refering', () => {
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

      const nudges = [nudgeCv, nudgeInterview];

      const userValues = {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        gender: user.gender,
      };

      const businessSector = await businessSectorsHelper.findOne({
        name: 'Sector 1',
      });

      const userProfileValues = {
        department: 'Paris (75)' as Department,
        nudges: nudges.map((nudge) => ({
          id: nudge.id,
        })),
        sectorOccupations: [
          {
            businessSectorId: businessSector.id,
            occupation: {
              name: 'Développeur',
            },
          },
        ],
      };

      const userToSend = {
        ...userValues,
        ...userProfileValues,
        campaign: '1234',
        workingRight: CandidateYesNoNSPP.YES,
        materialInsecurity: CandidateYesNo.YES,
        networkInsecurity: CandidateYesNo.NO,
        birthDate: '1996-24-04',
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
            nudges: expect.arrayContaining(
              userProfileValues.nudges.map((nudge) =>
                expect.objectContaining({
                  id: nudge.id,
                })
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

      const userValues = {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        gender: user.gender,
      };

      const businessSector = await businessSectorsHelper.findOne({
        name: 'Sector 1',
      });

      const userProfileValues = {
        nudges: [{ id: nudgeCv.id }],
        department: 'Paris (75)' as Department,
        sectorOccupations: [
          {
            businessSectorId: businessSector.id,
          },
        ],
      };

      const userToSend = {
        ...userValues,
        ...userProfileValues,
        workingRight: CandidateYesNoNSPP.YES,
        materialInsecurity: CandidateYesNo.YES,
        networkInsecurity: CandidateYesNo.NO,
        birthDate: '1996-24-04',
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
            nudges: expect.arrayContaining(
              userProfileValues.nudges.map((nudge) =>
                expect.objectContaining({
                  id: nudge.id,
                })
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

      // const helpNeeds: { name: HelpValue }[] = [];

      const userValues = {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
      };

      const userProfileValues = {
        // helpNeeds: helpNeeds,
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

      // const helpNeeds: { name: HelpValue }[] = [
      //   { name: 'cv' },
      //   { name: 'interview' },
      // ];

      const userValues = {
        firstName: user.firstName,
        lastName: user.lastName,
        email: 'email.fr', // This is the incorrect data
        phone: user.phone,
        gender: user.gender,
      };

      const userProfileValues = {
        // helpNeeds: helpNeeds,
        department: 'Paris (75)' as Department,
      };

      const userToSend = {
        ...userValues,
        ...userProfileValues,
        campaign: '1234',
        workingRight: CandidateYesNoNSPP.YES,
        materialInsecurity: CandidateYesNo.YES,
        networkInsecurity: CandidateYesNo.NO,
        birthDate: '1996-24-04',
        sectorOccupations: [
          {
            businessSectorId: businessSector1.id,
            occupation: {
              name: 'Développeur',
            },
          },
        ],
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

      // const helpNeeds: { name: HelpValue }[] = [
      //   { name: 'cv' },
      //   { name: 'interview' },
      // ];

      const userValues = {
        firstName: user.firstName,
        lastName: user.lastName,
        email: 'email.fr', // This is the incorrect data
        phone: user.phone,
        gender: user.gender,
      };

      const userProfileValues = {
        // helpNeeds: helpNeeds,
        department: 'Paris (75)' as Department,
      };

      const userToSend = {
        ...userValues,
        ...userProfileValues,
        campaign: '1234',
        workingRight: CandidateYesNoNSPP.YES,
        materialInsecurity: CandidateYesNo.YES,
        networkInsecurity: CandidateYesNo.NO,
        birthDate: '1996-24-04',
        sectorOccupations: [
          {
            businessSectorId: businessSector1.id,
            occupation: {
              name: 'Développeur',
            },
          },
        ],
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

      // const helpNeeds: { name: HelpValue }[] = [
      //   { name: 'cv' },
      //   { name: 'interview' },
      // ];

      const userValues = {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: '1234', // This is the incorrect data
        gender: user.gender,
      };

      const userProfileValues = {
        // helpNeeds: helpNeeds,
        department: 'Paris (75)' as Department,
      };

      const userToSend = {
        ...userValues,
        ...userProfileValues,
        campaign: '1234',
        workingRight: CandidateYesNoNSPP.YES,
        materialInsecurity: CandidateYesNo.YES,
        networkInsecurity: CandidateYesNo.NO,
        birthDate: '1996-24-04',
        sectorOccupations: [
          {
            businessSectorId: businessSector1.id,
            occupation: {
              name: 'Développeur',
            },
          },
        ],
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

      // const helpNeeds: { name: HelpValue }[] = [
      //   { name: 'cv' },
      //   { name: 'interview' },
      // ];

      const userValues = {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        gender: user.gender,
      };

      const userProfileValues = {
        // helpNeeds: helpNeeds,
        department: 'Paris (75)' as Department,
      };

      const userToSend = {
        ...userValues,
        ...userProfileValues,
        campaign: '1234',
        workingRight: CandidateYesNoNSPP.YES,
        materialInsecurity: CandidateYesNo.YES,
        networkInsecurity: CandidateYesNo.NO,
        birthDate: '1996-24-04',
        sectorOccupations: [
          {
            businessSectorId: businessSector1.id,
            occupation: {
              name: 'Développeur',
            },
          },
        ],
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

      // const helpNeeds: { name: HelpValue }[] = [
      //   { name: 'cv' },
      //   { name: 'interview' },
      // ];

      const userValues = {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        gender: user.gender,
      };

      const userProfileValues = {
        // helpNeeds: helpNeeds,
        department: 'Paris (75)' as Department,
      };

      const userToSend = {
        ...userValues,
        ...userProfileValues,
        campaign: '1234',
        workingRight: CandidateYesNoNSPP.YES,
        materialInsecurity: CandidateYesNo.YES,
        networkInsecurity: CandidateYesNo.NO,
        birthDate: '1996-24-04',
        sectorOccupations: [
          {
            businessSectorId: businessSector1.id,
            occupation: {
              name: 'Développeur',
            },
          },
        ],
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

      const nudges = [nudgeCv, nudgeInterview];

      const userToSend = {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        gender: user.gender,
        nudges: nudges.map((nudge) => ({
          id: nudge.id,
        })),
        department: 'Paris (75)' as Department,
        campaign: '1234',
        workingRight: CandidateYesNoNSPP.YES,
        materialInsecurity: CandidateYesNo.YES,
        networkInsecurity: CandidateYesNo.NO,
        birthDate: '1996-24-04',
        sectorOccupations: [
          {
            businessSectorId: businessSector1.id,
            occupation: {
              name: 'Développeur',
            },
          },
        ],
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
