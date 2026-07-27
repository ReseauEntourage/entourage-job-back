import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/sequelize';
import { Test, TestingModule } from '@nestjs/testing';
import { S3Mocks } from '../../mocks.types';
import { EMBEDDING_CONFIG } from 'src/embeddings/embedding.config';
import { S3Service } from 'src/external-services/aws/s3.service';
import { QueuesService } from 'src/queues/producers/queues.service';
import {
  UserProfileEmbedding,
  UserProfileEmbeddingType,
} from 'src/user-profiles/models/user-profile-embedding.model';
import { UserProfileRecommendationsService } from 'src/user-profiles/recommendations/user-profile-recommendations-ai.service';
import { UserRoles } from 'src/users/users.types';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import { QueuesServiceMock } from 'tests/queues/queues.service.mock';
import { UserFactory } from 'tests/users/user.factory';

// A fixed, non-zero 1024-dimension vector so cosine similarity is defined.
// Using the same vector for the requester and the candidate guarantees a
// similarity of 1 (distance 0), so the candidate always ranks in the ANN pool.
const FAKE_VECTOR = `[${Array(1024).fill(0.1).join(',')}]`;

describe('UserProfileRecommendationsService — admin eLearning gate bypass', () => {
  let app: INestApplication;
  let databaseHelper: DatabaseHelper;
  let userFactory: UserFactory;
  let recommendationsService: UserProfileRecommendationsService;
  let userProfileEmbeddingModel: typeof UserProfileEmbedding;

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

    databaseHelper = moduleFixture.get<DatabaseHelper>(DatabaseHelper);
    userFactory = moduleFixture.get<UserFactory>(UserFactory);
    recommendationsService = moduleFixture.get(
      UserProfileRecommendationsService
    );
    userProfileEmbeddingModel = moduleFixture.get(
      getModelToken(UserProfileEmbedding)
    );
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(async () => {
    await databaseHelper.resetTestDB();
  });

  async function createEmbeddedUser(
    props: Parameters<UserFactory['create']>[0]
  ) {
    const user = await userFactory.create(props);
    await userProfileEmbeddingModel.create({
      userProfileId: user.userProfile.id,
      type: UserProfileEmbeddingType.profile,
      embedding: FAKE_VECTOR,
      configVersion: EMBEDDING_CONFIG.profile.version,
    });
    return user;
  }

  it('excludes an ineligible candidate from the similarity pool for a non-admin requester', async () => {
    const requester = await createEmbeddedUser({ role: UserRoles.COACH });
    const ineligibleCandidate = await createEmbeddedUser({
      role: UserRoles.CANDIDATE,
      elearningCompletedAt: null,
    });

    const results = await recommendationsService.findBySimilarity({
      userId: requester.id,
      rolesToFind: [UserRoles.CANDIDATE],
      configVersionProfile: EMBEDDING_CONFIG.profile.version,
      configVersionNeeds: EMBEDDING_CONFIG.needs.version,
      weightProfile: 1,
      weightNeeds: 0,
      weightActivity: 0,
      weightLocationCompatibility: 0,
      poolSize: 10,
    });

    expect(results.map((r) => r.userId)).not.toContain(ineligibleCandidate.id);
  });

  it('includes an ineligible candidate in the similarity pool for an admin requester', async () => {
    const requester = await createEmbeddedUser({ role: UserRoles.COACH });
    const ineligibleCandidate = await createEmbeddedUser({
      role: UserRoles.CANDIDATE,
      elearningCompletedAt: null,
    });

    const results = await recommendationsService.findBySimilarity({
      userId: requester.id,
      rolesToFind: [UserRoles.CANDIDATE],
      configVersionProfile: EMBEDDING_CONFIG.profile.version,
      configVersionNeeds: EMBEDDING_CONFIG.needs.version,
      weightProfile: 1,
      weightNeeds: 0,
      weightActivity: 0,
      weightLocationCompatibility: 0,
      poolSize: 10,
      isAdminRequester: true,
    });

    expect(results.map((r) => r.userId)).toContain(ineligibleCandidate.id);
  });
});
