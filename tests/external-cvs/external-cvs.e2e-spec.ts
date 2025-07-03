import { getQueueToken } from '@nestjs/bull';
import { CACHE_MANAGER, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { UserProfilesHelper } from '../user-profiles/user-profiles.helper';
import { UsersHelper } from '../users/users.helper';
import { LoggedUser } from 'src/auth/auth.types';
import { ExternalCvsController } from 'src/external-cvs/external-cvs.controller';
import { S3Service } from 'src/external-services/aws/s3.service';
import { Queues } from 'src/queues/queues.types';
import { UserRoles } from 'src/users/users.types';
import { APIResponse } from 'src/utils/types';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import { CacheMocks, QueueMocks, S3Mocks } from 'tests/mocks.types';

describe('ExternalCvsController', () => {
  let app: INestApplication;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let server: any;

  let databaseHelper: DatabaseHelper;
  let usersHelper: UsersHelper;
  let userProfilesHelper: UserProfilesHelper;
  let loggedInCandidate: LoggedUser;
  let loggedInCandidateWithCv: LoggedUser;

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

    // Create a candidate with an external CV
    loggedInCandidateWithCv = await usersHelper.createLoggedInUser(
      { role: UserRoles.CANDIDATE },
      {
        userProfile: {
          hasExternalCv: true,
        },
      }
    );
  });

  describe('uploadExternalCV', () => {
    it('should successfully upload an external CV', async () => {
      const buffer = Buffer.from('PDFFileContent');
      const response: APIResponse<ExternalCvsController['uploadExternalCV']> =
        await request(server)
          .post(`/external-cv`)
          .set('authorization', `Bearer ${loggedInCandidate.token}`)
          .set('Content-Type', 'multipart/form-data')
          .attach('file', buffer, 'test.pdf');

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('url');
    });

    it('should fail to upload an external CV if no file was provided', async () => {
      const response: APIResponse<ExternalCvsController['uploadExternalCV']> =
        await request(server)
          .post(`/external-cv`)
          .set('authorization', `Bearer ${loggedInCandidate.token}`);

      expect(response.status).toBe(400);
    });
  });

  describe('findExternalCv', () => {
    it('should successfully find an external CV', async () => {
      const response: APIResponse<ExternalCvsController['findExternalCv']> =
        await request(server)
          .get(`/external-cv/${loggedInCandidateWithCv.user.id}`)
          .set('authorization', `Bearer ${loggedInCandidateWithCv.token}`);
      expect(response.body).toHaveProperty('url');
      expect(response.status).toBe(200);
    });

    it('should fail to find an external CV', async () => {
      const response: APIResponse<ExternalCvsController['findExternalCv']> =
        await request(server)
          .get(`/external-cv/${loggedInCandidate.user.id}`)
          .set('authorization', `Bearer ${loggedInCandidate.token}`);
      expect(response.status).toBe(404);
    });
  });

  describe('deleteExternalCv', () => {
    it('should successfully delete an external CV', async () => {
      // Delete the external CV
      const response: APIResponse<ExternalCvsController['deleteExternalCv']> =
        await request(server)
          .delete(`/external-cv`)
          .set('authorization', `Bearer ${loggedInCandidateWithCv.token}`);

      // Compute the user profile
      const profile = await userProfilesHelper.findOneProfileByUserId(
        loggedInCandidateWithCv.user.id
      );

      expect(response.status).toBe(200);
      expect(profile.hasExternalCv).toBe(false);
    });
  });
});
