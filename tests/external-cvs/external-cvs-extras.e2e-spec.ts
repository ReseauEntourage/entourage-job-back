import { randomUUID } from 'crypto';
import { INestApplication, InternalServerErrorException } from '@nestjs/common';
import { getModelToken } from '@nestjs/sequelize';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { ExternalCvsService } from 'src/external-cvs/external-cvs.service';
import { ExtractedCVData } from 'src/external-cvs/models/extracted-cv-data.model';
import { S3Service } from 'src/external-services/aws/s3.service';
import { Media } from 'src/medias/models';
import { QueuesService } from 'src/queues/producers/queues.service';
import { UserRoles } from 'src/users/users.types';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import { S3Mocks } from 'tests/mocks.types';
import { QueuesServiceMock } from 'tests/queues/queues.service.mock';
import { LoggedInUser, UsersHelper } from 'tests/users/users.helper';
import { ExternalCvsHelper } from './external-cvs.helper';

// Complements tests/external-cvs/external-cvs.e2e-spec.ts: anonymous access, role matrix on
// the read endpoint and the defensive paths of ExternalCvsService.
describe('ExternalCvs - extras', () => {
  let app: INestApplication;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let server: any;
  let databaseHelper: DatabaseHelper;
  let usersHelper: UsersHelper;
  let externalCvsHelper: ExternalCvsHelper;
  let externalCvsService: ExternalCvsService;
  let extractedCVDataModel: typeof ExtractedCVData;

  let candidate: LoggedInUser;
  let coach: LoggedInUser;
  let referer: LoggedInUser;
  let admin: LoggedInUser;

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
    databaseHelper = moduleFixture.get(DatabaseHelper);
    usersHelper = moduleFixture.get(UsersHelper);
    externalCvsHelper = moduleFixture.get(ExternalCvsHelper);
    externalCvsService = app.get(ExternalCvsService);
    extractedCVDataModel = moduleFixture.get(getModelToken(ExtractedCVData));
  });

  afterAll(async () => {
    await databaseHelper.resetTestDB();
    await app.close();
    server.close();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    await databaseHelper.resetTestDB();
    candidate = await usersHelper.createLoggedInUser({
      role: UserRoles.CANDIDATE,
    });
    coach = await usersHelper.createLoggedInUser({ role: UserRoles.COACH });
    referer = await usersHelper.createLoggedInUser({ role: UserRoles.REFERER });
    admin = await usersHelper.createLoggedInUser({ role: UserRoles.ADMIN });
  });

  afterEach(() => jest.restoreAllMocks());

  describe('Anonymous access', () => {
    it('is refused on the three endpoints', async () => {
      const upload = await request(server)
        .post(route)
        .attach('file', Buffer.from('PDF'), 'cv.pdf');
      const read = await request(server).get(`${route}/${candidate.user.id}`);
      const remove = await request(server).delete(route);

      expect([upload.status, read.status, remove.status]).toEqual([
        401, 401, 401,
      ]);
    });
  });

  describe('GET /external-cv/:userId', () => {
    it.each([
      ['candidate', () => candidate],
      ['coach', () => coach],
      ['referer', () => referer],
      ['admin', () => admin],
    ])('lets a %s read the CV of a candidate', async (_role, viewer) => {
      await externalCvsHelper.createExternalCv(
        candidate.user.userProfile.id,
        candidate.user.id
      );

      const response = await request(server)
        .get(`${route}/${candidate.user.id}`)
        .set('authorization', `Bearer ${viewer().token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('url');
    });

    it('returns 404 when the candidate has no CV', async () => {
      const response = await request(server)
        .get(`${route}/${candidate.user.id}`)
        .set('authorization', `Bearer ${coach.token}`);

      expect(response.status).toBe(404);
    });

    it('answers a null url when the file disappeared from S3', async () => {
      await externalCvsHelper.createExternalCv(
        candidate.user.userProfile.id,
        candidate.user.id
      );
      S3Mocks.getHead.mockResolvedValueOnce(null);

      const response = await request(server)
        .get(`${route}/${candidate.user.id}`)
        .set('authorization', `Bearer ${coach.token}`);

      expect(response.status).toBe(200);
      expect(response.body.url).toBeNull();
    });
  });

  describe('DELETE /external-cv', () => {
    it.each([
      ['coach', () => coach],
      ['referer', () => referer],
      ['admin', () => admin],
    ])(
      'does not touch the CV of a candidate when called by a %s',
      async (_role, user) => {
        await externalCvsHelper.createExternalCv(
          candidate.user.userProfile.id,
          candidate.user.id
        );

        const response = await request(server)
          .delete(route)
          .set('authorization', `Bearer ${user().token}`);

        expect(response.status).toBe(200);
        expect(
          await externalCvsHelper.findExternalCvs(candidate.user.userProfile.id)
        ).toHaveLength(1);
      }
    );
  });

  describe('ExternalCvsService', () => {
    it('returns no CV for a user without profile', async () => {
      expect(
        await externalCvsService.findCurrentExternalCvByUserId(randomUUID())
      ).toBeNull();
    });

    it('does nothing when deleting the CVs of a user without profile', async () => {
      await expect(
        externalCvsService.deleteExternalCv(randomUUID())
      ).resolves.toBeUndefined();
      await expect(
        externalCvsService.deleteAllExternalCvsForUser(randomUUID())
      ).resolves.toBeUndefined();
      expect(S3Mocks.deleteFiles).not.toHaveBeenCalled();
    });

    describe('account deletion', () => {
      const createExtractedData = (userProfileId: string) =>
        extractedCVDataModel.create({
          userProfileId,
          data: { description: 'extracted' },
          fileHash: 'hash',
          schemaVersion: 7,
          transcript: '# Experience\nCook',
          transcriptVersion: 1,
        });

      it('deletes the data extracted from the CV, and the text read from it, with the CV', async () => {
        await externalCvsHelper.createExternalCv(
          candidate.user.userProfile.id,
          candidate.user.id
        );
        await createExtractedData(candidate.user.userProfile.id);

        await externalCvsService.deleteAllExternalCvsForUser(candidate.user.id);

        expect(
          await extractedCVDataModel.count({
            where: { userProfileId: candidate.user.userProfile.id },
          })
        ).toBe(0);
        expect(S3Mocks.deleteFiles).toHaveBeenCalled();
      });

      it('deletes them even when the profile has no CV left', async () => {
        await createExtractedData(candidate.user.userProfile.id);

        await externalCvsService.deleteAllExternalCvsForUser(candidate.user.id);

        expect(
          await extractedCVDataModel.count({
            where: { userProfileId: candidate.user.userProfile.id },
          })
        ).toBe(0);
      });

      it("keeps the extracted data of another user's profile", async () => {
        await createExtractedData(coach.user.userProfile.id);

        await externalCvsService.deleteAllExternalCvsForUser(candidate.user.id);

        expect(
          await extractedCVDataModel.count({
            where: { userProfileId: coach.user.userProfile.id },
          })
        ).toBe(1);
      });
    });

    it('has no signed url without media, and none when S3 fails', async () => {
      expect(await externalCvsService.getExternalCvSignedUrl(null)).toBeNull();

      S3Mocks.getHead.mockRejectedValueOnce(new Error('s3 down'));
      expect(
        await externalCvsService.getExternalCvSignedUrl({
          s3Key: 'key.pdf',
          name: 'cv.pdf',
        } as Media)
      ).toBeNull();
    });

    it('refuses to upload a CV for a user without profile and removes the temporary file', async () => {
      const fs = await import('fs');
      const os = await import('os');
      const path = await import('path');
      const temporaryFile = path.join(os.tmpdir(), `cv-${randomUUID()}.pdf`);
      fs.writeFileSync(temporaryFile, 'PDF');

      await expect(
        externalCvsService.uploadExternalCV(randomUUID(), {
          path: temporaryFile,
          originalname: 'cv.pdf',
          size: 3,
        } as Express.Multer.File)
      ).rejects.toBeInstanceOf(InternalServerErrorException);
      expect(fs.existsSync(temporaryFile)).toBe(false);
    });
  });
});
