import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { UsersHelper, LoggedInUser } from '../users/users.helper';
import { ExternalCvsController } from 'src/external-cvs/external-cvs.controller';
import { S3Service } from 'src/external-services/aws/s3.service';
import { QueuesService } from 'src/queues/producers/queues.service';
import { UserRoles } from 'src/users/users.types';
import { UsersDeletionController } from 'src/users-deletion/users-deletion.controller';
import { APIResponse } from 'src/utils/types';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import { S3Mocks } from 'tests/mocks.types';
import { QueuesServiceMock } from 'tests/queues/queues.service.mock';
import { ExternalCvsHelper } from './external-cvs.helper';

describe('ExternalCvs', () => {
  let app: INestApplication;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let server: any;

  let databaseHelper: DatabaseHelper;
  let usersHelper: UsersHelper;
  let externalCvsHelper: ExternalCvsHelper;
  let loggedInCandidate: LoggedInUser;
  let loggedInCandidateWithCv: LoggedInUser;
  let candidateWithCvProfileId: string;

  const route = '/external-cv';

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

    databaseHelper = moduleFixture.get<DatabaseHelper>(DatabaseHelper);
    usersHelper = moduleFixture.get<UsersHelper>(UsersHelper);
    externalCvsHelper = moduleFixture.get<ExternalCvsHelper>(ExternalCvsHelper);
  });

  afterAll(async () => {
    await databaseHelper.resetTestDB();
    await app.close();
    server.close();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    await databaseHelper.resetTestDB();
    loggedInCandidate = await usersHelper.createLoggedInUser({
      role: UserRoles.CANDIDATE,
    });

    // Create a candidate with an already uploaded external CV
    loggedInCandidateWithCv = await usersHelper.createLoggedInUser({
      role: UserRoles.CANDIDATE,
    });
    candidateWithCvProfileId = loggedInCandidateWithCv.user.userProfile.id;
    await externalCvsHelper.createExternalCv(
      candidateWithCvProfileId,
      loggedInCandidateWithCv.user.id,
      // Explicit dates keep the "most recent version" ordering deterministic
      { createdAt: new Date('2026-01-01T00:00:00Z') }
    );
  });

  describe('uploadExternalCV', () => {
    it('should successfully upload an external CV', async () => {
      const buffer = Buffer.from('PDFFileContent');
      const response: APIResponse<ExternalCvsController['uploadExternalCV']> =
        await request(server)
          .post(`${route}`)
          .set('authorization', `Bearer ${loggedInCandidate.token}`)
          .set('Content-Type', 'multipart/form-data')
          .attach('file', buffer, 'test.pdf');

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('url');

      const externalCvs = await externalCvsHelper.findExternalCvs(
        loggedInCandidate.user.userProfile.id
      );
      expect(externalCvs).toHaveLength(1);

      const media = await externalCvsHelper.findMedia(externalCvs[0].mediaId);
      expect(media.deletedAt).toBeFalsy();
      expect(media.s3Key).toContain(
        `external-cvs/${loggedInCandidate.user.id}`
      );
    });

    it('should fail to upload an external CV if no file was provided', async () => {
      const response: APIResponse<ExternalCvsController['uploadExternalCV']> =
        await request(server)
          .post(`${route}`)
          .set('authorization', `Bearer ${loggedInCandidate.token}`);

      expect(response.status).toBe(400);
    });

    it('should keep the previous version untouched when uploading a new CV', async () => {
      const [previousExternalCv] = await externalCvsHelper.findExternalCvs(
        candidateWithCvProfileId
      );

      const buffer = Buffer.from('PDFFileContent');
      const response: APIResponse<ExternalCvsController['uploadExternalCV']> =
        await request(server)
          .post(`${route}`)
          .set('authorization', `Bearer ${loggedInCandidateWithCv.token}`)
          .set('Content-Type', 'multipart/form-data')
          .attach('file', buffer, 'test.pdf');

      expect(response.status).toBe(201);

      const externalCvs = await externalCvsHelper.findExternalCvs(
        candidateWithCvProfileId
      );
      expect(externalCvs).toHaveLength(2);

      // The previous link is still active and still points at its own media
      const stillThere = externalCvs.find(
        ({ id }) => id === previousExternalCv.id
      );
      expect(stillThere).toBeTruthy();
      expect(stillThere.deletedAt).toBeFalsy();
      expect(stillThere.mediaId).toBe(previousExternalCv.mediaId);

      const previousMedia = await externalCvsHelper.findMedia(
        previousExternalCv.mediaId
      );
      expect(previousMedia.deletedAt).toBeFalsy();

      // Both versions are distinct S3 objects
      const mediaIds = externalCvs.map(({ mediaId }) => mediaId);
      expect(new Set(mediaIds).size).toBe(2);
      expect(S3Mocks.deleteFiles).not.toHaveBeenCalled();
    });
  });

  describe('findExternalCv', () => {
    it('should successfully find an external CV', async () => {
      const response: APIResponse<ExternalCvsController['findExternalCv']> =
        await request(server)
          .get(`${route}/${loggedInCandidateWithCv.user.id}`)
          .set('authorization', `Bearer ${loggedInCandidateWithCv.token}`);
      expect(response.body).toHaveProperty('url');
      expect(response.status).toBe(200);
    });

    it('should fail to find an external CV', async () => {
      const response: APIResponse<ExternalCvsController['findExternalCv']> =
        await request(server)
          .get(`${route}/${loggedInCandidate.user.id}`)
          .set('authorization', `Bearer ${loggedInCandidate.token}`);
      expect(response.status).toBe(404);
    });

    it('should resolve the most recent non-deleted version as the current CV', async () => {
      const latest = await externalCvsHelper.createExternalCv(
        candidateWithCvProfileId,
        loggedInCandidateWithCv.user.id,
        { createdAt: new Date('2026-06-01T00:00:00Z') }
      );
      const latestMedia = await externalCvsHelper.findMedia(latest.mediaId);

      const response: APIResponse<ExternalCvsController['findExternalCv']> =
        await request(server)
          .get(`${route}/${loggedInCandidateWithCv.user.id}`)
          .set('authorization', `Bearer ${loggedInCandidateWithCv.token}`);

      expect(response.status).toBe(200);
      expect(S3Mocks.getSignedUrl).toHaveBeenCalledWith(
        latestMedia.s3Key,
        'application/pdf',
        expect.stringContaining('attachment')
      );
    });

    it('should report no current CV when the latest link lost its media, never falling back to an older version', async () => {
      const [previous] = await externalCvsHelper.findExternalCvs(
        candidateWithCvProfileId
      );
      const previousMedia = await externalCvsHelper.findMedia(previous.mediaId);

      const latest = await externalCvsHelper.createExternalCv(
        candidateWithCvProfileId,
        loggedInCandidateWithCv.user.id,
        { createdAt: new Date('2026-06-01T00:00:00Z') }
      );
      // Broken cascade: the file is gone but the link is still active
      await externalCvsHelper.deleteMedia(latest.mediaId);

      const response: APIResponse<ExternalCvsController['findExternalCv']> =
        await request(server)
          .get(`${route}/${loggedInCandidateWithCv.user.id}`)
          .set('authorization', `Bearer ${loggedInCandidateWithCv.token}`);

      expect(response.status).toBe(404);
      // The still-live older version must not resurface
      expect(S3Mocks.getSignedUrl).not.toHaveBeenCalledWith(
        previousMedia.s3Key,
        expect.anything(),
        expect.anything()
      );
    });

    it('should serve the file back under its original name', async () => {
      await externalCvsHelper.createExternalCv(
        candidateWithCvProfileId,
        loggedInCandidateWithCv.user.id,
        {
          createdAt: new Date('2026-06-01T00:00:00Z'),
          name: 'CV Élodie Dupont.pdf',
        }
      );

      const response: APIResponse<ExternalCvsController['findExternalCv']> =
        await request(server)
          .get(`${route}/${loggedInCandidateWithCv.user.id}`)
          .set('authorization', `Bearer ${loggedInCandidateWithCv.token}`);

      expect(response.status).toBe(200);
      // ASCII fallback + RFC 5987 form, so the accent survives
      expect(S3Mocks.getSignedUrl).toHaveBeenCalledWith(
        expect.any(String),
        'application/pdf',
        `attachment; filename="CV _lodie Dupont.pdf"; filename*=UTF-8''CV%20%C3%89lodie%20Dupont.pdf`
      );
    });
  });

  describe('deleteExternalCv', () => {
    it('should successfully delete an external CV', async () => {
      const response: APIResponse<ExternalCvsController['deleteExternalCv']> =
        await request(server)
          .delete(`${route}`)
          .set('authorization', `Bearer ${loggedInCandidateWithCv.token}`);

      expect(response.status).toBe(200);

      const activeExternalCvs = await externalCvsHelper.findExternalCvs(
        candidateWithCvProfileId
      );
      expect(activeExternalCvs).toHaveLength(0);

      const profileResponse = await request(server)
        .get('/current/profile')
        .set('authorization', `Bearer ${loggedInCandidateWithCv.token}`);
      expect(profileResponse.body.hasExternalCv).toBe(false);
    });

    it('should soft-delete every version and leave S3 and the medias untouched', async () => {
      await externalCvsHelper.createExternalCv(
        candidateWithCvProfileId,
        loggedInCandidateWithCv.user.id,
        { createdAt: new Date('2026-06-01T00:00:00Z') }
      );

      const response: APIResponse<ExternalCvsController['deleteExternalCv']> =
        await request(server)
          .delete(`${route}`)
          .set('authorization', `Bearer ${loggedInCandidateWithCv.token}`);

      expect(response.status).toBe(200);

      const allExternalCvs = await externalCvsHelper.findExternalCvs(
        candidateWithCvProfileId,
        { withDeleted: true }
      );
      expect(allExternalCvs).toHaveLength(2);
      allExternalCvs.forEach((externalCv) => {
        expect(externalCv.deletedAt).toBeTruthy();
      });

      for (const { mediaId } of allExternalCvs) {
        const media = await externalCvsHelper.findMedia(mediaId);
        expect(media.deletedAt).toBeFalsy();
      }
      expect(S3Mocks.deleteFiles).not.toHaveBeenCalled();
    });
  });

  describe('hasExternalCv in the profile DTO', () => {
    it('should be true for a candidate with a current CV', async () => {
      const response = await request(server)
        .get('/current/profile')
        .set('authorization', `Bearer ${loggedInCandidateWithCv.token}`);

      expect(response.status).toBe(200);
      expect(response.body.hasExternalCv).toBe(true);
    });

    it('should be false for a candidate without any CV', async () => {
      const response = await request(server)
        .get('/current/profile')
        .set('authorization', `Bearer ${loggedInCandidate.token}`);

      expect(response.status).toBe(200);
      expect(response.body.hasExternalCv).toBe(false);
    });
  });

  describe('account deletion', () => {
    it('should delete every CV file from S3 and soft-delete both sides', async () => {
      const loggedInAdmin = await usersHelper.createLoggedInUser({
        role: UserRoles.ADMIN,
      });

      // A removed CV whose file is still in S3, plus a current one
      const removed = await externalCvsHelper.createExternalCv(
        candidateWithCvProfileId,
        loggedInCandidateWithCv.user.id,
        { deletedAt: new Date() }
      );
      const [current] = await externalCvsHelper.findExternalCvs(
        candidateWithCvProfileId
      );
      const removedMedia = await externalCvsHelper.findMedia(removed.mediaId);
      const currentMedia = await externalCvsHelper.findMedia(current.mediaId);

      const response: APIResponse<UsersDeletionController['removeUser']> =
        await request(server)
          .delete(`/user/${loggedInCandidateWithCv.user.id}`)
          .set('authorization', `Bearer ${loggedInAdmin.token}`);

      expect(response.status).toBe(200);

      const deletedKeys = (S3Mocks.deleteFiles as jest.Mock).mock.calls.flat(2);
      expect(deletedKeys).toEqual(
        expect.arrayContaining([removedMedia.s3Key, currentMedia.s3Key])
      );

      for (const mediaId of [removed.mediaId, current.mediaId]) {
        const media = await externalCvsHelper.findMedia(mediaId);
        expect(media.deletedAt).toBeTruthy();
      }

      const allExternalCvs = await externalCvsHelper.findExternalCvs(
        candidateWithCvProfileId,
        { withDeleted: true }
      );
      expect(allExternalCvs).toHaveLength(2);
      allExternalCvs.forEach((externalCv) => {
        expect(externalCv.deletedAt).toBeTruthy();
      });
    });

    it('should not call S3 for a user without any CV', async () => {
      const loggedInAdmin = await usersHelper.createLoggedInUser({
        role: UserRoles.ADMIN,
      });

      const response: APIResponse<UsersDeletionController['removeUser']> =
        await request(server)
          .delete(`/user/${loggedInCandidate.user.id}`)
          .set('authorization', `Bearer ${loggedInAdmin.token}`);

      expect(response.status).toBe(200);
      // Only the legacy generated-CV cleanup, never a CV media batch delete
      const deletedKeys = (S3Mocks.deleteFiles as jest.Mock).mock.calls.flat(2);
      expect(
        deletedKeys.filter((key: string) => key.includes('external-cvs/'))
      ).toHaveLength(0);
    });
  });
});
