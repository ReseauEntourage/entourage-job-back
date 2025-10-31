import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { UsersHelper } from '../users/users.helper';
import { LoggedUser } from 'src/auth/auth.types';
import { Department } from 'src/common/departments/models/department.model';
import { CompanyUserRole } from 'src/companies/company-user.utils';
import { Company } from 'src/companies/models/company.model';
import { SlackService } from 'src/external-services/slack/slack.service';
import { QueuesService } from 'src/queues/producers/queues.service';
import { UserRoles } from 'src/users/users.types';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import { DepartmentHelper } from 'tests/departments/department.helper';
import { SlackMocks } from 'tests/mocks.types';
import { QueuesServiceMock } from 'tests/queues/queues.service.mock';
import { CompaniesHelper } from './companies.helper';
import { CompanyFactory } from './company.factory';

// Configuration
const NB_COMPANIES_WITHOUT_ADMIN = 4;
const NB_COMPANIES_WITH_ADMIN = 2;

describe('Companies', () => {
  let app: INestApplication;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let server: any;

  let databaseHelper: DatabaseHelper;
  let usersHelper: UsersHelper;
  let companiesHelper: CompaniesHelper;
  let companyFactory: CompanyFactory;
  let departmentHelper: DepartmentHelper;

  let company: Company;
  let loggedInCompanyAdmin: LoggedUser;
  let loggedInCollaborator: LoggedUser;
  let loggedInRandomUser: LoggedUser;

  let department01: Department;

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
    departmentHelper = moduleFixture.get<DepartmentHelper>(DepartmentHelper);

    await departmentHelper.deleteAllDepartments();
    await departmentHelper.seedDepartments();

    department01 = await departmentHelper.findOne({ value: '01' }); // Ain
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

      // Companies without admin
      await databaseHelper.createEntities(
        companyFactory,
        NB_COMPANIES_WITHOUT_ADMIN
      );

      // Companies with admin
      const companiesWithAdmin = await databaseHelper.createEntities(
        companyFactory,
        NB_COMPANIES_WITH_ADMIN
      );

      const linkPromises = companiesWithAdmin.map(async (company) => {
        const companyAdmin = await usersHelper.createLoggedInUser({
          role: UserRoles.COACH,
        });
        await companyFactory.linkAdminToCompany(company, companyAdmin.user.id, {
          isAdmin: true,
          role: CompanyUserRole.EXECUTIVE,
        });
      });

      await Promise.all(linkPromises);
    });

    it('should return a list of companies with admin', async () => {
      const response = await request(server).get(
        '/companies?search=&limit=10&offset=0'
      );

      expect(response.body).toBeDefined();
      expect(response.statusCode).toBe(200);
      expect(response.body.length).toBe(NB_COMPANIES_WITH_ADMIN);
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

    it('should return a list of companies with admin (with search)', async () => {
      // Create a company with a specific name
      const companyTest = await companyFactory.create({
        name: 'Test Company',
        description: 'A company for testing purposes',
      });
      const companyAdmin = await usersHelper.createLoggedInUser({
        role: UserRoles.COACH,
      });
      await companiesHelper.linkCompanyToUser({
        companyId: companyTest.id,
        userId: companyAdmin.user.id,
        role: CompanyUserRole.EXECUTIVE,
        isAdmin: true,
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

    it('should return a filtered list of companies by department', async () => {
      // Create a company with a specific department
      const companyInDepartment = await companyFactory.create({
        departmentId: department01.id,
      });
      // Link admin to the company
      const companyAdmin = await usersHelper.createLoggedInUser({
        role: UserRoles.COACH,
      });
      await companiesHelper.linkCompanyToUser({
        userId: companyAdmin.user.id,
        companyId: companyInDepartment.id,
        role: CompanyUserRole.EXECUTIVE,
        isAdmin: true,
      });

      const response = await request(server).get(
        `/companies?search=&departments[]=${department01.id}&limit=10&offset=0`
      );

      expect(response.body).toBeDefined();
      expect(response.statusCode).toBe(200);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            department: expect.objectContaining({
              id: department01.id,
              name: department01.name,
              value: department01.value,
            }),
          }),
        ])
      );
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
