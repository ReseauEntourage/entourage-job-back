import { createHash } from 'crypto';
import { Server } from 'http';
import { InternalServerErrorException, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { S3Service } from 'src/external-services/aws/s3.service';
import {
  SCHEMA_VERSION,
  TRANSCRIPT_VERSION,
} from 'src/external-services/cv-extraction/cv-extraction.schemas';
import type { ProfileGenerationService } from 'src/profile-generation/profile-generation.service';
import { QueuesService } from 'src/queues/producers/queues.service';
import { Jobs } from 'src/queues/queues.types';
import { UserProfilesService } from 'src/user-profiles/user-profiles.service';
import { UserRoles } from 'src/users/users.types';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import { ExternalCvsHelper } from 'tests/external-cvs/external-cvs.helper';
import { LanguageHelper } from 'tests/languages/language.helper';
import { S3Mocks } from 'tests/mocks.types';
import { LoggedInUser, UsersHelper } from 'tests/users/users.helper';

const mockAxiosGet = jest.fn();

// The CV is never downloaded from S3: axios is replaced by a double.
jest.mock('axios', () => {
  const actual = jest.requireActual('axios');
  return {
    __esModule: true,
    ...actual,
    default: {
      ...actual.default,
      get: (...args: unknown[]) => mockAxiosGet(...args),
    },
  };
});

const PDF = Buffer.from('%PDF-1.4 content');
const PDF_HASH = createHash('md5').update(PDF).digest('hex');

describe('ProfileGeneration - CV import', () => {
  let app: INestApplication;
  let server: Server;
  let databaseHelper: DatabaseHelper;
  let usersHelper: UsersHelper;
  let externalCvsHelper: ExternalCvsHelper;
  let languageHelper: LanguageHelper;
  let service: ProfileGenerationService;
  let userProfilesService: UserProfilesService;

  const queuesService = {
    addToProfileGenerationQueue: jest.fn(),
    getProfileGenerationJob: jest.fn(),
    addToWorkQueue: jest.fn(),
    addToCronTasksQueue: jest.fn(),
    addToEmbeddingQueue: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [CustomTestingModule],
    })
      .overrideProvider(QueuesService)
      .useValue(queuesService)
      .overrideProvider(S3Service)
      .useValue(S3Mocks)
      .compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    server = app.getHttpServer();

    databaseHelper = moduleFixture.get(DatabaseHelper);
    usersHelper = moduleFixture.get(UsersHelper);
    externalCvsHelper = moduleFixture.get(ExternalCvsHelper);
    languageHelper = moduleFixture.get(LanguageHelper);
    // Imported lazily: loading this service first creates an import cycle
    const profileGenerationModule =
      await import('src/profile-generation/profile-generation.service');
    service = moduleFixture.get<ProfileGenerationService>(
      profileGenerationModule.ProfileGenerationService
    );
    userProfilesService = moduleFixture.get(UserProfilesService);

    await languageHelper.deleteAllLanguages();
    await languageHelper.seedLanguages();
  });

  afterAll(async () => {
    await databaseHelper.resetTestDB();
    await app.close();
    server.close();
  });

  beforeEach(async () => {
    await databaseHelper.resetTestDB();
    mockAxiosGet.mockReset();
    mockAxiosGet.mockResolvedValue({ status: 200, data: PDF });
    queuesService.addToProfileGenerationQueue.mockReset();
    queuesService.addToProfileGenerationQueue.mockResolvedValue({
      id: 'job-9',
    });
    queuesService.getProfileGenerationJob.mockReset();
  });

  const createCandidateWithCv = async () => {
    const candidate = await usersHelper.createLoggedInUser({
      role: UserRoles.CANDIDATE,
    });
    const profile = await userProfilesService.findOneByUserId(
      candidate.user.id
    );
    const cv = await externalCvsHelper.createExternalCv(
      profile.id,
      candidate.user.id
    );
    return { candidate, profileId: profile.id, cv };
  };

  describe('GET /profile-generation/generate-profile-from-cv', () => {
    const route = '/profile-generation/generate-profile-from-cv';
    const get = (user: LoggedInUser) =>
      request(server).get(route).set('authorization', `Bearer ${user.token}`);

    it('queues the extraction of a CV that has never been extracted', async () => {
      const { candidate, profileId } = await createCandidateWithCv();

      const response = await get(candidate);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ jobId: 'job-9', status: 'processing' });
      expect(queuesService.addToProfileGenerationQueue).toHaveBeenCalledWith(
        Jobs.GENERATE_PROFILE_FROM_PDF,
        {
          s3Key: expect.stringContaining('external-cvs/'),
          userProfileId: profileId,
          userId: candidate.user.id,
          fileHash: PDF_HASH,
        }
      );
    });

    it('reuses the data already extracted from the same CV instead of extracting again', async () => {
      const { candidate, profileId } = await createCandidateWithCv();
      await service.saveExtractedCVData(
        profileId,
        {
          schemaVersion: SCHEMA_VERSION,
          description: 'Described from the stored extraction',
        },
        PDF_HASH
      );

      const response = await get(candidate);

      expect(response.status).toBe(200);
      expect(queuesService.addToProfileGenerationQueue).not.toHaveBeenCalled();
      const profile = await userProfilesService.findOneByUserId(
        candidate.user.id
      );
      expect(profile.description).toBe('Described from the stored extraction');
    });

    it('extracts again when the CV changed', async () => {
      const { candidate, profileId } = await createCandidateWithCv();
      await service.saveExtractedCVData(
        profileId,
        { schemaVersion: SCHEMA_VERSION, description: 'old' },
        'another-hash'
      );

      const response = await get(candidate);

      expect(response.body.status).toBe('processing');
      expect(queuesService.addToProfileGenerationQueue).toHaveBeenCalledTimes(
        1
      );
    });

    it('fails when the CV cannot be downloaded', async () => {
      const { candidate } = await createCandidateWithCv();
      mockAxiosGet.mockResolvedValue({ status: 403, data: '' });

      const response = await get(candidate);

      expect(response.status).toBe(500);
      expect(queuesService.addToProfileGenerationQueue).not.toHaveBeenCalled();
    });

    it('does not queue anything for a user without uploaded CV', async () => {
      const candidate = await usersHelper.createLoggedInUser({
        role: UserRoles.CANDIDATE,
      });

      const response = await get(candidate);

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(queuesService.addToProfileGenerationQueue).not.toHaveBeenCalled();
    });

    it('refuses an anonymous user', async () => {
      const response = await request(server).get(route);

      expect(response.status).toBe(401);
    });
  });

  describe('POST /profile-generation/:jobId/cancel', () => {
    const job = (
      data: Record<string, unknown>,
      state: 'waiting' | 'active'
    ) => ({
      data,
      isWaiting: jest.fn().mockResolvedValue(state === 'waiting'),
      isDelayed: jest.fn().mockResolvedValue(false),
      remove: jest.fn().mockResolvedValue(undefined),
      updateData: jest.fn().mockResolvedValue(undefined),
    });

    const cancel = (user: LoggedInUser, jobId = 'job-1') =>
      request(server)
        .post(`/profile-generation/${jobId}/cancel`)
        .set('authorization', `Bearer ${user.token}`);

    it('removes a job that has not started yet', async () => {
      const user = await usersHelper.createLoggedInUser({
        role: UserRoles.CANDIDATE,
      });
      const waiting = job(
        { userId: user.user.id, userProfileId: 'p' },
        'waiting'
      );
      queuesService.getProfileGenerationJob.mockResolvedValue(waiting);

      const response = await cancel(user);

      expect(response.status).toBe(201);
      expect(response.body).toEqual({ status: 'cancelled' });
      expect(waiting.remove).toHaveBeenCalledTimes(1);
      expect(waiting.updateData).not.toHaveBeenCalled();
    });

    it('flags a running job as cancelled for the worker', async () => {
      const user = await usersHelper.createLoggedInUser({
        role: UserRoles.CANDIDATE,
      });
      const active = job(
        { userId: user.user.id, userProfileId: 'p' },
        'active'
      );
      queuesService.getProfileGenerationJob.mockResolvedValue(active);

      await cancel(user);

      expect(active.remove).not.toHaveBeenCalled();
      expect(active.updateData).toHaveBeenCalledWith({
        userId: user.user.id,
        userProfileId: 'p',
        cancelled: true,
      });
    });

    it('never cancels the job of another user', async () => {
      const user = await usersHelper.createLoggedInUser({
        role: UserRoles.CANDIDATE,
      });
      const foreign = job({ userId: 'someone-else' }, 'waiting');
      queuesService.getProfileGenerationJob.mockResolvedValue(foreign);

      const response = await cancel(user);

      expect(response.status).toBe(201);
      expect(foreign.remove).not.toHaveBeenCalled();
      expect(foreign.updateData).not.toHaveBeenCalled();
    });

    it('ignores an unknown job', async () => {
      const user = await usersHelper.createLoggedInUser({
        role: UserRoles.CANDIDATE,
      });
      queuesService.getProfileGenerationJob.mockResolvedValue(null);

      const response = await cancel(user);

      expect(response.status).toBe(201);
    });

    it('refuses an anonymous user', async () => {
      const response = await request(server).post(
        '/profile-generation/job-1/cancel'
      );

      expect(response.status).toBe(401);
    });
  });

  describe('extracted CV data storage', () => {
    let profileId: string;

    beforeEach(async () => {
      const candidate = await usersHelper.createLoggedInUser({
        role: UserRoles.CANDIDATE,
      });
      profileId = (await userProfilesService.findOneByUserId(candidate.user.id))
        .id;
    });

    it('stores the extracted data, then updates them in place', async () => {
      expect(await service.hasExtractedCVData(profileId)).toBe(false);
      expect(await service.getExtractedCVData(profileId)).toBeNull();

      const first = await service.saveExtractedCVData(
        profileId,
        { schemaVersion: SCHEMA_VERSION, description: 'v1' },
        'hash-1'
      );
      const second = await service.saveExtractedCVData(
        profileId,
        { schemaVersion: SCHEMA_VERSION, description: 'v2' },
        'hash-2'
      );

      expect(second.id).toBe(first.id);
      expect(await service.hasExtractedCVData(profileId)).toBe(true);
      expect(await service.getExtractedCVData(profileId)).toEqual({
        schemaVersion: SCHEMA_VERSION,
        description: 'v2',
      });
    });

    it('asks for an extraction when nothing is stored, the hash changed or the schema is older', async () => {
      expect(await service.shouldExtractCV(profileId, 'h')).toBe(true);

      await service.saveExtractedCVData(
        profileId,
        { schemaVersion: SCHEMA_VERSION },
        'h'
      );
      expect(await service.shouldExtractCV(profileId, 'h')).toBe(false);
      expect(await service.shouldExtractCV(profileId, 'other')).toBe(true);
    });

    describe('text read from the CV', () => {
      const data = { schemaVersion: SCHEMA_VERSION };

      it('keeps the text and its version with the extracted data', async () => {
        const stored = await service.saveExtractedCVData(
          profileId,
          data,
          'h',
          '# Experience\nCook'
        );

        await stored.reload();
        expect(stored.transcript).toBe('# Experience\nCook');
        expect(stored.transcriptVersion).toBe(TRANSCRIPT_VERSION);
      });

      it('stores no text for a single-call extraction, and drops an older one', async () => {
        await service.saveExtractedCVData(profileId, data, 'h', 'old text');
        const stored = await service.saveExtractedCVData(profileId, data, 'h');

        await stored.reload();
        expect(stored.transcript).toBeNull();
        expect(stored.transcriptVersion).toBeNull();
      });

      it('reuses the text of the same file read with the current instructions', async () => {
        await service.saveExtractedCVData(profileId, data, 'h', 'the text');

        expect(await service.getReusableTranscript(profileId, 'h')).toBe(
          'the text'
        );
      });

      it('does not reuse the text of another file', async () => {
        await service.saveExtractedCVData(profileId, data, 'h', 'the text');

        expect(
          await service.getReusableTranscript(profileId, 'other')
        ).toBeNull();
      });

      it('does not reuse a text read with older reading instructions', async () => {
        const stored = await service.saveExtractedCVData(
          profileId,
          data,
          'h',
          'the text'
        );
        await stored.update({ transcriptVersion: TRANSCRIPT_VERSION - 1 });

        expect(await service.getReusableTranscript(profileId, 'h')).toBeNull();
      });

      it('has nothing to reuse without stored text', async () => {
        expect(await service.getReusableTranscript(profileId, 'h')).toBeNull();

        await service.saveExtractedCVData(profileId, data, 'h');
        expect(await service.getReusableTranscript(profileId, 'h')).toBeNull();
      });

      it('still asks for an extraction when only the schema version is stale, so the text can be reused', async () => {
        const stored = await service.saveExtractedCVData(
          profileId,
          data,
          'h',
          'the text'
        );
        await stored.update({ schemaVersion: SCHEMA_VERSION - 1 });

        expect(await service.shouldExtractCV(profileId, 'h')).toBe(true);
        expect(await service.getReusableTranscript(profileId, 'h')).toBe(
          'the text'
        );
      });
    });

    it('asks for an extraction when the data were produced with another schema version', async () => {
      const stored = await service.saveExtractedCVData(
        profileId,
        { schemaVersion: SCHEMA_VERSION },
        'h'
      );
      await stored.update({ schemaVersion: SCHEMA_VERSION - 1 });

      expect(await service.shouldExtractCV(profileId, 'h')).toBe(true);
    });
  });

  describe('populateUserProfileFromCVData', () => {
    it('fills the profile with the skills, experiences, formations, interests and known languages', async () => {
      const candidate = await usersHelper.createLoggedInUser({
        role: UserRoles.CANDIDATE,
      });

      await service.populateUserProfileFromCVData(candidate.user.id, {
        schemaVersion: SCHEMA_VERSION,
        description: 'A short presentation.',
        skills: [
          { name: 'Cooking', order: 0 },
          { name: 'Teamwork', order: 1 },
        ],
        experiences: [
          {
            title: 'Chef',
            company: 'Bistro',
            location: 'Lyon',
            description: 'Cooked',
            startDate: '2020-03',
            endDate: '2022',
          },
          { title: 'Reversed dates', startDate: '2022', endDate: '2020' },
          { title: 'Invalid dates', startDate: 'later', endDate: '' },
        ],
        formations: [
          {
            title: 'CAP Cuisine',
            location: 'Paris',
            startDate: '2018-09-01',
            endDate: '2019-06-30',
          },
        ],
        interests: [{ name: 'Chess' }],
        languages: [
          { name: 'Anglais', value: 'en', level: 'FLUENT' },
          { name: 'Klingon', value: 'kl', level: 'NATIVE' },
        ],
      });

      const profile = await userProfilesService.findOneByUserId(
        candidate.user.id,
        true
      );
      expect(profile.description).toBe('A short presentation.');
      expect(profile.skills.map((s) => s.name).sort()).toEqual([
        'Cooking',
        'Teamwork',
      ]);
      const experiences = new Map(profile.experiences.map((e) => [e.title, e]));
      expect(experiences.get('Chef').startDate.toISOString()).toBe(
        '2020-03-01T00:00:00.000Z'
      );
      expect(experiences.get('Chef').endDate.toISOString()).toBe(
        '2022-01-01T00:00:00.000Z'
      );
      // A start date after the end date is dropped, never invented
      expect(experiences.get('Reversed dates').startDate).toBeNull();
      expect(experiences.get('Invalid dates').startDate).toBeNull();
      expect(experiences.get('Invalid dates').endDate).toBeNull();
      expect(profile.formations.map((f) => f.title)).toEqual(['CAP Cuisine']);
      expect(profile.interests.map((i) => i.name)).toEqual(['Chess']);
      expect(profile.userProfileLanguages).toHaveLength(1);
      expect(profile.userProfileLanguages[0].level).toBe('FLUENT');
    });

    it('does not touch the description when the CV has none', async () => {
      const candidate = await usersHelper.createLoggedInUser(
        { role: UserRoles.CANDIDATE },
        { userProfile: { description: 'Existing description' } }
      );

      await service.populateUserProfileFromCVData(candidate.user.id, {
        schemaVersion: SCHEMA_VERSION,
        skills: [{ name: 'Cooking' }],
      });

      const profile = await userProfilesService.findOneByUserId(
        candidate.user.id
      );
      expect(profile.description).toBe('Existing description');
    });

    it('fails with an internal error when the user has no profile', async () => {
      await expect(
        service.populateUserProfileFromCVData(
          '3f1c2a52-2b0c-4a0a-9a2e-0f3c9f7a1b11',
          { schemaVersion: SCHEMA_VERSION }
        )
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('generateProfileFromPDF', () => {
    it('adds the job to the profile generation queue and returns its id', async () => {
      const params = {
        s3Key: 'k',
        userProfileId: 'p',
        userId: 'u',
        fileHash: 'h',
      };

      await expect(service.generateProfileFromPDF(params)).resolves.toEqual({
        jobId: 'job-9',
        status: 'processing',
      });
      expect(queuesService.addToProfileGenerationQueue).toHaveBeenCalledWith(
        Jobs.GENERATE_PROFILE_FROM_PDF,
        params
      );
    });
  });
});
