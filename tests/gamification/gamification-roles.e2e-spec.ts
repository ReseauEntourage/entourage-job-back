import { Server } from 'http';
import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/sequelize';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { S3Service } from 'src/external-services/aws/s3.service';
import { AchievementTypes } from 'src/gamification/config/achievements.config';
import { UserAchievement } from 'src/gamification/models';
import { QueuesService } from 'src/queues/producers/queues.service';
import { UserRoles } from 'src/users/users.types';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import { S3Mocks } from 'tests/mocks.types';
import { QueuesServiceMock } from 'tests/queues/queues.service.mock';
import { UsersHelper } from 'tests/users/users.helper';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

// Role matrix of the public certificate endpoint, which is reachable by anyone
// whatever their role (the other gamification endpoints are covered in
// gamification.e2e-spec.ts).
describe('Gamification - roles', () => {
  let app: INestApplication;
  let server: Server;
  let databaseHelper: DatabaseHelper;
  let usersHelper: UsersHelper;
  let achievementModel: typeof UserAchievement;

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
    achievementModel = moduleFixture.get(getModelToken(UserAchievement));
  });

  afterAll(async () => {
    await databaseHelper.resetTestDB();
    await app.close();
    server.close();
  });

  beforeEach(async () => {
    await databaseHelper.resetTestDB();
  });

  describe('GET /gamification/achievements/:achievementId/public', () => {
    const createCertificate = async () => {
      const coach = await usersHelper.createLoggedInUser({
        role: UserRoles.COACH,
      });
      const achievement = await achievementModel.create({
        userId: coach.user.id,
        achievementType: AchievementTypes.SUPER_ENGAGED_COACH,
        expireAt: new Date(Date.now() + 100 * DAY_IN_MS),
        active: true,
      });
      return achievement.id;
    };

    it('serves the certificate to an anonymous user', async () => {
      const achievementId = await createCertificate();

      const response = await request(server).get(
        `/gamification/achievements/${achievementId}/public`
      );

      expect(response.status).toBe(200);
    });

    it.each([
      UserRoles.CANDIDATE,
      UserRoles.COACH,
      UserRoles.REFERER,
      UserRoles.ADMIN,
    ])('serves the certificate to a logged in %s as well', async (role) => {
      const achievementId = await createCertificate();
      const user = await usersHelper.createLoggedInUser({ role });

      const response = await request(server)
        .get(`/gamification/achievements/${achievementId}/public`)
        .set('authorization', `Bearer ${user.token}`);

      expect(response.status).toBe(200);
    });
  });
});
