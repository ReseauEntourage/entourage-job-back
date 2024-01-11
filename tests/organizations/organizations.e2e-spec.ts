import { getQueueToken } from '@nestjs/bull';
import { CACHE_MANAGER, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { v4 as uuid } from 'uuid';
import { CacheMocks, QueueMocks } from '../mocks.types';
import { LoggedUser } from 'src/auth/auth.types';
import { Organization } from 'src/organizations/models';
import { OrganizationsController } from 'src/organizations/organizations.controller';
import { Queues } from 'src/queues/queues.types';
import { UserRoles } from 'src/users/users.types';
import { AdminZones, APIResponse } from 'src/utils/types';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import { UserFactory } from 'tests/users/user.factory';
import { UsersHelper } from 'tests/users/users.helper';
import { OrganizationFactory } from './organization.factory';
import { OrganizationsHelper } from './organizations.helper';

describe('Organizations', () => {
  let app: INestApplication;

  let databaseHelper: DatabaseHelper;
  let usersHelper: UsersHelper;
  let organizationFactory: OrganizationFactory;
  let organizationsHelper: OrganizationsHelper;
  let userFactory: UserFactory;

  const route = '/organization';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [CustomTestingModule],
    })
      .overrideProvider(getQueueToken(Queues.WORK))
      .useValue(QueueMocks)
      .overrideProvider(CACHE_MANAGER)
      .useValue(CacheMocks)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    databaseHelper = moduleFixture.get<DatabaseHelper>(DatabaseHelper);
    usersHelper = moduleFixture.get<UsersHelper>(UsersHelper);
    userFactory = moduleFixture.get<UserFactory>(UserFactory);
    organizationsHelper =
      moduleFixture.get<OrganizationsHelper>(OrganizationsHelper);
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

  describe('CRUD Organization', () => {
    describe('C - Create 1 Organization', () => {
      describe('/ - Create organization', () => {
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

        it('Should return 201 when admin creates an organization', async () => {
          const organization = await organizationFactory.create({}, {}, false);

          const organizationToCreate =
            await organizationsHelper.mapOrganizationProps(organization);

          const response: APIResponse<OrganizationsController['create']> =
            await request(app.getHttpServer())
              .post(`${route}`)
              .set('authorization', `Token ${loggedInAdmin.token}`)
              .send(organizationToCreate);
          expect(response.status).toBe(201);
          expect(response.body).toEqual(
            expect.objectContaining({
              ...organization,
              organizationReferent: expect.objectContaining(
                organization.organizationReferent
              ),
            })
          );
        });
        it('Should return 201 when admin creates an organization with missing optional fields', async () => {
          const organization = await organizationFactory.create({}, {}, false);

          const { address, ...organizationToCreate } =
            await organizationsHelper.mapOrganizationProps(organization);

          const response: APIResponse<OrganizationsController['create']> =
            await request(app.getHttpServer())
              .post(`${route}`)
              .set('authorization', `Token ${loggedInAdmin.token}`)
              .send(organizationToCreate);
          expect(response.status).toBe(201);
          expect(response.body).toEqual(
            expect.objectContaining({
              ...organization,
              organizationReferent: expect.objectContaining(
                organization.organizationReferent
              ),
              address: null,
            })
          );
        });
        it('Should return 400 when organization has missing fields', async () => {
          const organization = await organizationFactory.create({}, {}, false);

          const wrongData = {
            name: organization.name,
          };

          const response: APIResponse<OrganizationsController['create']> =
            await request(app.getHttpServer())
              .post(`${route}`)
              .set('authorization', `Token ${loggedInAdmin.token}`)
              .send(wrongData);
          expect(response.status).toBe(400);
        });
        it('Should return 400 when organization has invalid phone number', async () => {
          const organization = await organizationFactory.create({}, {}, false);

          const organizationToCreate =
            await organizationsHelper.mapOrganizationProps(organization);

          const wrongData = {
            ...organizationToCreate,
            phone: '1234',
          };

          const response: APIResponse<OrganizationsController['create']> =
            await request(app.getHttpServer())
              .post(`${route}`)
              .set('authorization', `Token ${loggedInAdmin.token}`)
              .send(wrongData);
          expect(response.status).toBe(400);
        });
        it('Should return 401 when the user is not logged in', async () => {
          const organization = await organizationFactory.create({}, {}, false);

          const organizationToCreate =
            await organizationsHelper.mapOrganizationProps(organization);

          const response: APIResponse<OrganizationsController['create']> =
            await request(app.getHttpServer())
              .post(`${route}`)
              .send(organizationToCreate);
          expect(response.status).toBe(401);
        });
        it('Should return 403 when the user is not a candidate', async () => {
          const organization = await organizationFactory.create({}, {}, false);

          const organizationToCreate =
            await organizationsHelper.mapOrganizationProps(organization);

          const response: APIResponse<OrganizationsController['create']> =
            await request(app.getHttpServer())
              .post(`${route}`)
              .set('authorization', `Token ${loggedInCandidate.token}`)
              .send(organizationToCreate);
          expect(response.status).toBe(403);
        });
        it('Should return 403 when the user is a coach', async () => {
          const organization = await organizationFactory.create({}, {}, false);

          const organizationToCreate =
            await organizationsHelper.mapOrganizationProps(organization);

          const response: APIResponse<OrganizationsController['create']> =
            await request(app.getHttpServer())
              .post(`${route}`)
              .set('authorization', `Token ${loggedInCoach.token}`)
              .send(organizationToCreate);
          expect(response.status).toBe(403);
        });
      });
    });
    describe('R - Read 1 Organization', () => {
      describe('/:id - Get an organization by id', () => {
        let loggedInAdmin: LoggedUser;
        let loggedInCandidate: LoggedUser;
        let loggedInCoach: LoggedUser;

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
        });

        it('Should return 200 when admin gets an organization', async () => {
          const response: APIResponse<OrganizationsController['findOne']> =
            await request(app.getHttpServer())
              .get(`${route}/${organization.id}`)
              .set('authorization', `Token ${loggedInAdmin.token}`);
          expect(response.status).toBe(200);
          expect(response.body).toEqual(
            expect.objectContaining({
              ...organization,
              createdAt: organization.createdAt.toISOString(),
              updatedAt: organization.updatedAt.toISOString(),
              organizationReferent: {
                ...organization.organizationReferent,
                createdAt:
                  organization.organizationReferent.createdAt.toISOString(),
                updatedAt:
                  organization.organizationReferent.updatedAt.toISOString(),
              },
            })
          );
        });

        it('Should return 404 when the organization does not exist', async () => {
          const response: APIResponse<OrganizationsController['findOne']> =
            await request(app.getHttpServer())
              .get(`${route}/${uuid()}`)
              .set('authorization', `Token ${loggedInAdmin.token}`);
          expect(response.status).toBe(404);
        });
        it('Should return 401 when the user is not logged in', async () => {
          const response: APIResponse<OrganizationsController['findOne']> =
            await request(app.getHttpServer()).get(
              `${route}/${organization.id}`
            );
          expect(response.status).toBe(401);
        });
        it('Should return 403 when the user is a candidate', async () => {
          const response: APIResponse<OrganizationsController['findOne']> =
            await request(app.getHttpServer())
              .get(`${route}/${organization.id}`)
              .set('authorization', `Token ${loggedInCandidate.token}`);
          expect(response.status).toBe(403);
        });
        it('Should return 403 when the user is a coach', async () => {
          const response: APIResponse<OrganizationsController['findOne']> =
            await request(app.getHttpServer())
              .get(`${route}/${organization.id}`)
              .set('authorization', `Token ${loggedInCoach.token}`);
          expect(response.status).toBe(403);
        });
      });
    });
    describe('R - Read many Organizations', () => {
      it('Should return 401 when the user is not logged in', async () => {
        const response: APIResponse<OrganizationsController['findAll']> =
          await request(app.getHttpServer()).get(`${route}/?search=X`);
        expect(response.status).toBe(401);
      });
      it('Should return 403 when the user is a candidate', async () => {
        const organization = await organizationFactory.create(
          { name: 'GGG', zone: AdminZones.LILLE },
          {},
          true
        );
        const loggedInCandidate = await usersHelper.createLoggedInUser({
          role: UserRoles.CANDIDATE,
          OrganizationId: organization.id,
        });

        const response: APIResponse<OrganizationsController['findAll']> =
          await request(app.getHttpServer())
            .get(`${route}/?search=X`)
            .set('authorization', `Token ${loggedInCandidate.token}`);
        expect(response.status).toBe(403);
      });
      it('Should return 403 when the user is a coach', async () => {
        const organization = await organizationFactory.create(
          { name: 'GGG', zone: AdminZones.LILLE },
          {},
          true
        );
        const loggedInCoach = await usersHelper.createLoggedInUser({
          role: UserRoles.COACH,
          OrganizationId: organization.id,
        });
        const response: APIResponse<OrganizationsController['findAll']> =
          await request(app.getHttpServer())
            .get(`${route}/?search=X`)
            .set('authorization', `Token ${loggedInCoach.token}`);
        expect(response.status).toBe(403);
      });

      describe('/?limit=&offset= - Get paginated and alphabetically sorted organizations', () => {
        let loggedInAdmin: LoggedUser;

        beforeEach(async () => {
          loggedInAdmin = await usersHelper.createLoggedInUser({
            role: UserRoles.ADMIN,
          });
          await organizationFactory.create({
            name: 'A',
          });
          await organizationFactory.create({
            name: 'B',
          });
          await organizationFactory.create({
            name: 'C',
          });
          await organizationFactory.create({
            name: 'D',
          });
          await organizationFactory.create({
            name: 'E',
          });
        });
        it('Should return 200 and 2 first organizations', async () => {
          const response: APIResponse<OrganizationsController['findAll']> =
            await request(app.getHttpServer())
              .get(`${route}/?limit=2&offset=0`)
              .set('authorization', `Token ${loggedInAdmin.token}`);
          expect(response.status).toBe(200);
          expect(response.body.length).toBe(2);
          expect(response.body[0].name).toMatch('A');
          expect(response.body[1].name).toMatch('B');
        });
        it('Should return 200 and 3 first organizations', async () => {
          const response: APIResponse<OrganizationsController['findAll']> =
            await request(app.getHttpServer())
              .get(`${route}/?limit=3&offset=0`)
              .set('authorization', `Token ${loggedInAdmin.token}`);
          expect(response.status).toBe(200);
          expect(response.body.length).toBe(3);
          expect(response.body[0].name).toMatch('A');
          expect(response.body[1].name).toMatch('B');
          expect(response.body[2].name).toMatch('C');
        });
        it('Should return 200 and the 3rd and 4th organization', async () => {
          const response: APIResponse<OrganizationsController['findAll']> =
            await request(app.getHttpServer())
              .get(`${route}/?limit=2&offset=2`)
              .set('authorization', `Token ${loggedInAdmin.token}`);
          expect(response.status).toBe(200);
          expect(response.body.length).toBe(2);
          expect(response.body[0].name).toMatch('C');
          expect(response.body[1].name).toMatch('D');
        });
      });
      describe('/?search=&zone= - Read all organizations matching search query and filters', () => {
        let loggedInAdmin: LoggedUser;

        let organization: Organization;

        let organizations: Organization[];

        beforeEach(async () => {
          organization = await organizationFactory.create(
            { name: 'GGG', zone: AdminZones.LILLE },
            {},
            true
          );

          loggedInAdmin = await usersHelper.createLoggedInUser({
            role: UserRoles.ADMIN,
          });

          await databaseHelper.createEntities(
            userFactory,
            3,
            {
              role: UserRoles.CANDIDATE_EXTERNAL,
              OrganizationId: organization.id,
            },
            {},
            true
          );

          await databaseHelper.createEntities(
            userFactory,
            7,
            { role: UserRoles.COACH_EXTERNAL, OrganizationId: organization.id },
            {},
            true
          );

          organizations = await databaseHelper.createEntities(
            organizationFactory,
            5,
            { name: 'XXX', zone: AdminZones.PARIS },
            {},
            true
          );
          await databaseHelper.createEntities(
            organizationFactory,
            5,
            { name: 'YYY', zone: AdminZones.LYON },
            {},
            true
          );
        });

        it('Should return 200 and matching organizations when admin gets organizations with search query', async () => {
          const expectedOrganizationsId = [
            ...organizations.map(({ id }) => id),
          ];
          const response: APIResponse<OrganizationsController['findAll']> =
            await request(app.getHttpServer())
              .get(`${route}?limit=50&offset=0&search=X`)
              .set('authorization', `Token ${loggedInAdmin.token}`);
          expect(response.status).toBe(200);
          expect(response.body.length).toBe(5);
          expect(expectedOrganizationsId).toEqual(
            expect.arrayContaining(response.body.map(({ id }) => id))
          );
        });

        it('Should return 200 and matching organizations when admin gets organizations with zone', async () => {
          const expectedOrganizationsId = [
            ...organizations.map(({ id }) => id),
          ];
          const response: APIResponse<OrganizationsController['findAll']> =
            await request(app.getHttpServer())
              .get(`${route}?limit=50&offset=0&zone[]=${AdminZones.PARIS}`)
              .set('authorization', `Token ${loggedInAdmin.token}`);
          expect(response.status).toBe(200);
          expect(response.body.length).toBe(5);
          expect(expectedOrganizationsId).toEqual(
            expect.arrayContaining(response.body.map(({ id }) => id))
          );
        });
        it('Should return 200 and all organizations candidates and coaches count when admin gets organizations ', async () => {
          const response: APIResponse<OrganizationsController['findAll']> =
            await request(app.getHttpServer())
              .get(`${route}/?limit=50&offset=0`)
              .set('authorization', `Token ${loggedInAdmin.token}`);
          expect(response.status).toBe(200);
          expect(response.body).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                coachesCount: 7,
                candidatesCount: 3,
              }),
            ])
          );
        });
        it('Should return 200 and all organizations when admin gets organizations without search query or filters', async () => {
          const response: APIResponse<OrganizationsController['findAll']> =
            await request(app.getHttpServer())
              .get(`${route}/?limit=50&offset=0`)
              .set('authorization', `Token ${loggedInAdmin.token}`);
          expect(response.status).toBe(200);
          expect(response.body.length).toBe(11);
        });
        it('Should return 200 and empty array when no matching organizations', async () => {
          const response: APIResponse<OrganizationsController['findAll']> =
            await request(app.getHttpServer())
              .get(`${route}/?limit=50&offset=0&search=Z`)
              .set('authorization', `Token ${loggedInAdmin.token}`);
          expect(response.status).toBe(200);
          expect(response.body.length).toBe(0);
        });
      });
    });
    describe('U - Update 1 Organization', () => {
      describe('/:id - Update organization', () => {
        let loggedInAdmin: LoggedUser;
        let loggedInCandidate: LoggedUser;
        let loggedInCoach: LoggedUser;

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
        });

        it('Should return 200 when admin updates an organization', async () => {
          const updates = await organizationFactory.create({}, {}, false);
          const response: APIResponse<OrganizationsController['update']> =
            await request(app.getHttpServer())
              .put(`${route}/${organization.id}`)
              .set('authorization', `Token ${loggedInAdmin.token}`)
              .send({
                name: updates.name,
                address: updates.address,
                referentFirstName:
                  updates.organizationReferent.referentFirstName,
              });
          expect(response.status).toBe(200);
          expect(response.body.address).toEqual(updates.address);
          expect(response.body.name).toEqual(updates.name);
          expect(response.body.organizationReferent.referentFirstName).toEqual(
            updates.organizationReferent.referentFirstName
          );
        });
        it('Should return 400 when organization has invalid phone number', async () => {
          const response: APIResponse<OrganizationsController['update']> =
            await request(app.getHttpServer())
              .put(`${route}/${organization.id}`)
              .set('authorization', `Token ${loggedInAdmin.token}`)
              .send({
                referentPhone: '123',
              });
          expect(response.status).toBe(400);
        });
        it('Should return 404 when organization does not exist', async () => {
          const updates = await organizationFactory.create({}, {}, false);
          const response: APIResponse<OrganizationsController['update']> =
            await request(app.getHttpServer())
              .put(`${route}/${uuid()}`)
              .set('authorization', `Token ${loggedInAdmin.token}`)
              .send({
                name: updates.name,
                address: updates.address,
                referentFirstName:
                  updates.organizationReferent.referentFirstName,
              });
          expect(response.status).toBe(404);
        });
        it('Should return 401 when user is not logged in', async () => {
          const updates = await organizationFactory.create({}, {}, false);
          const response: APIResponse<OrganizationsController['update']> =
            await request(app.getHttpServer())
              .put(`${route}/${organization.id}`)
              .send({
                name: updates.name,
                address: updates.address,
                referentFirstName:
                  updates.organizationReferent.referentFirstName,
              });
          expect(response.status).toBe(401);
        });
        it('Should return 403 when the user is not a candidate', async () => {
          const updates = await organizationFactory.create({}, {}, false);
          const response: APIResponse<OrganizationsController['update']> =
            await request(app.getHttpServer())
              .put(`${route}/${organization.id}`)
              .set('authorization', `Token ${loggedInCandidate.token}`)
              .send({
                name: updates.name,
                address: updates.address,
                referentFirstName:
                  updates.organizationReferent.referentFirstName,
              });
          expect(response.status).toBe(403);
        });
        it('Should return 403 when the user is not a coach', async () => {
          const updates = await organizationFactory.create({}, {}, false);
          const response: APIResponse<OrganizationsController['update']> =
            await request(app.getHttpServer())
              .put(`${route}/${organization.id}`)
              .set('authorization', `Token ${loggedInCoach.token}`)
              .send({
                name: updates.name,
                address: updates.address,
                referentFirstName:
                  updates.organizationReferent.referentFirstName,
              });
          expect(response.status).toBe(403);
        });
      });
    });
  });
});
