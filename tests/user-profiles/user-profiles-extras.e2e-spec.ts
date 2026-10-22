import { randomUUID } from 'crypto';
import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/sequelize';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { LoggedInUser, UsersHelper } from '../users/users.helper';
import { S3Service } from 'src/external-services/aws/s3.service';
import { QueuesService } from 'src/queues/producers/queues.service';
import { UserProfile } from 'src/user-profiles/models';
import { Genders, UserRoles } from 'src/users/users.types';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import { S3Mocks } from 'tests/mocks.types';
import { QueuesServiceMock } from 'tests/queues/queues.service.mock';

// Complements tests/user-profiles/user-profiles.e2e-spec.ts: endpoints with no HTTP coverage so
// far (share text, completion, recommendations) and their role checks.
describe('UserProfiles - extras', () => {
  let app: INestApplication;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let server: any;
  let databaseHelper: DatabaseHelper;
  let usersHelper: UsersHelper;
  let userProfileModel: typeof UserProfile;

  let candidate: LoggedInUser;
  let coach: LoggedInUser;
  let referer: LoggedInUser;
  let admin: LoggedInUser;

  const asRole = [
    ['candidate', () => candidate],
    ['coach', () => coach],
    ['referer', () => referer],
    ['admin', () => admin],
  ] as const;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [CustomTestingModule],
    })
      .overrideProvider(QueuesService)
      .useClass(QueuesServiceMock)
      .overrideProvider(S3Service)
      .useValue(S3Mocks)
      .compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    server = app.getHttpServer();
    databaseHelper = moduleFixture.get(DatabaseHelper);
    usersHelper = moduleFixture.get(UsersHelper);
    userProfileModel = moduleFixture.get(getModelToken(UserProfile));
  });

  afterAll(async () => {
    await databaseHelper.resetTestDB();
    await app.close();
    server.close();
  });

  beforeEach(async () => {
    candidate = await usersHelper.createLoggedInUser(
      {
        role: UserRoles.CANDIDATE,
        firstName: 'Alice',
        gender: Genders.FEMALE,
      },
      { userProfile: { department: 'Paris (75)' } }
    );
    coach = await usersHelper.createLoggedInUser({ role: UserRoles.COACH });
    referer = await usersHelper.createLoggedInUser({ role: UserRoles.REFERER });
    admin = await usersHelper.createLoggedInUser({ role: UserRoles.ADMIN });
  });

  afterEach(async () => {
    await databaseHelper.resetTestDB();
  });

  describe('GET /user/profile/:userId/share-text', () => {
    it('returns 401 for an anonymous user', async () => {
      const response = await request(server).get(
        `/user/profile/${candidate.user.id}/share-text`
      );
      expect(response.status).toBe(401);
    });

    it.each(asRole)('returns the share text to a %s', async (_role, user) => {
      const response = await request(server)
        .get(`/user/profile/${candidate.user.id}/share-text`)
        .set('authorization', `Bearer ${user().token}`);

      expect(response.status).toBe(200);
      expect(response.body.text).toContain('Alice');
      expect(response.body.text).toContain('Entourage Pro');
      expect(response.body.text).toContain('Elle a tout pour réussir');
      expect(response.body.text).not.toContain('urn:li:organization');
    });

    it('mentions the LinkedIn organizations on the linkedin channel', async () => {
      const response = await request(server)
        .get(`/user/profile/${candidate.user.id}/share-text`)
        .query({ channel: 'linkedin' })
        .set('authorization', `Bearer ${coach.token}`);

      expect(response.status).toBe(200);
      expect(response.body.text).toContain('urn:li:organization:');
    });

    it('uses neutral wording when the candidate gender is male', async () => {
      const male = await usersHelper.createLoggedInUser({
        role: UserRoles.CANDIDATE,
        firstName: 'Bob',
        gender: Genders.MALE,
      });

      const response = await request(server)
        .get(`/user/profile/${male.user.id}/share-text`)
        .set('authorization', `Bearer ${coach.token}`);

      expect(response.status).toBe(200);
      expect(response.body.text).toContain('Il a tout pour réussir');
    });

    it('returns 404 for an unknown profile and 400 for a malformed id', async () => {
      const unknown = await request(server)
        .get(`/user/profile/${randomUUID()}/share-text`)
        .set('authorization', `Bearer ${candidate.token}`);
      expect(unknown.status).toBe(404);

      const malformed = await request(server)
        .get('/user/profile/not-a-uuid/share-text')
        .set('authorization', `Bearer ${candidate.token}`);
      expect(malformed.status).toBe(400);
    });
  });

  describe('GET /user/profile/completion', () => {
    it('returns 401 for an anonymous user', async () => {
      const response = await request(server).get('/user/profile/completion');
      expect(response.status).toBe(401);
    });

    it.each(asRole)(
      'returns a completion percentage to a %s',
      async (_role, user) => {
        const response = await request(server)
          .get('/user/profile/completion')
          .set('authorization', `Bearer ${user().token}`);

        expect(response.status).toBe(200);
        expect(Number(response.text)).toBeGreaterThanOrEqual(0);
        expect(Number(response.text)).toBeLessThanOrEqual(100);
      }
    );
  });

  describe('GET /user/profile/recommendations', () => {
    it('returns 401 for an anonymous user', async () => {
      const response = await request(server).get(
        '/user/profile/recommendations'
      );
      expect(response.status).toBe(401);
    });

    it('tells the client the embedding is pending without computing a pool', async () => {
      await userProfileModel.update(
        { embeddingPendingAt: new Date() },
        { where: { userId: candidate.user.id } }
      );

      const response = await request(server)
        .get('/user/profile/recommendations')
        .set('authorization', `Bearer ${candidate.token}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        embeddingPending: true,
        recommendations: [],
        nextCursor: null,
      });
    });

    it('returns 400 for a non numeric limit', async () => {
      const response = await request(server)
        .get('/user/profile/recommendations')
        .query({ limit: 'abc' })
        .set('authorization', `Bearer ${candidate.token}`);

      expect(response.status).toBe(400);
    });
  });

  describe('GET /user/profile/recommendations-ai/:userId (admin only)', () => {
    it('returns 401 for an anonymous user', async () => {
      const response = await request(server).get(
        `/user/profile/recommendations-ai/${candidate.user.id}`
      );
      expect(response.status).toBe(401);
    });

    it.each([
      ['candidate', () => candidate],
      ['coach', () => coach],
      ['referer', () => referer],
    ])('returns 403 for a %s', async (_role, user) => {
      const response = await request(server)
        .get(`/user/profile/recommendations-ai/${candidate.user.id}`)
        .set('authorization', `Bearer ${user().token}`);

      expect(response.status).toBe(403);
    });

    it('returns 404 to an admin for an unknown user and 400 for a malformed id', async () => {
      const unknown = await request(server)
        .get(`/user/profile/recommendations-ai/${randomUUID()}`)
        .set('authorization', `Bearer ${admin.token}`);
      expect(unknown.status).toBe(404);

      const malformed = await request(server)
        .get('/user/profile/recommendations-ai/not-a-uuid')
        .set('authorization', `Bearer ${admin.token}`);
      expect(malformed.status).toBe(400);
    });
  });

  describe('PUT /user/profile/:userId - experiences and formations with skills', () => {
    const put = (user: LoggedInUser, body: Record<string, unknown>) =>
      request(server)
        .put(`/user/profile/${user.user.id}`)
        .set('authorization', `Bearer ${user.token}`)
        .send(body);

    const skillNames = (items: { skills?: { name: string }[] }[]) =>
      items.flatMap(({ skills }) => (skills ?? []).map(({ name }) => name));

    it('creates experiences with their skills, then updates one and removes the other', async () => {
      const created = await put(candidate, {
        experiences: [
          {
            title: 'Cuisinier',
            company: 'Resto',
            description: 'Cuisine du jour',
            location: 'Paris',
            startDate: '2020-01-01',
            endDate: '2021-01-01',
            skills: [{ name: 'Cuisine' }, { name: 'Hygiène' }],
          },
          {
            title: 'Plongeur',
            company: 'Brasserie',
            description: 'Plonge',
            location: 'Lyon',
            startDate: '2018-01-01',
            endDate: '2019-01-01',
          },
        ],
      });

      expect(created.status).toBe(200);
      expect(created.body.experiences).toHaveLength(2);
      const cook = created.body.experiences.find(
        ({ title }: { title: string }) => title === 'Cuisinier'
      );
      expect(skillNames([cook]).sort()).toEqual(['Cuisine', 'Hygiène']);

      const updated = await put(candidate, {
        experiences: [
          {
            id: cook.id,
            title: 'Chef cuisinier',
            company: 'Resto',
            description: 'Cuisine du jour',
            location: 'Paris',
            startDate: '2020-01-01',
            endDate: '2021-01-01',
            skills: [{ name: 'Management' }],
          },
        ],
      });

      expect(updated.status).toBe(200);
      expect(updated.body.experiences).toHaveLength(1);
      expect(updated.body.experiences[0]).toMatchObject({
        id: cook.id,
        title: 'Chef cuisinier',
      });
      expect(skillNames(updated.body.experiences)).toEqual(['Management']);
    });

    it('creates formations with their skills, then updates and removes them', async () => {
      const created = await put(candidate, {
        formations: [
          {
            title: 'CAP Cuisine',
            institution: 'Lycée hôtelier',
            description: 'Formation initiale',
            location: 'Paris',
            startDate: '2015-09-01',
            endDate: '2017-06-30',
            skills: [{ name: 'Pâtisserie' }],
          },
        ],
      });

      expect(created.status).toBe(200);
      expect(created.body.formations).toHaveLength(1);
      expect(skillNames(created.body.formations)).toEqual(['Pâtisserie']);
      const formationId = created.body.formations[0].id;

      const updated = await put(candidate, {
        formations: [
          {
            id: formationId,
            title: 'CAP Cuisine et pâtisserie',
            institution: 'Lycée hôtelier',
            description: 'Formation initiale',
            location: 'Paris',
            startDate: '2015-09-01',
            endDate: '2017-06-30',
            skills: [],
          },
        ],
      });

      expect(updated.status).toBe(200);
      expect(updated.body.formations[0]).toMatchObject({
        id: formationId,
        title: 'CAP Cuisine et pâtisserie',
      });
      expect(skillNames(updated.body.formations)).toEqual([]);

      const emptied = await put(candidate, { formations: [] });
      expect(emptied.body.formations).toEqual([]);
    });
  });

  describe('Role checks on the other endpoints', () => {
    it('refuses anonymous users on the report and read endpoints', async () => {
      const report = await request(server)
        .post(`/user/profile/${candidate.user.id}/report`)
        .send({ reason: 'SPAM' });
      expect(report.status).toBe(401);

      const read = await request(server).get(
        `/user/profile/${candidate.user.id}`
      );
      expect(read.status).toBe(401);
    });

    it('returns 400 when reading a profile with a malformed id', async () => {
      const response = await request(server)
        .get('/user/profile/not-a-uuid')
        .set('authorization', `Bearer ${candidate.token}`);

      expect(response.status).toBe(400);
    });

    it('returns 400 for an unknown or referer role filter, and for a non UUID department', async () => {
      const unknownRole = await request(server)
        .get('/user/profile')
        .query({ limit: 5, offset: 0, role: 'nobody' })
        .set('authorization', `Bearer ${coach.token}`);
      expect(unknownRole.status).toBe(400);

      const badDepartment = await request(server)
        .get('/user/profile')
        .query({
          limit: 5,
          offset: 0,
          role: UserRoles.CANDIDATE,
          departments: 'not-a-uuid',
        })
        .set('authorization', `Bearer ${coach.token}`);
      expect(badDepartment.status).toBe(400);
    });
  });
});
