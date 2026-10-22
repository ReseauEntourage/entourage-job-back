import { Server } from 'http';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { Company } from 'src/companies/models/company.model';
import { SlackService } from 'src/external-services/slack/slack.service';
import { QueuesService } from 'src/queues/producers/queues.service';
import { RecruitementAlertsService } from 'src/recruitement-alerts/recruitement-alerts.service';
import { UserRoles } from 'src/users/users.types';
import { BusinessSectorFactory } from 'tests/business-sectors/business-sector.factory';
import { SkillFactory } from 'tests/common/skills/skill.factory';
import { CompaniesHelper } from 'tests/companies/companies.helper';
import { CompanyFactory } from 'tests/companies/company.factory';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import { SlackMocks } from 'tests/mocks.types';
import { QueuesServiceMock } from 'tests/queues/queues.service.mock';
import { LoggedInUser, UsersHelper } from 'tests/users/users.helper';
import { RecruitementAlertFactory } from './recruitement-alert.factory';

const UNKNOWN_UUID = '3f1c2a52-2b0c-4a0a-9a2e-0f3c9f7a1b11';

describe('RecruitementAlerts (details)', () => {
  let app: INestApplication;
  let server: Server;
  let databaseHelper: DatabaseHelper;
  let usersHelper: UsersHelper;
  let companyFactory: CompanyFactory;
  let companiesHelper: CompaniesHelper;
  let alertFactory: RecruitementAlertFactory;
  let businessSectorFactory: BusinessSectorFactory;
  let skillFactory: SkillFactory;
  let alertsService: RecruitementAlertsService;

  let company: Company;
  let owner: LoggedInUser;

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
    alertFactory = moduleFixture.get(RecruitementAlertFactory);
    businessSectorFactory = moduleFixture.get(BusinessSectorFactory);
    skillFactory = moduleFixture.get(SkillFactory);
    alertsService = moduleFixture.get(RecruitementAlertsService);
  });

  afterAll(async () => {
    await databaseHelper.resetTestDB();
    await app.close();
    server.close();
  });

  beforeEach(async () => {
    await databaseHelper.resetTestDB();
    company = await companyFactory.create();
    owner = await usersHelper.createLoggedInUser({ role: UserRoles.COACH });
    await companiesHelper.linkCompanyToUser({
      userId: owner.user.id,
      companyId: company.id,
      isAdmin: true,
    });
  });

  const auth = (user: LoggedInUser) => ({
    authorization: `Bearer ${user.token}`,
  });

  describe('POST /recruitement-alerts', () => {
    it('stores the business sectors and the skills of the alert, creating the new skills', async () => {
      const sector = await businessSectorFactory.create({ name: 'Cuisine' });
      const skill = await skillFactory.create({ name: 'Cooking' });

      const response = await request(server)
        .post('/recruitement-alerts')
        .set(auth(owner))
        .send({
          name: 'Cooks',
          jobName: 'Cuisinier',
          businessSectorIds: [sector.id],
          skills: [
            { value: skill.id, label: 'Cooking' },
            { value: 'new', label: 'Brand new skill', __isNew__: true },
          ],
        });

      expect(response.status).toBe(201);
      const stored = await alertsService.findOne(response.body.id);
      expect(stored.businessSectors.map((s) => s.id)).toEqual([sector.id]);
      expect(stored.skills.map((s) => s.name).sort()).toEqual([
        'Brand new skill',
        'Cooking',
      ]);
    });

    it('refuses an anonymous user', async () => {
      const response = await request(server)
        .post('/recruitement-alerts')
        .send({ name: 'Cooks' });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /recruitement-alerts', () => {
    it('returns an empty list to a user without company', async () => {
      const loner = await usersHelper.createLoggedInUser({
        role: UserRoles.CANDIDATE,
      });

      const response = await request(server)
        .get('/recruitement-alerts')
        .set(auth(loner));

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('refuses an anonymous user', async () => {
      const response = await request(server).get('/recruitement-alerts');

      expect(response.status).toBe(401);
    });
  });

  describe('PUT /recruitement-alerts/:id', () => {
    it('replaces the business sectors and the skills of the alert', async () => {
      const first = await businessSectorFactory.create({ name: 'Cuisine' });
      const second = await businessSectorFactory.create({ name: 'Transport' });
      const oldSkill = await skillFactory.create({ name: 'Old' });
      const newSkill = await skillFactory.create({ name: 'Newer' });
      const alert = await alertsService.create(owner.user.id, {
        name: 'Cooks',
        jobName: 'Cuisinier',
        businessSectorIds: [first.id],
        skills: [{ value: oldSkill.id, label: 'Old' }],
      });

      const response = await request(server)
        .put(`/recruitement-alerts/${alert.id}`)
        .set(auth(owner))
        .send({
          name: 'Renamed',
          businessSectorIds: [second.id],
          skills: [{ value: newSkill.id, label: 'Newer' }],
        });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Renamed');
      expect(
        response.body.businessSectors.map((s: { id: string }) => s.id)
      ).toEqual([second.id]);
      expect(response.body.skills.map((s: { id: string }) => s.id)).toEqual([
        newSkill.id,
      ]);
    });

    it('leaves the sectors and skills untouched when they are not sent', async () => {
      const sector = await businessSectorFactory.create({ name: 'Cuisine' });
      const alert = await alertsService.create(owner.user.id, {
        name: 'Cooks',
        jobName: 'Cuisinier',
        businessSectorIds: [sector.id],
      });

      const response = await request(server)
        .put(`/recruitement-alerts/${alert.id}`)
        .set(auth(owner))
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.businessSectors).toHaveLength(1);
    });

    it('answers 404 for an unknown alert', async () => {
      const response = await request(server)
        .put(`/recruitement-alerts/${UNKNOWN_UUID}`)
        .set(auth(owner))
        .send({ name: 'x' });

      expect(response.status).toBe(404);
    });

    it('forbids a user without company', async () => {
      const alert = await alertFactory.create({
        name: 'Cooks',
        companyId: company.id,
      });
      const loner = await usersHelper.createLoggedInUser({
        role: UserRoles.CANDIDATE,
      });

      const response = await request(server)
        .put(`/recruitement-alerts/${alert.id}`)
        .set(auth(loner))
        .send({ name: 'x' });

      expect(response.status).toBe(403);
    });

    it('refuses an anonymous user', async () => {
      const response = await request(server)
        .put(`/recruitement-alerts/${UNKNOWN_UUID}`)
        .send({ name: 'x' });

      expect(response.status).toBe(401);
    });
  });

  describe('DELETE /recruitement-alerts/:id', () => {
    it('removes the alert with its sectors and skills', async () => {
      const sector = await businessSectorFactory.create({ name: 'Cuisine' });
      const skill = await skillFactory.create({ name: 'Cooking' });
      const alert = await alertsService.create(owner.user.id, {
        name: 'Cooks',
        jobName: 'Cuisinier',
        businessSectorIds: [sector.id],
        skills: [{ value: skill.id, label: 'Cooking' }],
      });

      const response = await request(server)
        .delete(`/recruitement-alerts/${alert.id}`)
        .set(auth(owner));

      expect(response.status).toBe(200);
      expect(await alertsService.findOne(alert.id)).toBeNull();
      expect(await alertsService.findAll()).toEqual([]);
    });

    it('answers 404 for an unknown alert', async () => {
      const response = await request(server)
        .delete(`/recruitement-alerts/${UNKNOWN_UUID}`)
        .set(auth(owner));

      expect(response.status).toBe(404);
    });

    it('refuses an anonymous user', async () => {
      const response = await request(server).delete(
        `/recruitement-alerts/${UNKNOWN_UUID}`
      );

      expect(response.status).toBe(401);
    });
  });

  describe('GET /recruitement-alerts/:id/matching', () => {
    it('returns the candidates whose profile matches the job of the alert and the department', async () => {
      const matching = await usersHelper.createLoggedInUser(
        { role: UserRoles.CANDIDATE },
        {
          userProfile: {
            description: 'Plombier expérimenté',
            department: 'Paris (75)',
          },
        }
      );
      await usersHelper.createLoggedInUser(
        { role: UserRoles.CANDIDATE },
        { userProfile: { description: 'Cuisinier', department: 'Paris (75)' } }
      );
      await usersHelper.createLoggedInUser(
        { role: UserRoles.CANDIDATE },
        {
          userProfile: {
            description: 'Plombier aussi',
            department: 'Rhône (69)',
          },
        }
      );
      await usersHelper.createLoggedInUser(
        { role: UserRoles.COACH },
        { userProfile: { description: 'Plombier coach' } }
      );
      const alert = await alertFactory.create({
        name: 'Plumbers',
        jobName: 'Plombier',
        department: 'Paris (75)',
        companyId: company.id,
      });

      const response = await request(server)
        .get(`/recruitement-alerts/${alert.id}/matching`)
        .set(auth(owner));

      expect(response.status).toBe(200);
      expect(response.body.map((p: { id: string }) => p.id)).toEqual([
        matching.user.id,
      ]);
    });

    it('answers 404 for an unknown alert', async () => {
      const response = await request(server)
        .get(`/recruitement-alerts/${UNKNOWN_UUID}/matching`)
        .set(auth(owner));

      expect(response.status).toBe(404);
    });

    it('refuses an anonymous user', async () => {
      const response = await request(server).get(
        `/recruitement-alerts/${UNKNOWN_UUID}/matching`
      );

      expect(response.status).toBe(401);
    });
  });

  describe('service helpers', () => {
    it('lets the cron look at the matching of any alert without ownership check', async () => {
      const alert = await alertFactory.create({
        name: 'Plumbers',
        jobName: 'Plombier',
        companyId: company.id,
      });

      await expect(
        alertsService.getRecruitementAlertMatching(alert.id)
      ).resolves.toEqual([]);
    });

    it('updates the sectors and skills of an unknown alert with a not found error', async () => {
      await expect(
        alertsService.updateBusinessSectors(UNKNOWN_UUID, [])
      ).rejects.toThrow('not found');
      await expect(
        alertsService.updateSkills(UNKNOWN_UUID, [])
      ).rejects.toThrow('not found');
    });

    it('updates the sectors and skills in its own transaction when none is given', async () => {
      const sector = await businessSectorFactory.create({ name: 'Cuisine' });
      const skill = await skillFactory.create({ name: 'Cooking' });
      const alert = await alertFactory.create({
        name: 'Cooks',
        jobName: 'Cuisinier',
        companyId: company.id,
      });

      await alertsService.updateBusinessSectors(alert.id, [sector.id]);
      await alertsService.updateSkills(alert.id, [
        { value: skill.id, label: 'Cooking' },
      ]);

      const stored = await alertsService.findOne(alert.id);
      expect(stored.businessSectors).toHaveLength(1);
      expect(stored.skills).toHaveLength(1);
    });

    it('rolls its own transaction back when the update fails', async () => {
      const alert = await alertFactory.create({
        name: 'Cooks',
        jobName: 'Cuisinier',
        companyId: company.id,
      });

      await expect(
        alertsService.updateBusinessSectors(alert.id, [UNKNOWN_UUID])
      ).rejects.toThrow();
      await expect(
        alertsService.updateSkills(alert.id, [
          { value: UNKNOWN_UUID, label: 'Ghost' },
        ])
      ).rejects.toThrow();

      const stored = await alertsService.findOne(alert.id);
      expect(stored.businessSectors).toEqual([]);
      expect(stored.skills).toEqual([]);
    });

    it('records the notified candidates without duplicates', async () => {
      const alert = await alertFactory.create({
        name: 'Cooks',
        jobName: 'Cuisinier',
        companyId: company.id,
      });
      const first = await usersHelper.createLoggedInUser({
        role: UserRoles.CANDIDATE,
      });
      const second = await usersHelper.createLoggedInUser({
        role: UserRoles.CANDIDATE,
      });

      await alertsService.markUsersAsNotified(alert.id, [first.user.id]);
      await alertsService.markUsersAsNotified(alert.id, [
        first.user.id,
        second.user.id,
      ]);
      await alertsService.markUsersAsNotified(alert.id, []);

      const notified =
        await alertsService.findRecruitementAlertNotifiedCandidate(alert.id);
      expect(notified.map((n) => n.userId).sort()).toEqual(
        [first.user.id, second.user.id].sort()
      );
    });
  });
});
