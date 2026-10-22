import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { LoggedInUser, UsersHelper } from '../users/users.helper';
import { QueuesService } from 'src/queues/producers/queues.service';
import { UserProfileSharesModule } from 'src/user-profile-shares/user-profile-shares.module';
import { UserRoles } from 'src/users/users.types';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import { QueuesServiceMock } from 'tests/queues/queues.service.mock';

// UserProfileSharesModule is not part of CustomTestingModule, it is added to the test
// application here.
describe('UserProfileShares', () => {
  let app: INestApplication;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let server: any;
  let databaseHelper: DatabaseHelper;
  let usersHelper: UsersHelper;

  let candidate: LoggedInUser;
  let coach: LoggedInUser;
  let referer: LoggedInUser;
  let admin: LoggedInUser;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [CustomTestingModule, UserProfileSharesModule],
    })
      .overrideProvider(QueuesService)
      .useClass(QueuesServiceMock)
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
    candidate = await usersHelper.createLoggedInUser({
      role: UserRoles.CANDIDATE,
    });
    coach = await usersHelper.createLoggedInUser({ role: UserRoles.COACH });
    referer = await usersHelper.createLoggedInUser({ role: UserRoles.REFERER });
    admin = await usersHelper.createLoggedInUser({ role: UserRoles.ADMIN });
  });

  afterEach(async () => {
    await databaseHelper.resetTestDB();
  });

  describe('Anonymous users', () => {
    it('are refused on every endpoint', async () => {
      const id = candidate.user.id;
      const responses = [
        await request(server)
          .post(`/user/profile/${id}/shares`)
          .send({ channel: 'linkedin' }),
        await request(server).get(`/user/profile/${id}/shares`),
        await request(server).get('/user/shares/sent'),
      ];

      responses.forEach((response) => expect(response.status).toBe(401));
    });
  });

  describe('POST /user/profile/:profileUserId/shares', () => {
    it.each([
      ['coach', () => coach, 'linkedin'],
      ['referer', () => referer, 'whatsapp'],
      ['admin', () => admin, 'linkedin'],
      ['candidate', () => candidate, 'whatsapp'],
    ] as const)(
      'records a share made by a %s',
      async (_role, sharer, channel) => {
        const target =
          sharer() === candidate ? coach.user.id : candidate.user.id;

        const response = await request(server)
          .post(`/user/profile/${target}/shares`)
          .set('authorization', `Bearer ${sharer().token}`)
          .send({ channel, postUrl: 'https://linkedin.invalid/post/1' });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.shareId).toEqual(expect.any(String));
      }
    );

    it('returns 400 when the profile id is not a UUID', async () => {
      const response = await request(server)
        .post('/user/profile/not-a-uuid/shares')
        .set('authorization', `Bearer ${coach.token}`)
        .send({ channel: 'linkedin' });

      expect(response.status).toBe(400);
    });
  });

  describe('GET shares received / sent', () => {
    const share = (
      sharer: LoggedInUser,
      profileUserId: string,
      channel: string
    ) =>
      request(server)
        .post(`/user/profile/${profileUserId}/shares`)
        .set('authorization', `Bearer ${sharer.token}`)
        .send({ channel });

    it('lists the shares received by a profile, newest first', async () => {
      await share(coach, candidate.user.id, 'linkedin');
      await share(referer, candidate.user.id, 'whatsapp');
      await share(coach, admin.user.id, 'linkedin');

      const response = await request(server)
        .get(`/user/profile/${candidate.user.id}/shares`)
        .set('authorization', `Bearer ${candidate.token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body[0].channel).toBe('whatsapp');
      expect(response.body[0].sharingUserId).toBe(referer.user.id);
      expect(response.body[1].channel).toBe('linkedin');
    });

    it('lists only the shares sent by the current user', async () => {
      await share(coach, candidate.user.id, 'linkedin');
      await share(coach, admin.user.id, 'whatsapp');
      await share(referer, candidate.user.id, 'linkedin');

      const coachResponse = await request(server)
        .get('/user/shares/sent')
        .set('authorization', `Bearer ${coach.token}`);
      const candidateResponse = await request(server)
        .get('/user/shares/sent')
        .set('authorization', `Bearer ${candidate.token}`);

      expect(coachResponse.status).toBe(200);
      expect(coachResponse.body).toHaveLength(2);
      expect(
        coachResponse.body.every(
          ({ sharingUserId }: { sharingUserId: string }) =>
            sharingUserId === coach.user.id
        )
      ).toBe(true);
      expect(candidateResponse.body).toEqual([]);
    });

    it('returns 400 when listing the shares of a malformed profile id', async () => {
      const response = await request(server)
        .get('/user/profile/not-a-uuid/shares')
        .set('authorization', `Bearer ${coach.token}`);

      expect(response.status).toBe(400);
    });
  });
});
