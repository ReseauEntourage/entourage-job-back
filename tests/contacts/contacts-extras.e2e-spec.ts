import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { MailjetService } from 'src/external-services/mailjet/mailjet.service';
import { SalesforceService } from 'src/external-services/salesforce/salesforce.service';
import { QueuesService } from 'src/queues/producers/queues.service';
import { Jobs } from 'src/queues/queues.types';
import { UserRoles } from 'src/users/users.types';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import { MailjetMock, SalesforceMocks } from 'tests/mocks.types';
import { QueuesServiceMock } from 'tests/queues/queues.service.mock';
import { LoggedInUser, UsersHelper } from 'tests/users/users.helper';
import { ContactCompanyFormFactory } from './contact-company-form.factory';
import { ContactUsFormFactory } from './contact-us-form.factory';

// Complements tests/contacts/contacts.e2e-spec.ts: Salesforce enabled branch, existing user
// newsletter subscription, phone / email validation and access by role. Every endpoint of the
// module is public: no role is refused, and the matrix below proves it.
describe('Contacts - extras', () => {
  let app: INestApplication;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let server: any;
  let databaseHelper: DatabaseHelper;
  let usersHelper: UsersHelper;
  let contactUsFormFactory: ContactUsFormFactory;
  let contactCompanyFormFactory: ContactCompanyFormFactory;
  let queueSpy: jest.SpyInstance;

  const route = '/contact';
  const envBackup = { ...process.env };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [CustomTestingModule],
    })
      .overrideProvider(QueuesService)
      .useClass(QueuesServiceMock)
      .overrideProvider(SalesforceService)
      .useValue(SalesforceMocks)
      .overrideProvider(MailjetService)
      .useValue(MailjetMock)
      .compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    server = app.getHttpServer();
    databaseHelper = moduleFixture.get(DatabaseHelper);
    usersHelper = moduleFixture.get(UsersHelper);
    contactUsFormFactory = moduleFixture.get(ContactUsFormFactory);
    contactCompanyFormFactory = moduleFixture.get(ContactCompanyFormFactory);
  });

  afterAll(async () => {
    await databaseHelper.resetTestDB();
    await app.close();
    server.close();
  });

  beforeEach(async () => {
    await databaseHelper.resetTestDB();
    SalesforceMocks.createOrUpdateCompanySalesforceLead.mockReset();
    SalesforceMocks.getCandidateCampaigns.mockReset();
    SalesforceMocks.getCoachCampaigns.mockReset();
    queueSpy = jest.spyOn(QueuesServiceMock.prototype, 'addToWorkQueue');
  });

  afterEach(() => {
    process.env = { ...envBackup };
    jest.restoreAllMocks();
  });

  describe('Salesforce disabled or enabled', () => {
    it('does not call Salesforce when ENABLE_SF is not true', async () => {
      process.env.ENABLE_SF = 'false';
      const form = await contactCompanyFormFactory.create({});

      expect(
        (await request(server).post(`${route}/company`).send(form)).status
      ).toBe(201);
      expect(
        (await request(server).get(`${route}/campaigns/candidate`)).status
      ).toBe(200);
      expect(
        (await request(server).get(`${route}/campaigns/coach`)).status
      ).toBe(200);

      expect(
        SalesforceMocks.createOrUpdateCompanySalesforceLead
      ).not.toHaveBeenCalled();
      expect(SalesforceMocks.getCandidateCampaigns).not.toHaveBeenCalled();
      expect(SalesforceMocks.getCoachCampaigns).not.toHaveBeenCalled();
    });

    it('creates the Salesforce lead of a company form when ENABLE_SF is true', async () => {
      process.env.ENABLE_SF = 'true';
      SalesforceMocks.createOrUpdateCompanySalesforceLead.mockResolvedValue(
        'lead-1'
      );
      const form = await contactCompanyFormFactory.create({});

      const response = await request(server)
        .post(`${route}/company`)
        .send(form);

      expect(response.status).toBe(201);
      expect(
        SalesforceMocks.createOrUpdateCompanySalesforceLead
      ).toHaveBeenCalledWith(expect.objectContaining({ email: form.email }));
    });

    it('serves the Salesforce campaigns when ENABLE_SF is true', async () => {
      process.env.ENABLE_SF = 'true';
      SalesforceMocks.getCandidateCampaigns.mockResolvedValue([
        {
          id: 'camp-1',
          antenne: 'Paris',
          address: null,
          time: '2030-01-01T10:00:00+01:00',
        },
      ]);
      SalesforceMocks.getCoachCampaigns.mockResolvedValue([
        { id: 'camp-2', time: '2030-01-02T10:00:00+01:00' },
      ]);

      const candidate = await request(server).get(
        `${route}/campaigns/candidate`
      );
      const coach = await request(server).get(`${route}/campaigns/coach`);

      expect(candidate.body).toEqual([
        expect.objectContaining({ id: 'camp-1' }),
      ]);
      expect(coach.body).toEqual([expect.objectContaining({ id: 'camp-2' })]);
    });
  });

  describe('Validation', () => {
    it('returns 400 for an invalid phone on the contact form and on the company form', async () => {
      const contactUs = await contactUsFormFactory.create({});
      const company = await contactCompanyFormFactory.create({});

      const contactUsResponse = await request(server)
        .post(`${route}/contactUs`)
        .send({ ...contactUs, phone: 'not-a-phone' });
      const companyResponse = await request(server)
        .post(`${route}/company`)
        .send({ ...company, phone: '0600000000' });

      expect(contactUsResponse.status).toBe(400);
      expect(companyResponse.status).toBe(400);
    });

    it('returns 400 for an unknown field on the contact forms', async () => {
      const contactUs = await contactUsFormFactory.create({});

      const response = await request(server)
        .post(`${route}/contactUs`)
        .send({ ...contactUs, unexpected: true });

      expect(response.status).toBe(400);
    });

    it('returns 400 for a malformed newsletter email', async () => {
      const response = await request(server)
        .post(`${route}/newsletter`)
        .send({ email: 'not-an-email' });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /contact/newsletter', () => {
    it('queues a new subscription for an unknown email', async () => {
      const response = await request(server)
        .post(`${route}/newsletter`)
        .send({ email: 'new.reader@example.com' });

      expect(response.status).toBe(201);
      expect(queueSpy).toHaveBeenCalledWith(
        Jobs.NEWSLETTER_SUBSCRIPTION,
        expect.objectContaining({ email: 'new.reader@example.com' })
      );
    });

    it('queues a user subscription for the email of an existing user', async () => {
      const user = await usersHelper.createLoggedInUser({
        role: UserRoles.COACH,
      });

      const response = await request(server)
        .post(`${route}/newsletter`)
        .send({ email: user.user.email });

      expect(response.status).toBe(201);
      expect(queueSpy).toHaveBeenCalledWith(
        Jobs.USER_NEWSLETTER_SUBSCRIPTION,
        expect.objectContaining({ userId: user.user.id })
      );
    });
  });

  describe('Access by role', () => {
    it.each([
      UserRoles.CANDIDATE,
      UserRoles.COACH,
      UserRoles.REFERER,
      UserRoles.ADMIN,
    ])('lets a logged in %s use the public endpoints', async (role) => {
      const loggedIn: LoggedInUser = await usersHelper.createLoggedInUser({
        role,
      });
      const auth = { authorization: `Bearer ${loggedIn.token}` };

      expect(
        (await request(server).get(`${route}/campaigns/candidate`).set(auth))
          .status
      ).toBe(200);
      expect(
        (
          await request(server)
            .post(`${route}/contactUs`)
            .set(auth)
            .send(await contactUsFormFactory.create({}))
        ).status
      ).toBe(201);
    });
  });
});
