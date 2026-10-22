import { Server } from 'http';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { SalesforceEventTypes } from 'src/events/event.types';
import { EventsModule } from 'src/events/events.module';
import { SalesforceService } from 'src/external-services/salesforce/salesforce.service';
import { QueuesService } from 'src/queues/producers/queues.service';
import { UserRoles } from 'src/users/users.types';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import { QueuesServiceMock } from 'tests/queues/queues.service.mock';
import { LoggedInUser, UsersHelper } from 'tests/users/users.helper';

const EVENT_ID = 'campaign-1';

const campaign = {
  Id: EVENT_ID,
  Name: 'Atelier réseau',
  Description: 'Description',
  Type_evenement__c: SalesforceEventTypes.NETWORKING,
  StartDate: '2030-03-10',
  Heure_de_d_but__c: '18:00:00.000Z',
  EndDate: '2030-03-10',
  Heure_de_fin__c: '19:30:00.000Z',
  En_ligne__c: 'Non',
};

const ROLES = [
  UserRoles.CANDIDATE,
  UserRoles.COACH,
  UserRoles.REFERER,
  UserRoles.ADMIN,
];

// Role matrix of the events endpoints: none of them is restricted to a role,
// they only require a logged in user. Salesforce is replaced by a double.
describe('Events - roles', () => {
  let app: INestApplication;
  let server: Server;
  let databaseHelper: DatabaseHelper;
  let usersHelper: UsersHelper;

  const salesforceService = {
    findAllEventCampaigns: jest.fn(),
    findEventCampaignById: jest.fn(),
    findAllCampaignMembersByCampaignId: jest.fn(),
    findContact: jest.fn(),
    createOrUpdateCampaignMember: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [CustomTestingModule, EventsModule],
    })
      .overrideProvider(QueuesService)
      .useClass(QueuesServiceMock)
      .overrideProvider(SalesforceService)
      .useValue(salesforceService)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    server = app.getHttpServer();

    databaseHelper = moduleFixture.get(DatabaseHelper);
    usersHelper = moduleFixture.get(UsersHelper);
  });

  afterAll(async () => {
    await databaseHelper.resetTestDB();
    await app.close();
    server.close();
  });

  beforeEach(async () => {
    await databaseHelper.resetTestDB();
    salesforceService.findAllEventCampaigns
      .mockReset()
      .mockResolvedValue([campaign]);
    salesforceService.findEventCampaignById
      .mockReset()
      .mockResolvedValue(campaign);
    salesforceService.findAllCampaignMembersByCampaignId
      .mockReset()
      .mockResolvedValue([]);
    salesforceService.findContact
      .mockReset()
      .mockResolvedValue({ Id: 'contact-1' });
    salesforceService.createOrUpdateCampaignMember
      .mockReset()
      .mockResolvedValue(undefined);
  });

  const endpoints: Array<{
    name: string;
    send: (user?: LoggedInUser) => request.Test;
  }> = [
    {
      name: 'GET /events',
      send: (user) => withAuth(request(server).get('/events'), user),
    },
    {
      name: 'GET /events/:eventId',
      send: (user) =>
        withAuth(request(server).get(`/events/${EVENT_ID}`), user),
    },
    {
      name: 'GET /events/:eventId/participants',
      send: (user) =>
        withAuth(request(server).get(`/events/${EVENT_ID}/participants`), user),
    },
    {
      name: 'PUT /events/:eventId/participation',
      send: (user) =>
        withAuth(
          request(server)
            .put(`/events/${EVENT_ID}/participation`)
            .send({ participate: true }),
          user
        ),
    },
  ];

  const withAuth = (req: request.Test, user?: LoggedInUser) =>
    user ? req.set('authorization', `Bearer ${user.token}`) : req;

  describe.each(endpoints)('$name', ({ send }) => {
    it('refuses an anonymous user', async () => {
      const response = await send();

      expect(response.status).toBe(401);
      expect(
        salesforceService.createOrUpdateCampaignMember
      ).not.toHaveBeenCalled();
    });

    it.each(ROLES)('is accepted for a %s', async (role) => {
      const user = await usersHelper.createLoggedInUser({ role });

      const response = await send(user);

      expect(response.status).toBeLessThan(300);
    });
  });

  it('registers the participation of the calling user whatever their role', async () => {
    const user = await usersHelper.createLoggedInUser({
      role: UserRoles.REFERER,
    });

    const response = await request(server)
      .put(`/events/${EVENT_ID}/participation`)
      .set('authorization', `Bearer ${user.token}`)
      .send({ participate: true });

    expect(response.status).toBe(200);
    expect(salesforceService.createOrUpdateCampaignMember).toHaveBeenCalledWith(
      { contactId: 'contact-1' },
      EVENT_ID,
      expect.anything()
    );
  });
});
