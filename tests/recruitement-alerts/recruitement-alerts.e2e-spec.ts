import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { Company } from 'src/companies/models/company.model';
import { SlackService } from 'src/external-services/slack/slack.service';
import { QueuesService } from 'src/queues/producers/queues.service';
import { UserRoles } from 'src/users/users.types';
import { CompaniesHelper } from 'tests/companies/companies.helper';
import { CompanyFactory } from 'tests/companies/company.factory';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import { SlackMocks } from 'tests/mocks.types';
import { QueuesServiceMock } from 'tests/queues/queues.service.mock';
import { LoggedInUser, UsersHelper } from 'tests/users/users.helper';
import { RecruitementAlertFactory } from './recruitement-alert.factory';

describe('RecruitementAlerts', () => {
  let app: INestApplication;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let server: any;

  let databaseHelper: DatabaseHelper;
  let usersHelper: UsersHelper;
  let companyFactory: CompanyFactory;
  let companiesHelper: CompaniesHelper;
  let recruitementAlertFactory: RecruitementAlertFactory;

  let companyA: Company;
  let companyB: Company;
  let loggedInCompanyAUser: LoggedInUser;
  let loggedInCompanyBUser: LoggedInUser;
  let loggedInUserWithoutCompany: LoggedInUser;

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
    recruitementAlertFactory = moduleFixture.get<RecruitementAlertFactory>(
      RecruitementAlertFactory
    );
  });

  afterAll(async () => {
    await app.close();
    server.close();
  });

  beforeEach(async () => {
    companyA = await companyFactory.create();
    companyB = await companyFactory.create();

    loggedInCompanyAUser = await usersHelper.createLoggedInUser({
      role: UserRoles.COACH,
    });
    await companiesHelper.linkCompanyToUser({
      userId: loggedInCompanyAUser.user.id,
      companyId: companyA.id,
      isAdmin: true,
    });

    loggedInCompanyBUser = await usersHelper.createLoggedInUser({
      role: UserRoles.COACH,
    });
    await companiesHelper.linkCompanyToUser({
      userId: loggedInCompanyBUser.user.id,
      companyId: companyB.id,
      isAdmin: true,
    });

    loggedInUserWithoutCompany = await usersHelper.createLoggedInUser({
      role: UserRoles.COACH,
    });
  });

  afterEach(async () => {
    await databaseHelper.resetTestDB();
  });

  describe('POST /recruitement-alerts', () => {
    it('creates an alert scoped to the requesting user own company', async () => {
      const response = await request(server)
        .post('/recruitement-alerts')
        .set('Authorization', `Bearer ${loggedInCompanyAUser.token}`)
        .send({ name: 'Alerte dev', jobName: 'Développeur' });

      expect(response.statusCode).toBe(201);
      expect(response.body.companyId).toBe(companyA.id);
    });

    it('ignores a client-supplied companyId and uses the caller own company instead', async () => {
      const response = await request(server)
        .post('/recruitement-alerts')
        .set('Authorization', `Bearer ${loggedInCompanyAUser.token}`)
        .send({
          name: 'Alerte dev',
          jobName: 'Développeur',
          companyId: companyB.id,
        });

      expect(response.statusCode).toBe(201);
      expect(response.body.companyId).toBe(companyA.id);
      expect(response.body.companyId).not.toBe(companyB.id);
    });

    it('rejects creation from a user with no company', async () => {
      const response = await request(server)
        .post('/recruitement-alerts')
        .set('Authorization', `Bearer ${loggedInUserWithoutCompany.token}`)
        .send({ name: 'Alerte dev', jobName: 'Développeur' });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('GET /recruitement-alerts', () => {
    it("only returns the requesting user's own company alerts", async () => {
      await recruitementAlertFactory.create({ companyId: companyA.id });
      await recruitementAlertFactory.create({ companyId: companyB.id });

      const response = await request(server)
        .get('/recruitement-alerts')
        .set('Authorization', `Bearer ${loggedInCompanyAUser.token}`);

      expect(response.statusCode).toBe(200);
      expect(response.body.length).toBe(1);
      expect(response.body[0].companyId).toBe(companyA.id);
    });
  });

  describe('PUT /recruitement-alerts/:id', () => {
    it('allows the owning company to update its own alert', async () => {
      const alert = await recruitementAlertFactory.create({
        companyId: companyA.id,
      });

      const response = await request(server)
        .put(`/recruitement-alerts/${alert.id}`)
        .set('Authorization', `Bearer ${loggedInCompanyAUser.token}`)
        .send({ name: 'Nouveau nom' });

      expect(response.statusCode).toBe(200);
      expect(response.body.name).toBe('Nouveau nom');
    });

    it("forbids updating another company's alert", async () => {
      const alert = await recruitementAlertFactory.create({
        companyId: companyA.id,
      });

      const response = await request(server)
        .put(`/recruitement-alerts/${alert.id}`)
        .set('Authorization', `Bearer ${loggedInCompanyBUser.token}`)
        .send({ name: 'Nouveau nom' });

      expect(response.statusCode).toBe(403);
    });

    it('does not allow reassigning an alert to another company', async () => {
      const alert = await recruitementAlertFactory.create({
        companyId: companyA.id,
      });

      const response = await request(server)
        .put(`/recruitement-alerts/${alert.id}`)
        .set('Authorization', `Bearer ${loggedInCompanyAUser.token}`)
        .send({ companyId: companyB.id });

      expect(response.statusCode).toBe(200);
      expect(response.body.companyId).toBe(companyA.id);
    });
  });

  describe('DELETE /recruitement-alerts/:id', () => {
    it('allows the owning company to delete its own alert', async () => {
      const alert = await recruitementAlertFactory.create({
        companyId: companyA.id,
      });

      const response = await request(server)
        .delete(`/recruitement-alerts/${alert.id}`)
        .set('Authorization', `Bearer ${loggedInCompanyAUser.token}`);

      expect(response.statusCode).toBe(200);
    });

    it("forbids deleting another company's alert", async () => {
      const alert = await recruitementAlertFactory.create({
        companyId: companyA.id,
      });

      const response = await request(server)
        .delete(`/recruitement-alerts/${alert.id}`)
        .set('Authorization', `Bearer ${loggedInCompanyBUser.token}`);

      expect(response.statusCode).toBe(403);
    });
  });

  describe('GET /recruitement-alerts/:id/matching', () => {
    it('allows the owning company to fetch matching candidates', async () => {
      const alert = await recruitementAlertFactory.create({
        companyId: companyA.id,
      });

      const response = await request(server)
        .get(`/recruitement-alerts/${alert.id}/matching`)
        .set('Authorization', `Bearer ${loggedInCompanyAUser.token}`);

      expect(response.statusCode).toBe(200);
    });

    it("forbids fetching another company's matching candidates", async () => {
      const alert = await recruitementAlertFactory.create({
        companyId: companyA.id,
      });

      const response = await request(server)
        .get(`/recruitement-alerts/${alert.id}/matching`)
        .set('Authorization', `Bearer ${loggedInCompanyBUser.token}`);

      expect(response.statusCode).toBe(403);
    });
  });
});
