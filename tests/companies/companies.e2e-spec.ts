import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { UsersHelper } from '../users/users.helper';
import { LoggedUser } from 'src/auth/auth.types';
import { CompanyUserRole } from 'src/companies/company-user.utils';
import { Company } from 'src/companies/models/company.model';
import { SlackService } from 'src/external-services/slack/slack.service';
import { QueuesService } from 'src/queues/producers/queues.service';
import { UserRoles } from 'src/users/users.types';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import { SlackMocks } from 'tests/mocks.types';
import { QueuesServiceMock } from 'tests/queues/queues.service.mock';
import { CompaniesHelper } from './companies.helper';
import { CompanyFactory } from './company.factory';

// Configuration
const NB_COMPANIES = 4;

describe('Companies', () => {
  let app: INestApplication;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let server: any;

  let databaseHelper: DatabaseHelper;
  let usersHelper: UsersHelper;
  let companiesHelper: CompaniesHelper;
  let companyFactory: CompanyFactory;

  let company: Company;
  let loggedInCompanyAdmin: LoggedUser;
  let loggedInCollaborator: LoggedUser;
  let loggedInRandomUser: LoggedUser;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [CustomTestingModule],
    })
      .overrideProvider(QueuesService)
      .useClass(QueuesServiceMock)
      .overrideProvider(SlackService)
      .useValue(SlackMocks)
      .compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    server = app.getHttpServer();

    databaseHelper = moduleFixture.get<DatabaseHelper>(DatabaseHelper);
    usersHelper = moduleFixture.get<UsersHelper>(UsersHelper);
    companyFactory = moduleFixture.get<CompanyFactory>(CompanyFactory);
    companiesHelper = moduleFixture.get<CompaniesHelper>(CompaniesHelper);
  });

  afterAll(async () => {
    await app.close();
    server.close();
  });

  afterEach(async () => {
    await databaseHelper.resetTestDB();
  });

  describe('GET /companies', () => {
    beforeEach(async () => {
      // Create some companies
      await databaseHelper.createEntities(companyFactory, NB_COMPANIES);
    });

    it('should return a list of companies', async () => {
      const response = await request(server).get(
        '/companies?search=&limit=10&offset=0'
      );

      expect(response.body).toBeDefined();
      expect(response.statusCode).toBe(200);
      expect(response.body.length).toBe(NB_COMPANIES);
      expect(response.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            name: expect.any(String),
            description: expect.any(String),
          }),
        ])
      );
    });

    it('should return a list of companies with search', async () => {
      // Create a company with a specific name
      await companyFactory.create({
        name: 'Test Company',
        description: 'A company for testing purposes',
      });
      const response = await request(server).get(
        `/companies?search=test&limit=10&offset=0`
      );

      expect(response.body).toBeDefined();
      expect(response.statusCode).toBe(200);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            name: expect.stringContaining('Test Company'),
            description: expect.stringContaining(
              'A company for testing purposes'
            ),
          }),
        ])
      );
    });

    it('should return an empty list when no companies match the search', async () => {
      const response = await request(server).get(
        '/companies?search=nonexistent&limit=10&offset=0'
      );

      expect(response.body).toBeDefined();
      expect(response.statusCode).toBe(200);
      expect(response.body.length).toBe(0);
    });

    it('should return a paginated list of companies', async () => {
      const response = await request(server).get(
        '/companies?search=&limit=2&offset=0'
      );

      expect(response.body).toBeDefined();
      expect(response.statusCode).toBe(200);
      expect(response.body.length).toBe(2);
    });
  });

  describe('POST /companies', () => {
    it('should create a new company', async () => {
      const newCompany = {
        name: 'New Company',
      };

      const response = await request(server)
        .post('/companies')
        .send(newCompany);

      expect(response.statusCode).toBe(201);
      expect(response.body).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          name: newCompany.name,
        })
      );
    });

    it('should return 400 if the company data is invalid', async () => {
      const invalidCompany = {
        name: '', // Invalid name
      };

      const response = await request(server)
        .post('/companies')
        .send(invalidCompany);

      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /companies/:companyId/invite-collaborators', () => {
    beforeEach(async () => {
      // Create a company to invite collaborators to
      company = await companyFactory.create();
      // Create a logged in user
      loggedInCompanyAdmin = await usersHelper.createLoggedInUser({
        role: UserRoles.COACH,
      });
      companiesHelper.linkCompanyToUser({
        userId: loggedInCompanyAdmin.user.id,
        companyId: company.id,
        role: CompanyUserRole.EXECUTIVE,
        isAdmin: true,
      });
      loggedInCollaborator = await usersHelper.createLoggedInUser({
        role: UserRoles.CANDIDATE,
        company: company,
      });
      companiesHelper.linkCompanyToUser({
        userId: loggedInCollaborator.user.id,
        companyId: company.id,
        role: CompanyUserRole.EMPLOYEE,
      });
      loggedInRandomUser = await usersHelper.createLoggedInUser({
        role: UserRoles.CANDIDATE,
      });
    });

    it('should invite collaborators to a company as a company admin', async () => {
      const inviteData = {
        emails: ['test@example.com'],
      };

      const response = await request(server)
        .post(`/companies/${company.id}/invite-collaborators`)
        .set('Authorization', `Bearer ${loggedInCompanyAdmin.token}`)
        .send(inviteData);

      expect(response.statusCode).toBe(201);
    });

    it('should not allow collaborators users to invite collaborators', async () => {
      const inviteData = {
        emails: ['test@example.com'],
      };

      const response = await request(server)
        .post(`/companies/${company.id}/invite-collaborators`)
        .set('Authorization', `Bearer ${loggedInCollaborator.token}`)
        .send(inviteData);

      expect(response.statusCode).toBe(403);
    });

    it('should not allow random users to invite collaborators', async () => {
      const inviteData = {
        emails: ['test@example.com'],
      };

      const response = await request(server)
        .post(`/companies/${company.id}/invite-collaborators`)
        .set('Authorization', `Bearer ${loggedInRandomUser.token}`)
        .send(inviteData);

      expect(response.statusCode).toBe(403);
    });
  });
});
