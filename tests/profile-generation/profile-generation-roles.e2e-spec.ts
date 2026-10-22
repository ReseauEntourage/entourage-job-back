import { createHash } from 'crypto';
import { Server } from 'http';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { S3Service } from 'src/external-services/aws/s3.service';
import { QueuesService } from 'src/queues/producers/queues.service';
import { Jobs } from 'src/queues/queues.types';
import { UserProfilesService } from 'src/user-profiles/user-profiles.service';
import { UserRole, UserRoles } from 'src/users/users.types';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import { ExternalCvsHelper } from 'tests/external-cvs/external-cvs.helper';
import { S3Mocks } from 'tests/mocks.types';
import { UsersHelper } from 'tests/users/users.helper';

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

const ROLES: UserRole[] = [
  UserRoles.CANDIDATE,
  UserRoles.COACH,
  UserRoles.REFERER,
  UserRoles.ADMIN,
];

// Role matrix of the profile generation endpoints: none is restricted to a
// role, they only require a logged in user acting on their own profile. The
// presentation endpoint is already checked for every role in
// presentation-generation.e2e-spec.ts.
describe('ProfileGeneration - roles', () => {
  let app: INestApplication;
  let server: Server;
  let databaseHelper: DatabaseHelper;
  let usersHelper: UsersHelper;
  let externalCvsHelper: ExternalCvsHelper;
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
    userProfilesService = moduleFixture.get(UserProfilesService);
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
    queuesService.addToProfileGenerationQueue
      .mockReset()
      .mockResolvedValue({ id: 'job-9' });
    queuesService.getProfileGenerationJob.mockReset();
  });

  describe('GET /profile-generation/generate-profile-from-cv', () => {
    const route = '/profile-generation/generate-profile-from-cv';

    it('refuses an anonymous user', async () => {
      const response = await request(server).get(route);

      expect(response.status).toBe(401);
      expect(queuesService.addToProfileGenerationQueue).not.toHaveBeenCalled();
    });

    it.each(ROLES)('queues the extraction of the CV of a %s', async (role) => {
      const user = await usersHelper.createLoggedInUser({ role });
      const profile = await userProfilesService.findOneByUserId(user.user.id);
      await externalCvsHelper.createExternalCv(profile.id, user.user.id);

      const response = await request(server)
        .get(route)
        .set('authorization', `Bearer ${user.token}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ jobId: 'job-9', status: 'processing' });
      expect(queuesService.addToProfileGenerationQueue).toHaveBeenCalledWith(
        Jobs.GENERATE_PROFILE_FROM_PDF,
        expect.objectContaining({
          userId: user.user.id,
          fileHash: PDF_HASH,
        })
      );
    });
  });

  describe('POST /profile-generation/:jobId/cancel', () => {
    it('refuses an anonymous user', async () => {
      const response = await request(server).post(
        '/profile-generation/job-1/cancel'
      );

      expect(response.status).toBe(401);
      expect(queuesService.getProfileGenerationJob).not.toHaveBeenCalled();
    });

    it.each(ROLES)('lets a %s cancel their own job', async (role) => {
      const user = await usersHelper.createLoggedInUser({ role });
      const waiting = {
        data: { userId: user.user.id, userProfileId: 'p' },
        isWaiting: jest.fn().mockResolvedValue(true),
        isDelayed: jest.fn().mockResolvedValue(false),
        remove: jest.fn().mockResolvedValue(undefined),
        updateData: jest.fn().mockResolvedValue(undefined),
      };
      queuesService.getProfileGenerationJob.mockResolvedValue(waiting);

      const response = await request(server)
        .post('/profile-generation/job-1/cancel')
        .set('authorization', `Bearer ${user.token}`);

      expect(response.status).toBe(201);
      expect(response.body).toEqual({ status: 'cancelled' });
      expect(waiting.remove).toHaveBeenCalledTimes(1);
    });

    it.each(ROLES)(
      'never lets a %s cancel the job of another user',
      async (role) => {
        const user = await usersHelper.createLoggedInUser({ role });
        const foreign = {
          data: { userId: 'someone-else' },
          isWaiting: jest.fn().mockResolvedValue(true),
          isDelayed: jest.fn().mockResolvedValue(false),
          remove: jest.fn().mockResolvedValue(undefined),
          updateData: jest.fn().mockResolvedValue(undefined),
        };
        queuesService.getProfileGenerationJob.mockResolvedValue(foreign);

        await request(server)
          .post('/profile-generation/job-1/cancel')
          .set('authorization', `Bearer ${user.token}`);

        expect(foreign.remove).not.toHaveBeenCalled();
        expect(foreign.updateData).not.toHaveBeenCalled();
      }
    );
  });
});
