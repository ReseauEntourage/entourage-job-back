import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/sequelize';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { SlackService } from 'src/external-services/slack/slack.service';
import { QueuesService } from 'src/queues/producers/queues.service';
import { Jobs } from 'src/queues/queues.types';
import { Report, ReportSlackMessage } from 'src/reports/models';
import {
  ReportReasons,
  ReportStatuses,
  ReportTargetTypes,
} from 'src/reports/reports.types';
import { UserRoles } from 'src/users/users.types';
import { ZoneName } from 'src/utils/types/zones.types';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import { QueuesServiceMock } from 'tests/queues/queues.service.mock';
import { UserFactory } from 'tests/users/user.factory';
import { LoggedInUser, UsersHelper } from 'tests/users/users.helper';

const COACH_REFERENT_SLACK_EMAIL = 'referent-coachs@entourage.test';

describe('User profiles - Report', () => {
  let app: INestApplication;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let server: any;

  let databaseHelper: DatabaseHelper;
  let usersHelper: UsersHelper;
  let userFactory: UserFactory;
  let queuesService: QueuesService;
  let reportModel: typeof Report;
  let slackService: SlackService;
  let sendMessage: jest.SpyInstance;

  let reporter: LoggedInUser;
  let reported: LoggedInUser;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [CustomTestingModule],
    })
      .overrideProvider(QueuesService)
      .useClass(QueuesServiceMock)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    server = app.getHttpServer();

    databaseHelper = moduleFixture.get(DatabaseHelper);
    usersHelper = moduleFixture.get(UsersHelper);
    userFactory = moduleFixture.get(UserFactory);
    queuesService = moduleFixture.get(QueuesService);
    reportModel = moduleFixture.get(getModelToken(Report));
    slackService = moduleFixture.get(SlackService);
  });

  afterAll(async () => {
    await databaseHelper.resetTestDB();
    await app.close();
    server.close();
  });

  beforeEach(async () => {
    jest.restoreAllMocks();
    sendMessage = jest
      .spyOn(slackService, 'sendMessage')
      .mockResolvedValue({ ok: true });
    jest
      .spyOn(slackService, 'getUserIdByEmail')
      .mockImplementation(async (email) =>
        email === COACH_REFERENT_SLACK_EMAIL ? 'U_COACHES' : null
      );
    await databaseHelper.resetTestDB();
    reporter = await usersHelper.createLoggedInUser({
      role: UserRoles.CANDIDATE,
      zone: ZoneName.IDF,
    });
    reported = await usersHelper.createLoggedInUser({
      role: UserRoles.COACH,
      zone: ZoneName.AURA,
    });
  });

  afterEach(() => {
    delete process.env.STAFF_CONTACT_COACH_SLACK_EMAIL_LYON;
  });

  // The Slack blocks of the moderation message, as text
  const sentSlackMessage = () => JSON.stringify(sendMessage.mock.calls[0][1]);

  const report = (
    userId = reported.user.id,
    body: object = { reason: ReportReasons.SPAM },
    user = reporter
  ) =>
    request(server)
      .post(`/user/profile/${userId}/report`)
      .set('authorization', `Bearer ${user.token}`)
      .send(body);

  it('Should save the report without comment, with the zone of the reported person', async () => {
    const response = await report();

    expect(response.status).toBe(201);
    const reports = await reportModel.findAll();
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({
      targetType: ReportTargetTypes.USER_PROFILE,
      targetId: reported.user.id,
      reporterId: reporter.user.id,
      reason: ReportReasons.SPAM,
      comment: null,
      status: ReportStatuses.PENDING,
      zone: ZoneName.AURA,
    });
    expect(response.body).toEqual({ id: reports[0].id });
  });

  it('Should save the report of a person without zone in « Hors zone »', async () => {
    const withoutZone = await usersHelper.createLoggedInUser({
      role: UserRoles.COACH,
      zone: null,
    });

    expect((await report(withoutZone.user.id)).status).toBe(201);
    const [saved] = await reportModel.findAll();
    expect(saved.zone).toBe(ZoneName.HZ);
  });

  it('Should refuse the report of one’s own profile with a 403', async () => {
    const response = await report(reporter.user.id);
    expect(response.status).toBe(403);
    expect(await reportModel.count()).toBe(0);
  });

  it('Should refuse the report of a missing or deleted profile with a 404', async () => {
    const deleted = await usersHelper.createLoggedInUser({
      role: UserRoles.COACH,
    });
    await userFactory.delete(deleted.user.id);

    expect((await report('5b3b0a34-8b4e-4d2a-9b1e-2d5c3c0f9a11')).status).toBe(
      404
    );
    expect((await report(deleted.user.id)).status).toBe(404);
    expect(await reportModel.count()).toBe(0);
  });

  it('Should refuse a second report while the first is still to handle with a 409, then accept it once handled', async () => {
    expect((await report()).status).toBe(201);
    expect((await report()).status).toBe(409);
    expect(await reportModel.count()).toBe(1);

    await reportModel.update(
      { status: ReportStatuses.RESOLVED },
      { where: {} }
    );
    expect((await report()).status).toBe(201);
    expect(await reportModel.count()).toBe(2);
  });

  it('Should refuse a missing or unknown motive, and a too long comment, with a 400', async () => {
    expect((await report(undefined, { comment: 'Sans motif' })).status).toBe(
      400
    );
    expect((await report(undefined, { reason: 'Motif libre' })).status).toBe(
      400
    );
    expect(
      (
        await report(undefined, {
          reason: ReportReasons.SPAM,
          comment: 'a'.repeat(1001),
        })
      ).status
    ).toBe(400);
    expect(await reportModel.count()).toBe(0);
  });

  it('Should accept the report of a person without referent', async () => {
    const response = await report(undefined, {
      reason: ReportReasons.INSULTS,
      comment: 'Propos déplacés',
    });

    expect(response.status).toBe(201);
    expect(await reportModel.count()).toBe(1);
    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sentSlackMessage()).toContain('Aucun référent assigné');
  });

  it('Should alert Slack with the motive, the link to the page of the report and the referent, and send no email', async () => {
    process.env.STAFF_CONTACT_COACH_SLACK_EMAIL_LYON =
      COACH_REFERENT_SLACK_EMAIL;
    const addToWorkQueue = jest.spyOn(queuesService, 'addToWorkQueue');

    const response = await report(undefined, {
      reason: ReportReasons.FRAUD,
      comment: 'Fausse offre',
    });

    expect(response.status).toBe(201);
    const message = sentSlackMessage();
    expect(message).toContain('Raison du signalement : Arnaque');
    expect(message).toContain('Commentaire : Fausse offre');
    expect(message).toContain('<@U_COACHES>');
    expect(message).toContain('Voir la fiche');
    expect(message).toContain(
      `${process.env.FRONT_URL}/backoffice/admin/signalements/USER_PROFILE/${reported.user.id}`
    );
    // The action of an admin on a reported profile: closing it
    expect(message).toContain('Marquer comme traité');
    expect(message).toContain(
      `${process.env.FRONT_URL}/backoffice/admin/signalements/USER_PROFILE/${reported.user.id}?action=resolve`
    );
    expect(addToWorkQueue).not.toHaveBeenCalledWith(
      Jobs.SEND_MAIL,
      expect.anything()
    );
    addToWorkQueue.mockRestore();
  });

  it('Should save the report even when Slack fails', async () => {
    sendMessage.mockRejectedValueOnce(new Error('Slack down'));

    const response = await report();

    expect(response.status).toBe(201);
    expect(await reportModel.count()).toBe(1);
  });

  it('Should mark the Slack alert as handled once an admin closes the profile', async () => {
    const slackMessageModel = app.get<typeof ReportSlackMessage>(
      getModelToken(ReportSlackMessage)
    );
    // No foreign key to Users: not emptied by the reset of the test DB
    await slackMessageModel.truncate();
    sendMessage.mockResolvedValue({
      ok: true,
      channel: 'C_MODERATION',
      ts: '200.1',
    });
    const markHandled = jest
      .spyOn(slackService, 'markModerationAlertHandled')
      .mockResolvedValue();
    const admin = await usersHelper.createLoggedInUser({
      role: UserRoles.ADMIN,
    });

    expect((await report()).status).toBe(201);
    expect(await slackMessageModel.count()).toBe(1);
    const response = await request(server)
      .post(`/admin/reports/targets/USER_PROFILE/${reported.user.id}/resolve`)
      .set('authorization', `Bearer ${admin.token}`)
      .send({});
    expect(response.status).toBe(201);

    const start = Date.now();
    while (markHandled.mock.calls.length === 0 && Date.now() - start < 5000) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    expect(markHandled).toHaveBeenCalledTimes(1);
    const [[message, status]] = markHandled.mock.calls;
    expect(message).toMatchObject({ channel: 'C_MODERATION', ts: '200.1' });
    expect(status).toContain('✅ *Traité* par');
    expect(status).toContain('marqué comme traité');
  });
});
