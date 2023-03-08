import { getQueueToken } from '@nestjs/bull';
import { CACHE_MANAGER, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { v4 as uuid } from 'uuid';
import { CacheMocks, QueueMocks, S3Mocks } from '../mocks.types';
import { LoggedUser } from 'src/auth/auth.types';
import { S3Service } from 'src/external-services/aws/s3.service';
import { Organization } from 'src/organizations/models';
import { OrganizationsController } from 'src/organizations/organizations.controller';
import { Queues } from 'src/queues/queues.types';
import { UserRoles } from 'src/users/users.types';
import { APIResponse } from 'src/utils/types';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import { UsersHelper } from 'tests/users/users.helper';
import { OrganizationFactory } from './organization.factory';

describe('Organizations', () => {
  let app: INestApplication;

  let databaseHelper: DatabaseHelper;
  let usersHelper: UsersHelper;
  let organizationFactory: OrganizationFactory;

  const route = '/organization';

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

        beforeEach(async () => {
          loggedInAdmin = await usersHelper.createLoggedInUser({
            role: UserRoles.ADMIN,
          });
          loggedInCandidate = await usersHelper.createLoggedInUser({
            role: UserRoles.CANDIDATE,
          });
        });

        it('Should return 200 when admin creates an organization', async () => {
          const organization = await organizationFactory.create({}, false);
          const response: APIResponse<OrganizationsController['create']> =
            await request(app.getHttpServer())
              .post(`${route}`)
              .set('authorization', `Token ${loggedInAdmin.token}`)
              .send(organization);
          expect(response.status).toBe(201);
          expect(response.body).toEqual(expect.objectContaining(organization));
        });
        it('Should return 400 when organization has missing fields', async () => {
          const organization = await organizationFactory.create({}, false);
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
        it('Should return 401 when organization has invalid phone number', async () => {
          const organization = await organizationFactory.create({}, false);
          const wrongData = {
            ...organization,
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
          const organization = await organizationFactory.create({}, false);

          const response: APIResponse<OrganizationsController['create']> =
            await request(app.getHttpServer())
              .post(`${route}`)
              .send(organization);
          expect(response.status).toBe(401);
        });
        it('Should return 403 when the user is not an administrator', async () => {
          const organization = await organizationFactory.create({}, false);

          const response: APIResponse<OrganizationsController['create']> =
            await request(app.getHttpServer())
              .post(`${route}`)
              .set('authorization', `Token ${loggedInCandidate.token}`)
              .send(organization);
          expect(response.status).toBe(403);
        });
      });
    });
    describe('R - Read 1 Organization', () => {
      describe('/:id - Get an organization by id', () => {
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
          organization = await organizationFactory.create({}, true);
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
        it('Should return 403 when the user is not an administrator', async () => {
          const response: APIResponse<OrganizationsController['findOne']> =
            await request(app.getHttpServer())
              .get(`${route}/${organization.id}`)
              .set('authorization', `Token ${loggedInCandidate.token}`);
          expect(response.status).toBe(403);
        });
      });
    });
    describe('U - Update 1 Organization', () => {
      describe('/:id - Update organization', () => {
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
          organization = await organizationFactory.create({}, true);
        });

        it('Should return 200 when admin updates an organization', async () => {
          const updates = await organizationFactory.create({}, false);
          const response: APIResponse<OrganizationsController['update']> =
            await request(app.getHttpServer())
              .put(`${route}/${organization.id}`)
              .set('authorization', `Token ${loggedInAdmin.token}`)
              .send({
                name: updates.name,
                address: updates.address,
                referentFirstName: updates.referentFirstName,
              });
          expect(response.status).toBe(200);
          expect(response.body.address).toEqual(updates.address);
          expect(response.body.name).toEqual(updates.name);
          expect(response.body.referentFirstName).toEqual(
            updates.referentFirstName
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
          const updates = await organizationFactory.create({}, false);
          const response: APIResponse<OrganizationsController['update']> =
            await request(app.getHttpServer())
              .put(`${route}/${uuid()}`)
              .set('authorization', `Token ${loggedInAdmin.token}`)
              .send({
                name: updates.name,
                address: updates.address,
                referentFirstName: updates.referentFirstName,
              });
          expect(response.status).toBe(404);
        });
        it('Should return 401 when user is not logged in', async () => {
          const updates = await organizationFactory.create({}, false);
          const response: APIResponse<OrganizationsController['update']> =
            await request(app.getHttpServer())
              .put(`${route}/${organization.id}`)
              .send({
                name: updates.name,
                address: updates.address,
                referentFirstName: updates.referentFirstName,
              });
          expect(response.status).toBe(401);
        });
        it('Should return 403 when the user is not an administrator', async () => {
          const updates = await organizationFactory.create({}, false);
          const response: APIResponse<OrganizationsController['update']> =
            await request(app.getHttpServer())
              .put(`${route}/${organization.id}`)
              .set('authorization', `Token ${loggedInCandidate.token}`)
              .send({
                name: updates.name,
                address: updates.address,
                referentFirstName: updates.referentFirstName,
              });
          expect(response.status).toBe(403);
        });
      });
    });
  });
});
