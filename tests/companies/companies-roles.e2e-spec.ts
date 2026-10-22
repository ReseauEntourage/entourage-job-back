import { Server } from 'http';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';
import request from 'supertest';
import { CompanyUserRole } from 'src/companies/company-user.utils';
import { Company } from 'src/companies/models/company.model';
import { S3Service } from 'src/external-services/aws/s3.service';
import { SlackService } from 'src/external-services/slack/slack.service';
import { QueuesService } from 'src/queues/producers/queues.service';
import { UserRole, UserRoles } from 'src/users/users.types';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import { S3Mocks, SlackMocks } from 'tests/mocks.types';
import { QueuesServiceMock } from 'tests/queues/queues.service.mock';
import { LoggedInUser, UsersHelper } from 'tests/users/users.helper';
import { CompaniesHelper } from './companies.helper';
import { CompanyFactory } from './company.factory';

const ROLES: UserRole[] = [
  UserRoles.CANDIDATE,
  UserRoles.COACH,
  UserRoles.REFERER,
  UserRoles.ADMIN,
];

// Role matrix of the companies endpoints. None of them depends on the user
// role: what matters is whether the user belongs to the company, and whether
// they are one of its admins.
describe('Companies - roles', () => {
  let app: INestApplication;
  let server: Server;
  let databaseHelper: DatabaseHelper;
  let usersHelper: UsersHelper;
  let companiesHelper: CompaniesHelper;
  let companyFactory: CompanyFactory;
  let throttlerStorage: ThrottlerStorageService;
  let company: Company;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [CustomTestingModule],
    })
      .overrideProvider(QueuesService)
      .useClass(QueuesServiceMock)
      .overrideProvider(SlackService)
      .useValue(SlackMocks)
      .overrideProvider(S3Service)
      .useValue(S3Mocks)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    server = app.getHttpServer();

    databaseHelper = moduleFixture.get(DatabaseHelper);
    usersHelper = moduleFixture.get(UsersHelper);
    companiesHelper = moduleFixture.get(CompaniesHelper);
    companyFactory = moduleFixture.get(CompanyFactory);
    throttlerStorage =
      moduleFixture.get<ThrottlerStorageService>(ThrottlerStorage);
  });

  afterAll(async () => {
    await databaseHelper.resetTestDB();
    await app.close();
    server.close();
  });

  beforeEach(async () => {
    await databaseHelper.resetTestDB();
    // Several routes are throttled to 5 calls per minute: this spec calls them more
    throttlerStorage.storage.clear();
    SlackMocks.getUserIdByEmail.mockReset();
    SlackMocks.sendMessage.mockReset();
    company = await companyFactory.create();
  });

  const createUser = async (
    role: UserRole,
    membership?: { isAdmin: boolean }
  ): Promise<LoggedInUser> => {
    const user = await usersHelper.createLoggedInUser({ role });
    if (membership) {
      await companiesHelper.linkCompanyToUser({
        userId: user.user.id,
        companyId: company.id,
        role: membership.isAdmin
          ? CompanyUserRole.EXECUTIVE
          : CompanyUserRole.EMPLOYEE,
        isAdmin: membership.isAdmin,
      });
    }
    return user;
  };

  const bearer = (user: LoggedInUser) => `Bearer ${user.token}`;

  describe('GET /companies (public)', () => {
    const route = '/companies?limit=10&offset=0&onlyWithReferent=false';

    it('is accepted for an anonymous user', async () => {
      const response = await request(server).get(route);

      expect(response.status).toBe(200);
    });

    it.each(ROLES)('is accepted for a %s', async (role) => {
      const user = await createUser(role);

      const response = await request(server)
        .get(route)
        .set('authorization', bearer(user));

      expect(response.status).toBe(200);
    });
  });

  describe('GET /companies/:companyId', () => {
    it('refuses an anonymous user', async () => {
      const response = await request(server).get(`/companies/${company.id}`);

      expect(response.status).toBe(401);
    });

    it.each(ROLES)('is accepted for a %s', async (role) => {
      const user = await createUser(role);

      const response = await request(server)
        .get(`/companies/${company.id}`)
        .set('authorization', bearer(user));

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(company.id);
    });
  });

  describe('GET /companies/:companyId/collaborators', () => {
    it('refuses an anonymous user', async () => {
      const response = await request(server).get(
        `/companies/${company.id}/collaborators`
      );

      expect(response.status).toBe(401);
    });

    it.each(ROLES)(
      'is accepted for a %s who is not a member of the company',
      async (role) => {
        const user = await createUser(role);

        const response = await request(server)
          .get(`/companies/${company.id}/collaborators`)
          .set('authorization', bearer(user));

        expect(response.status).toBe(200);
      }
    );

    it.each(ROLES)(
      'is accepted for a %s who is an admin of the company',
      async (role) => {
        const user = await createUser(role, { isAdmin: true });

        const response = await request(server)
          .get(`/companies/${company.id}/collaborators`)
          .set('authorization', bearer(user));

        expect(response.status).toBe(200);
      }
    );
  });

  describe('PUT /companies', () => {
    it('refuses an anonymous user', async () => {
      const response = await request(server)
        .put('/companies')
        .send({ description: 'New description' });

      expect(response.status).toBe(401);
    });

    it.each(ROLES)(
      'updates the company of a %s who belongs to one',
      async (role) => {
        const user = await createUser(role, { isAdmin: true });

        const response = await request(server)
          .put('/companies')
          .set('authorization', bearer(user))
          .send({ description: 'New description' });

        expect(response.status).toBe(200);
        expect(response.body.description).toBe('New description');
      }
    );

    it.each(ROLES)('answers 404 to a %s without a company', async (role) => {
      const user = await createUser(role);

      const response = await request(server)
        .put('/companies')
        .set('authorization', bearer(user))
        .send({ description: 'New description' });

      expect(response.status).toBe(404);
    });
  });

  describe('POST /companies/logo', () => {
    it('refuses an anonymous user', async () => {
      const response = await request(server).post('/companies/logo');

      expect(response.status).toBe(401);
    });

    it.each(ROLES)(
      'lets a %s through the authentication and asks for a file',
      async (role) => {
        const user = await createUser(role, { isAdmin: true });

        const response = await request(server)
          .post('/companies/logo')
          .set('authorization', bearer(user));

        expect(response.status).toBe(400);
      }
    );
  });

  describe('POST /companies/:companyId/invite-collaborators', () => {
    const emails = ['invitee@example.com'];

    it('refuses an anonymous user', async () => {
      const response = await request(server)
        .post(`/companies/${company.id}/invite-collaborators`)
        .send({ emails });

      expect(response.status).toBe(401);
    });

    it.each(ROLES)(
      'lets a %s who is an admin of the company invite collaborators',
      async (role) => {
        const user = await createUser(role, { isAdmin: true });

        const response = await request(server)
          .post(`/companies/${company.id}/invite-collaborators`)
          .set('authorization', bearer(user))
          .send({ emails });

        expect(response.status).toBe(201);
      }
    );

    it.each(ROLES)(
      'refuses a %s who is a simple member of the company',
      async (role) => {
        const user = await createUser(role, { isAdmin: false });

        const response = await request(server)
          .post(`/companies/${company.id}/invite-collaborators`)
          .set('authorization', bearer(user))
          .send({ emails });

        expect(response.status).toBe(403);
      }
    );

    it.each(ROLES)(
      'refuses a %s who does not belong to the company, even an admin of the platform',
      async (role) => {
        const user = await createUser(role);

        const response = await request(server)
          .post(`/companies/${company.id}/invite-collaborators`)
          .set('authorization', bearer(user))
          .send({ emails });

        expect(response.status).toBe(403);
      }
    );
  });
});
