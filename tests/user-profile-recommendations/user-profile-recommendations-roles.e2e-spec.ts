import { Server } from 'http';
import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/sequelize';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { S3Service } from 'src/external-services/aws/s3.service';
import { QueuesService } from 'src/queues/producers/queues.service';
import { UserProfileRecommendationsService } from 'src/user-profile-recommendations/user-profile-recommendations-ai.service';
import { UserProfile } from 'src/user-profiles/models';
import { UserRoles } from 'src/users/users.types';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import { S3Mocks } from 'tests/mocks.types';
import { QueuesServiceMock } from 'tests/queues/queues.service.mock';
import { UsersHelper } from 'tests/users/users.helper';

// Role matrix of the two recommendation endpoints (served by the user profiles
// controller). The scoring itself is covered by the other specs of this folder.
describe('User profile recommendations - roles', () => {
  let app: INestApplication;
  let server: Server;
  let databaseHelper: DatabaseHelper;
  let usersHelper: UsersHelper;
  let userProfileModel: typeof UserProfile;
  let recommendationsService: UserProfileRecommendationsService;

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
    recommendationsService = moduleFixture.get(
      UserProfileRecommendationsService
    );
  });

  afterAll(async () => {
    await databaseHelper.resetTestDB();
    await app.close();
    server.close();
  });

  beforeEach(async () => {
    await databaseHelper.resetTestDB();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('GET /user/profile/recommendations', () => {
    it('refuses an anonymous user', async () => {
      const response = await request(server).get(
        '/user/profile/recommendations'
      );

      expect(response.status).toBe(401);
    });

    it.each([
      UserRoles.CANDIDATE,
      UserRoles.COACH,
      UserRoles.REFERER,
      UserRoles.ADMIN,
    ])('answers a %s about their own recommendations', async (role) => {
      const user = await usersHelper.createLoggedInUser({ role });
      // A pending embedding short-circuits the pool computation
      await userProfileModel.update(
        { embeddingPendingAt: new Date() },
        { where: { userId: user.user.id } }
      );

      const response = await request(server)
        .get('/user/profile/recommendations')
        .set('authorization', `Bearer ${user.token}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        embeddingPending: true,
        recommendations: [],
        nextCursor: null,
      });
    });
  });

  describe('GET /user/profile/recommendations-ai/:userId', () => {
    it('refuses an anonymous user', async () => {
      const candidate = await usersHelper.createLoggedInUser({
        role: UserRoles.CANDIDATE,
      });

      const response = await request(server).get(
        `/user/profile/recommendations-ai/${candidate.user.id}`
      );

      expect(response.status).toBe(401);
    });

    it.each([UserRoles.CANDIDATE, UserRoles.COACH, UserRoles.REFERER])(
      'refuses a %s, even for their own profile',
      async (role) => {
        const user = await usersHelper.createLoggedInUser({ role });
        const spy = jest.spyOn(
          recommendationsService,
          'retrieveOrComputeRecommendationsForUserIdIA'
        );

        const response = await request(server)
          .get(`/user/profile/recommendations-ai/${user.user.id}`)
          .set('authorization', `Bearer ${user.token}`);

        expect(response.status).toBe(403);
        expect(spy).not.toHaveBeenCalled();
      }
    );

    it('lets an admin read the recommendations of any user', async () => {
      const admin = await usersHelper.createLoggedInUser({
        role: UserRoles.ADMIN,
      });
      const candidate = await usersHelper.createLoggedInUser({
        role: UserRoles.CANDIDATE,
      });
      // The AI scoring is not what is under test here
      const spy = jest
        .spyOn(
          recommendationsService,
          'retrieveOrComputeRecommendationsForUserIdIA'
        )
        .mockResolvedValue([]);

      const response = await request(server)
        .get(`/user/profile/recommendations-ai/${candidate.user.id}`)
        .set('authorization', `Bearer ${admin.token}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ id: candidate.user.id }),
        expect.anything(),
        3
      );
    });
  });
});
