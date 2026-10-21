import { Server } from 'http';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { Company } from 'src/companies/models/company.model';
import { SlackService } from 'src/external-services/slack/slack.service';
import { QueuesService } from 'src/queues/producers/queues.service';
import { UserRole, UserRoles } from 'src/users/users.types';
import { CompaniesHelper } from 'tests/companies/companies.helper';
import { CompanyFactory } from 'tests/companies/company.factory';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import { SlackMocks } from 'tests/mocks.types';
import { QueuesServiceMock } from 'tests/queues/queues.service.mock';
import { LoggedInUser, UsersHelper } from 'tests/users/users.helper';
import { RecruitementAlertFactory } from './recruitement-alert.factory';

const ROLES: UserRole[] = [
  UserRoles.CANDIDATE,
  UserRoles.COACH,
  UserRoles.REFERER,
  UserRoles.ADMIN,
];

// Role matrix of the recruitement alerts endpoints. They are not restricted to
// a role: every route requires a logged in user, and the alerts are scoped to
// the company of that user, whatever their role.
describe('RecruitementAlerts - roles', () => {
  let app: INestApplication;
  let server: Server;
  let databaseHelper: DatabaseHelper;
  let usersHelper: UsersHelper;
  let companyFactory: CompanyFactory;
  let companiesHelper: CompaniesHelper;
  let recruitementAlertFactory: RecruitementAlertFactory;
  let company: Company;

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

    databaseHelper = moduleFixture.get(DatabaseHelper);
    usersHelper = moduleFixture.get(UsersHelper);
    companyFactory = moduleFixture.get(CompanyFactory);
    companiesHelper = moduleFixture.get(CompaniesHelper);
    recruitementAlertFactory = moduleFixture.get(RecruitementAlertFactory);
  });

  afterAll(async () => {
    await databaseHelper.resetTestDB();
    await app.close();
    server.close();
  });

  beforeEach(async () => {
    await databaseHelper.resetTestDB();
    company = await companyFactory.create();
  });

  const createUser = async (
    role: UserRole,
    withCompany: boolean
  ): Promise<LoggedInUser> => {
    const user = await usersHelper.createLoggedInUser({ role });
    if (withCompany) {
      await companiesHelper.linkCompanyToUser({
        userId: user.user.id,
        companyId: company.id,
        isAdmin: false,
      });
    }
    return user;
  };

  const createAlert = () =>
    recruitementAlertFactory.create({ companyId: company.id });

  const bearer = (user: LoggedInUser) => `Bearer ${user.token}`;

  describe('anonymous user', () => {
    it.each([
      ['POST', '/recruitement-alerts'],
      ['GET', '/recruitement-alerts'],
      ['GET', '/recruitement-alerts/:id/matching'],
      ['PUT', '/recruitement-alerts/:id'],
      ['DELETE', '/recruitement-alerts/:id'],
    ])('is refused on %s %s', async (method, route) => {
      const alert = await createAlert();
      const url = route.replace(':id', alert.id);

      const response =
        await request(server)[
          method.toLowerCase() as 'get' | 'post' | 'put' | 'delete'
        ](url);

      expect(response.status).toBe(401);
    });
  });

  describe.each(ROLES)('%s with a company', (role) => {
    let user: LoggedInUser;

    beforeEach(async () => {
      user = await createUser(role, true);
    });

    it('creates an alert for their company', async () => {
      const response = await request(server)
        .post('/recruitement-alerts')
        .set('authorization', bearer(user))
        .send({ name: 'Alerte', jobName: 'Développeur' });

      expect(response.status).toBe(201);
      expect(response.body.companyId).toBe(company.id);
    });

    it('lists the alerts of their company', async () => {
      const alert = await createAlert();

      const response = await request(server)
        .get('/recruitement-alerts')
        .set('authorization', bearer(user));

      expect(response.status).toBe(200);
      expect(response.body.map((a: { id: string }) => a.id)).toEqual([
        alert.id,
      ]);
    });

    it('fetches the candidates matching an alert of their company', async () => {
      const alert = await createAlert();

      const response = await request(server)
        .get(`/recruitement-alerts/${alert.id}/matching`)
        .set('authorization', bearer(user));

      expect(response.status).toBe(200);
    });

    it('updates an alert of their company', async () => {
      const alert = await createAlert();

      const response = await request(server)
        .put(`/recruitement-alerts/${alert.id}`)
        .set('authorization', bearer(user))
        .send({ name: 'Renamed' });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Renamed');
    });

    it('deletes an alert of their company', async () => {
      const alert = await createAlert();

      const response = await request(server)
        .delete(`/recruitement-alerts/${alert.id}`)
        .set('authorization', bearer(user));

      expect(response.status).toBe(200);
    });
  });

  describe.each(ROLES)('%s without a company', (role) => {
    let user: LoggedInUser;

    beforeEach(async () => {
      user = await createUser(role, false);
    });

    it('cannot create an alert', async () => {
      const response = await request(server)
        .post('/recruitement-alerts')
        .set('authorization', bearer(user))
        .send({ name: 'Alerte', jobName: 'Développeur' });

      expect(response.status).toBe(403);
    });

    it('gets an empty list of alerts', async () => {
      await createAlert();

      const response = await request(server)
        .get('/recruitement-alerts')
        .set('authorization', bearer(user));

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('cannot fetch the candidates matching an alert', async () => {
      const alert = await createAlert();

      const response = await request(server)
        .get(`/recruitement-alerts/${alert.id}/matching`)
        .set('authorization', bearer(user));

      expect(response.status).toBe(403);
    });

    it('cannot update an alert', async () => {
      const alert = await createAlert();

      const response = await request(server)
        .put(`/recruitement-alerts/${alert.id}`)
        .set('authorization', bearer(user))
        .send({ name: 'Renamed' });

      expect(response.status).toBe(403);
    });

    it('cannot delete an alert', async () => {
      const alert = await createAlert();

      const response = await request(server)
        .delete(`/recruitement-alerts/${alert.id}`)
        .set('authorization', bearer(user));

      expect(response.status).toBe(403);
    });
  });
});
