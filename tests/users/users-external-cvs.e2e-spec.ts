import { getQueueToken } from '@nestjs/bull';
import { CACHE_MANAGER, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { LoggedUser } from 'src/auth/auth.types';
import { S3Service } from 'src/external-services/aws/s3.service';
import { Queues } from 'src/queues/queues.types';
import { UserExternalCvsController } from 'src/user-external-cvs/user-external-cvs.controller';
import { UserRoles } from 'src/users/users.types';
import { APIResponse } from 'src/utils/types';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import { CacheMocks, QueueMocks, S3Mocks } from 'tests/mocks.types';
import { UserExternalCvsHelper } from './user-external-cvs.helper';
import { UserProfilesHelper } from './user-profiles.helper';
import { UsersHelper } from './users.helper';

describe('UserExternalCvsController', () => {
  let app: INestApplication;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let server: any;

  let databaseHelper: DatabaseHelper;
  let usersHelper: UsersHelper;
  let userExternalCvsHelper: UserExternalCvsHelper;
  let userProfilesHelper: UserProfilesHelper;
  let loggedInCandidate: LoggedUser;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [CustomTestingModule],
    })
      .overrideProvider(getQueueToken(Queues.WORK))
      .useValue(QueueMocks)
      .overrideProvider(CACHE_MANAGER)
      .useValue(CacheMocks)
      .overrideProvider(S3Service)
      .useValue(S3Mocks)
      .compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    server = app.getHttpServer();

    databaseHelper = moduleFixture.get<DatabaseHelper>(DatabaseHelper);
    usersHelper = moduleFixture.get<UsersHelper>(UsersHelper);
    userProfilesHelper =
      moduleFixture.get<UserProfilesHelper>(UserProfilesHelper);
    userExternalCvsHelper = moduleFixture.get<UserExternalCvsHelper>(
      UserExternalCvsHelper
    );
  });

  afterAll(async () => {
    await databaseHelper.resetTestDB();
    await app.close();
    server.close();
  });

  beforeEach(async () => {
    await databaseHelper.resetTestDB();
    loggedInCandidate = await usersHelper.createLoggedInUser({
      role: UserRoles.CANDIDATE,
    });
  });

  describe('uploadExternalCV', () => {
    let testCvPath: string;

    beforeEach(async () => {
      testCvPath = userExternalCvsHelper.getTestImagePath();
    });

    it('should successfully upload an external CV', async () => {
      const response: APIResponse<
        UserExternalCvsController['uploadExternalCV']
      > = await request(server)
        .post(`/external-cv`)
        .set('authorization', `Token ${loggedInCandidate.token}`)
        .set('Content-Type', 'multipart/form-data')
        .attach('file', testCvPath);
      console.error(response);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('url');
    });

    it('should fail to upload an external CV if no file was provided', async () => {
      const response: APIResponse<
        UserExternalCvsController['uploadExternalCV']
      > = await request(server)
        .post(`/external-cv`)
        .set('authorization', `Token ${loggedInCandidate.token}`);

      expect(response.status).toBe(400);
    });
  });

  describe('findExternalCv', () => {
    it('should successfully find an external CV', async () => {
      const testCvPath = userExternalCvsHelper.getTestImagePath();
      await request(server)
        .post(`/external-cv`)
        .set('authorization', `Token ${loggedInCandidate.token}`)
        .attach('file', testCvPath);

      const response: APIResponse<UserExternalCvsController['findExternalCv']> =
        await request(server)
          .get(`/external-cv/${loggedInCandidate.user.id}`)
          .set('authorization', `Token ${loggedInCandidate.token}`);
      expect(response.body).toHaveProperty('url');
      expect(response.status).toBe(200);
    });

    it('should fail to find an external CV', async () => {
      const response: APIResponse<UserExternalCvsController['findExternalCv']> =
        await request(server)
          .get(`/external-cv/${loggedInCandidate.user.id}`)
          .set('authorization', `Token ${loggedInCandidate.token}`);
      expect(response.status).toBe(404);
    });
  });

  describe('deleteExternalCv', () => {
    it('should successfully delete an external CV', async () => {
      // Create the external CV to delete
      const testCvPath = userExternalCvsHelper.getTestImagePath();
      await request(server)
        .post(`/external-cv`)
        .set('authorization', `Token ${loggedInCandidate.token}`)
        .attach('file', testCvPath);

      // Delete the external CV
      const response: APIResponse<
        UserExternalCvsController['deleteExternalCv']
      > = await request(server)
        .delete(`/external-cv`)
        .set('authorization', `Token ${loggedInCandidate.token}`);

      // Compute the user profile
      const profile = await userProfilesHelper.findOneProfileByUserId(
        loggedInCandidate.user.id
      );

      expect(response.status).toBe(200);
      expect(profile.hasExternalCv).toBe(false);
    });
  });
});
