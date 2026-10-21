import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { SalesforceService } from 'src/external-services/salesforce/salesforce.service';
import { MailsService } from 'src/mails/mails.service';
import { QueuesService } from 'src/queues/producers/queues.service';
import { UserRoles } from 'src/users/users.types';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import { MailsServiceMock } from 'tests/mails/mails.service.mock';
import { SalesforceMocks } from 'tests/mocks.types';
import { OrganizationFactory } from 'tests/organizations/organization.factory';
import { QueuesServiceMock } from 'tests/queues/queues.service.mock';
import { UserFactory } from 'tests/users/user.factory';
import { LoggedInUser, UsersHelper } from 'tests/users/users.helper';

// Complements tests/current-user/current-user.e2e-spec.ts: role matrix on every endpoint and
// the data-rich cases (referred users, referrer, organization, staff contact).
describe('CurrentUser - extras', () => {
  let app: INestApplication;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let server: any;
  let databaseHelper: DatabaseHelper;
  let usersHelper: UsersHelper;
  let userFactory: UserFactory;
  let organizationFactory: OrganizationFactory;

  const route = '/current';
  const endpoints = [
    '',
    '/profile',
    '/profile/complete',
    '/company',
    '/organization',
    '/stats',
    '/whatsapp-zone',
    '/staff-contact',
    '/referred-users',
    '/referrer',
    '/achievements',
    '/read-documents',
  ];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [CustomTestingModule],
    })
      .overrideProvider(QueuesService)
      .useValue(QueuesServiceMock)
      .overrideProvider(MailsService)
      .useClass(MailsServiceMock)
      .overrideProvider(SalesforceService)
      .useValue(SalesforceMocks)
      .compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    server = app.getHttpServer();
    databaseHelper = moduleFixture.get(DatabaseHelper);
    usersHelper = moduleFixture.get(UsersHelper);
    userFactory = moduleFixture.get(UserFactory);
    organizationFactory = moduleFixture.get(OrganizationFactory);
  });

  afterAll(async () => {
    await databaseHelper.resetTestDB();
    await app.close();
    server.close();
  });

  beforeEach(async () => {
    await databaseHelper.resetTestDB();
    SalesforceMocks.findContactIdsByEmails.mockReset().mockResolvedValue({});
    SalesforceMocks.findEventParticipationCountByContactIds
      .mockReset()
      .mockResolvedValue({});
  });

  it('refuses anonymous users on every endpoint', async () => {
    for (const endpoint of endpoints) {
      const response = await request(server).get(`${route}${endpoint}`);
      expect([endpoint, response.status]).toEqual([endpoint, 401]);
    }
  });

  it.each([
    UserRoles.CANDIDATE,
    UserRoles.COACH,
    UserRoles.REFERER,
    UserRoles.ADMIN,
  ])('serves a %s on the self-describing endpoints', async (role) => {
    const loggedIn = await usersHelper.createLoggedInUser({ role });

    for (const endpoint of [
      '',
      '/profile',
      '/profile/complete',
      '/company',
      '/organization',
      '/stats',
      '/whatsapp-zone',
      '/referred-users',
      '/referrer',
      '/achievements',
      '/read-documents',
    ]) {
      const response = await request(server)
        .get(`${route}${endpoint}`)
        .set('authorization', `Bearer ${loggedIn.token}`);
      expect([role, endpoint, response.status]).toEqual([role, endpoint, 200]);
    }
  });

  describe('GET /current/staff-contact', () => {
    it.each([UserRoles.CANDIDATE, UserRoles.COACH])(
      'returns the public staff contact of a %s',
      async (role) => {
        const loggedIn = await usersHelper.createLoggedInUser({ role });

        const response = await request(server)
          .get(`${route}/staff-contact`)
          .set('authorization', `Bearer ${loggedIn.token}`);

        expect(response.status).toBe(200);
        expect(response.body.name).toEqual(expect.any(String));
        expect(response.body).not.toHaveProperty('slackEmail');
        expect(response.body).not.toHaveProperty('entourageProEmail');
      }
    );

    it.each([UserRoles.REFERER, UserRoles.ADMIN])(
      'answers for a %s without failing',
      async (role) => {
        const loggedIn = await usersHelper.createLoggedInUser({ role });

        const response = await request(server)
          .get(`${route}/staff-contact`)
          .set('authorization', `Bearer ${loggedIn.token}`);

        expect([200, 404]).toContain(response.status);
      }
    );
  });

  describe('GET /current/referred-users', () => {
    it('lists the candidates of a referer with their Salesforce event participations', async () => {
      const referer = await usersHelper.createLoggedInUser({
        role: UserRoles.REFERER,
      });
      const candidateA = await userFactory.create({
        role: UserRoles.CANDIDATE,
        refererId: referer.user.id,
      });
      const candidateB = await userFactory.create({
        role: UserRoles.CANDIDATE,
        refererId: referer.user.id,
      });
      await userFactory.create({ role: UserRoles.CANDIDATE });
      SalesforceMocks.findContactIdsByEmails.mockResolvedValue({
        [candidateA.email.toLowerCase()]: 'sf-contact-a',
      });
      SalesforceMocks.findEventParticipationCountByContactIds.mockResolvedValue(
        {
          'sf-contact-a': 3,
        }
      );

      const response = await request(server)
        .get(`${route}/referred-users`)
        .set('authorization', `Bearer ${referer.token}`);

      expect(response.status).toBe(200);
      expect(response.body.referredCandidates).toHaveLength(2);
      const byId = Object.fromEntries(
        response.body.referredCandidates.map(
          (candidate: { id: string; eventsParticipatedCount: number }) => [
            candidate.id,
            candidate,
          ]
        )
      );
      expect(byId[candidateA.id].eventsParticipatedCount).toBe(3);
      expect(byId[candidateB.id].eventsParticipatedCount).toBe(0);
      expect(byId[candidateA.id].role).toBe(UserRoles.CANDIDATE);
    });

    it('only exposes the candidates of the current user', async () => {
      const referer = await usersHelper.createLoggedInUser({
        role: UserRoles.REFERER,
      });
      const otherReferer = await usersHelper.createLoggedInUser({
        role: UserRoles.REFERER,
      });
      await userFactory.create({
        role: UserRoles.CANDIDATE,
        refererId: otherReferer.user.id,
      });

      const response = await request(server)
        .get(`${route}/referred-users`)
        .set('authorization', `Bearer ${referer.token}`);

      expect(response.status).toBe(200);
      expect(response.body.referredCandidates).toEqual([]);
    });
  });

  describe('GET /current/referrer', () => {
    it('returns the referer of a referred candidate', async () => {
      const referer: LoggedInUser = await usersHelper.createLoggedInUser({
        role: UserRoles.REFERER,
      });
      const candidate = await usersHelper.createLoggedInUser({
        role: UserRoles.CANDIDATE,
        refererId: referer.user.id,
      });

      const response = await request(server)
        .get(`${route}/referrer`)
        .set('authorization', `Bearer ${candidate.token}`);

      expect(response.status).toBe(200);
      expect(response.body.referer).toEqual({
        id: referer.user.id,
        firstName: referer.user.firstName,
        lastName: referer.user.lastName,
      });
    });
  });

  describe('GET /current/organization', () => {
    it('returns the organization of a referer', async () => {
      const organization = await organizationFactory.create({}, {}, true);
      const referer = await usersHelper.createLoggedInUser({
        role: UserRoles.REFERER,
        OrganizationId: organization.id,
      });

      const response = await request(server)
        .get(`${route}/organization`)
        .set('authorization', `Bearer ${referer.token}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: organization.id,
        name: organization.name,
        zone: organization.zone,
      });
    });
  });
});
