import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/sequelize';
import { Test, TestingModule } from '@nestjs/testing';
import moment from 'moment';
import { S3Mocks } from '../mocks.types';
import { EMBEDDING_CONFIG } from 'src/embeddings/embedding.config';
import { S3Service } from 'src/external-services/aws/s3.service';
import { QueuesService } from 'src/queues/producers/queues.service';
import { SCORING_WEIGHTS } from 'src/user-profile-recommendations/scoring.config';
import { MatchingReason } from 'src/user-profile-recommendations/user-profile-recommendation.types';
import { UserProfileRecommendationsService } from 'src/user-profile-recommendations/user-profile-recommendations-ai.service';
import {
  UserProfileEmbedding,
  UserProfileEmbeddingType,
} from 'src/user-profiles/models/user-profile-embedding.model';
import { UserProfilesService } from 'src/user-profiles/user-profiles.service';
import { OnboardingStatus, UserRoles } from 'src/users/users.types';
import { ZoneName } from 'src/utils/types/zones.types';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import { ConversationFactory } from 'tests/messaging/conversation.factory';
import { MessagingHelper } from 'tests/messaging/messaging.helper';
import { QueuesServiceMock } from 'tests/queues/queues.service.mock';
import { UserFactory } from 'tests/users/user.factory';

/**
 * Builds a 1024-dimension unit vector at the given angle (in radians) of the
 * reference direction: the cosine similarity between two such vectors is the
 * cosine of the difference of their angles, which makes the expected scores
 * easy to compute by hand.
 */
const vectorAt = (angle: number) => {
  const values = new Array(1024).fill(0);
  values[0] = Math.cos(angle);
  values[1] = Math.sin(angle);
  return `[${values.join(',')}]`;
};

const similarity = (angle: number) => Math.cos(angle);

const DAY_IN_MS = 24 * 60 * 60 * 1000;

describe('UserProfileRecommendationsService - similarity search and pool', () => {
  let app: INestApplication;
  let databaseHelper: DatabaseHelper;
  let userFactory: UserFactory;
  let recommendationsService: UserProfileRecommendationsService;
  let userProfilesService: UserProfilesService;
  let conversationFactory: ConversationFactory;
  let messagingHelper: MessagingHelper;
  let embeddingModel: typeof UserProfileEmbedding;

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

    databaseHelper = moduleFixture.get(DatabaseHelper);
    userFactory = moduleFixture.get(UserFactory);
    recommendationsService = moduleFixture.get(
      UserProfileRecommendationsService
    );
    userProfilesService = moduleFixture.get(UserProfilesService);
    conversationFactory = moduleFixture.get(ConversationFactory);
    messagingHelper = moduleFixture.get(MessagingHelper);
    embeddingModel = moduleFixture.get(getModelToken(UserProfileEmbedding));
  });

  afterAll(async () => {
    await databaseHelper.resetTestDB();
    await app.close();
  });

  afterEach(async () => {
    await databaseHelper.resetTestDB();
  });

  type EmbeddedUserOptions = {
    needsAngle?: number;
    needsVersion?: string;
    profileAngle?: number;
    profileProps?: Record<string, unknown>;
    profileVersion?: string;
  };

  const createEmbeddedUser = async (
    props: Parameters<UserFactory['create']>[0],
    {
      profileAngle,
      needsAngle,
      profileVersion = EMBEDDING_CONFIG.profile.version,
      needsVersion = EMBEDDING_CONFIG.needs.version,
      profileProps = {},
    }: EmbeddedUserOptions = {}
  ) => {
    const user = await userFactory.create(props, {
      userProfile: profileProps,
    });
    if (profileAngle !== undefined) {
      await embeddingModel.create({
        userProfileId: user.userProfile.id,
        type: UserProfileEmbeddingType.profile,
        embedding: vectorAt(profileAngle),
        configVersion: profileVersion,
      });
    }
    if (needsAngle !== undefined) {
      await embeddingModel.create({
        userProfileId: user.userProfile.id,
        type: UserProfileEmbeddingType.needs,
        embedding: vectorAt(needsAngle),
        configVersion: needsVersion,
      });
    }
    return user;
  };

  const search = (
    userId: string,
    overrides: Partial<
      Parameters<UserProfileRecommendationsService['findBySimilarity']>[0]
    > = {}
  ) =>
    recommendationsService.findBySimilarity({
      userId,
      rolesToFind: [UserRoles.CANDIDATE],
      configVersionProfile: EMBEDDING_CONFIG.profile.version,
      configVersionNeeds: EMBEDDING_CONFIG.needs.version,
      weightProfile: 1,
      weightNeeds: 0,
      weightActivity: 0,
      weightLocationCompatibility: 0,
      poolSize: 10,
      ...overrides,
    });

  describe('findBySimilarity', () => {
    it('ranks the candidates by decreasing similarity with the requester profile', async () => {
      const requester = await createEmbeddedUser(
        { role: UserRoles.COACH },
        { profileAngle: 0 }
      );
      const far = await createEmbeddedUser(
        { role: UserRoles.CANDIDATE },
        { profileAngle: 1.2 }
      );
      const close = await createEmbeddedUser(
        { role: UserRoles.CANDIDATE },
        { profileAngle: 0.1 }
      );
      const medium = await createEmbeddedUser(
        { role: UserRoles.CANDIDATE },
        { profileAngle: 0.6 }
      );

      const results = await search(requester.id);

      expect(results.map((r) => r.userId)).toEqual([
        close.id,
        medium.id,
        far.id,
      ]);
      expect(results[0].profileScore).toBeCloseTo(similarity(0.1), 4);
      expect(results[1].profileScore).toBeCloseTo(similarity(0.6), 4);
      expect(results[2].profileScore).toBeCloseTo(similarity(1.2), 4);
    });

    it('combines the profile, needs, activity and location scores with the given weights', async () => {
      const requester = await createEmbeddedUser(
        { role: UserRoles.COACH },
        { profileAngle: 0, needsAngle: 0 }
      );
      const candidate = await createEmbeddedUser(
        { role: UserRoles.CANDIDATE },
        { profileAngle: 0.3, needsAngle: 0.8 }
      );

      const [result] = await search(requester.id, {
        weightProfile: SCORING_WEIGHTS.profile,
        weightNeeds: SCORING_WEIGHTS.needs,
        weightActivity: SCORING_WEIGHTS.activity,
        weightLocationCompatibility: SCORING_WEIGHTS.locationCompatibility,
      });

      // Without any conversation and with a connection of today the activity
      // score is: 0.5 (default response rate) * 0.35 + 0.5 (default response
      // time) * 0.15 + 1 (connected today) * 0.05 + 1 (no workload) * 0.15
      // + 0 (no badge) * 0.3
      const expectedActivity = 0.5 * 0.35 + 0.5 * 0.15 + 0.05 + 0.15;
      expect(result.userId).toBe(candidate.id);
      expect(result.profileScore).toBeCloseTo(similarity(0.3), 4);
      expect(result.needsScore).toBeCloseTo(similarity(0.8), 4);
      expect(result.activityScore).toBeCloseTo(expectedActivity, 4);
      expect(result.locationCompatibilityScore).toBe(1);
      expect(result.finalScore).toBeCloseTo(
        similarity(0.3) * 0.4 +
          similarity(0.8) * 0.2 +
          expectedActivity * 0.3 +
          1 * 0.1,
        4
      );
    });

    it('scores a candidate with a good response history higher on activity than a candidate who never answers', async () => {
      const requester = await createEmbeddedUser(
        { role: UserRoles.COACH },
        { profileAngle: 0 }
      );
      const responsive = await createEmbeddedUser(
        { role: UserRoles.CANDIDATE },
        { profileAngle: 0.1 }
      );
      const silent = await createEmbeddedUser(
        { role: UserRoles.CANDIDATE },
        { profileAngle: 0.1 }
      );
      const otherCoach = await createEmbeddedUser({ role: UserRoles.COACH });

      const firstMessageAt = new Date(Date.now() - 5 * DAY_IN_MS);
      const answerAt = new Date(firstMessageAt.getTime() + 2 * 60 * 60 * 1000);

      const answeredConversation = await conversationFactory.create();
      await messagingHelper.associationParticipantsToConversation(
        answeredConversation.id,
        [responsive.id, otherCoach.id]
      );
      await messagingHelper.createMessage(
        answeredConversation.id,
        otherCoach.id,
        { createdAt: firstMessageAt }
      );
      await messagingHelper.createMessage(
        answeredConversation.id,
        responsive.id,
        { createdAt: answerAt }
      );

      const unansweredConversation = await conversationFactory.create();
      await messagingHelper.associationParticipantsToConversation(
        unansweredConversation.id,
        [silent.id, otherCoach.id]
      );
      await messagingHelper.createMessage(
        unansweredConversation.id,
        otherCoach.id,
        { createdAt: firstMessageAt }
      );

      const results = await search(requester.id, { weightActivity: 1 });
      const byUser = new Map(results.map((r) => [r.userId, r]));

      // responsive: 1 * 0.35 + 1 (answered in 2h) * 0.15 + 0.05 + 0.9 (1 conversation) * 0.15
      expect(byUser.get(responsive.id).activityScore).toBeCloseTo(
        0.35 + 0.15 + 0.05 + 0.135,
        4
      );
      // silent: 0 * 0.35 + 0.5 (no answer time) * 0.15 + 0.05 + 0.135
      expect(byUser.get(silent.id).activityScore).toBeCloseTo(
        0 + 0.075 + 0.05 + 0.135,
        4
      );
    });

    it('only returns users with the requested roles', async () => {
      const requester = await createEmbeddedUser(
        { role: UserRoles.COACH },
        { profileAngle: 0 }
      );
      const candidate = await createEmbeddedUser(
        { role: UserRoles.CANDIDATE },
        { profileAngle: 0.1 }
      );
      await createEmbeddedUser({ role: UserRoles.COACH }, { profileAngle: 0 });

      const results = await search(requester.id);

      expect(results.map((r) => r.userId)).toEqual([candidate.id]);
    });

    it('excludes the deleted users, the users who did not complete onboarding and the excluded ids', async () => {
      const requester = await createEmbeddedUser(
        { role: UserRoles.COACH },
        { profileAngle: 0 }
      );
      const eligible = await createEmbeddedUser(
        { role: UserRoles.CANDIDATE },
        { profileAngle: 0.1 }
      );
      const deleted = await createEmbeddedUser(
        { role: UserRoles.CANDIDATE },
        { profileAngle: 0.1 }
      );
      await userFactory.delete(deleted.id);
      await createEmbeddedUser(
        {
          role: UserRoles.CANDIDATE,
          onboardingStatus: OnboardingStatus.IN_PROGRESS,
        },
        { profileAngle: 0.1 }
      );
      const excluded = await createEmbeddedUser(
        { role: UserRoles.CANDIDATE },
        { profileAngle: 0.1 }
      );

      const results = await search(requester.id, {
        excludeUserIds: [excluded.id],
      });

      expect(results.map((r) => r.userId)).toEqual([eligible.id]);
    });

    it('excludes the candidates the requester already talks with', async () => {
      const requester = await createEmbeddedUser(
        { role: UserRoles.COACH },
        { profileAngle: 0 }
      );
      const alreadyContacted = await createEmbeddedUser(
        { role: UserRoles.CANDIDATE },
        { profileAngle: 0.1 }
      );
      const fresh = await createEmbeddedUser(
        { role: UserRoles.CANDIDATE },
        { profileAngle: 0.2 }
      );
      const conversation = await conversationFactory.create();
      await messagingHelper.associationParticipantsToConversation(
        conversation.id,
        [requester.id, alreadyContacted.id]
      );

      const results = await search(requester.id);

      expect(results.map((r) => r.userId)).toEqual([fresh.id]);
    });

    it('ignores the embeddings computed with another config version', async () => {
      const requester = await createEmbeddedUser(
        { role: UserRoles.COACH },
        { profileAngle: 0 }
      );
      await createEmbeddedUser(
        { role: UserRoles.CANDIDATE },
        { profileAngle: 0.1, profileVersion: 'v0.1' }
      );
      const upToDate = await createEmbeddedUser(
        { role: UserRoles.CANDIDATE },
        { profileAngle: 0.2 }
      );

      const results = await search(requester.id);

      expect(results.map((r) => r.userId)).toEqual([upToDate.id]);
    });

    describe('availability filter', () => {
      let requesterId: string;
      let available: string;
      let unavailable: string;

      beforeEach(async () => {
        const requester = await createEmbeddedUser(
          { role: UserRoles.COACH },
          { profileAngle: 0 }
        );
        requesterId = requester.id;
        available = (
          await createEmbeddedUser(
            { role: UserRoles.CANDIDATE },
            { profileAngle: 0.1 }
          )
        ).id;
        unavailable = (
          await createEmbeddedUser(
            { role: UserRoles.CANDIDATE },
            { profileAngle: 0.2, profileProps: { unavailableAt: new Date() } }
          )
        ).id;
      });

      it('keeps only the available users when asked for', async () => {
        const results = await search(requesterId, {
          filterByAvailability: true,
        });

        expect(results.map((r) => r.userId)).toEqual([available]);
      });

      it('keeps only the unavailable users when asked for the opposite', async () => {
        const results = await search(requesterId, {
          filterByAvailability: false,
        });

        expect(results.map((r) => r.userId)).toEqual([unavailable]);
      });

      it('returns both when the availability does not matter', async () => {
        const results = await search(requesterId);

        expect(results.map((r) => r.userId).sort()).toEqual(
          [available, unavailable].sort()
        );
      });
    });

    describe('location filter', () => {
      it('excludes users of another zone unless both accept remote events', async () => {
        const requester = await createEmbeddedUser(
          { role: UserRoles.COACH, zone: ZoneName.IDF },
          { profileAngle: 0, profileProps: { allowRemoteEvents: true } }
        );
        const sameZone = await createEmbeddedUser(
          { role: UserRoles.CANDIDATE, zone: ZoneName.IDF },
          { profileAngle: 0.1, profileProps: { allowRemoteEvents: false } }
        );
        const otherZoneRemote = await createEmbeddedUser(
          { role: UserRoles.CANDIDATE, zone: ZoneName.NORD },
          { profileAngle: 0.2, profileProps: { allowRemoteEvents: true } }
        );
        await createEmbeddedUser(
          { role: UserRoles.CANDIDATE, zone: ZoneName.AURA },
          { profileAngle: 0.3, profileProps: { allowRemoteEvents: false } }
        );

        const results = await search(requester.id, {
          weightLocationCompatibility: 1,
          weightProfile: 0,
        });
        const byUser = new Map(results.map((r) => [r.userId, r]));

        expect(results).toHaveLength(2);
        expect(byUser.get(sameZone.id).locationCompatibilityScore).toBe(1);
        expect(byUser.get(otherZoneRemote.id).locationCompatibilityScore).toBe(
          0.5
        );
      });

      it('excludes every other zone when the requester does not accept remote events', async () => {
        const requester = await createEmbeddedUser(
          { role: UserRoles.COACH, zone: ZoneName.IDF },
          { profileAngle: 0, profileProps: { allowRemoteEvents: false } }
        );
        await createEmbeddedUser(
          { role: UserRoles.CANDIDATE, zone: ZoneName.NORD },
          { profileAngle: 0.2, profileProps: { allowRemoteEvents: true } }
        );

        const results = await search(requester.id);

        expect(results).toEqual([]);
      });
    });

    it('returns nothing when the requester has no embedding yet', async () => {
      const requester = await createEmbeddedUser({ role: UserRoles.COACH });
      await createEmbeddedUser(
        { role: UserRoles.CANDIDATE },
        { profileAngle: 0.1 }
      );

      const results = await search(requester.id);

      expect(results).toEqual([]);
    });

    it('still finds candidates through the needs embedding when the requester has no profile embedding', async () => {
      const requester = await createEmbeddedUser(
        { role: UserRoles.COACH },
        { needsAngle: 0 }
      );
      const candidate = await createEmbeddedUser(
        { role: UserRoles.CANDIDATE },
        { needsAngle: 0.4 }
      );

      const results = await search(requester.id, {
        weightProfile: 0,
        weightNeeds: 1,
      });

      expect(results).toHaveLength(1);
      expect(results[0].userId).toBe(candidate.id);
      expect(results[0].profileScore).toBe(0);
      expect(results[0].needsScore).toBeCloseTo(similarity(0.4), 4);
    });

    it('limits the result to the pool size', async () => {
      const requester = await createEmbeddedUser(
        { role: UserRoles.COACH },
        { profileAngle: 0 }
      );
      for (let i = 0; i < 4; i++) {
        await createEmbeddedUser(
          { role: UserRoles.CANDIDATE },
          { profileAngle: 0.1 * (i + 1) }
        );
      }

      const results = await search(requester.id, { poolSize: 2 });

      expect(results).toHaveLength(2);
    });
  });

  describe('updateRecommendationsByUserId', () => {
    it('stores the ranked recommendations with the dominant reason of each one', async () => {
      const requester = await createEmbeddedUser(
        { role: UserRoles.COACH },
        { profileAngle: 0, needsAngle: 0 }
      );
      const profileMatch = await createEmbeddedUser(
        { role: UserRoles.CANDIDATE },
        { profileAngle: 0.1, needsAngle: 1.2 }
      );
      const needsMatch = await createEmbeddedUser(
        { role: UserRoles.CANDIDATE },
        { profileAngle: 1.2, needsAngle: 0.1 }
      );

      await recommendationsService.updateRecommendationsByUserId(
        requester.id,
        10
      );
      const stored = await recommendationsService.findRecommendationsByUserId(
        requester.id
      );

      expect(stored.map((r) => r.recommendedUserId)).toEqual([
        profileMatch.id,
        needsMatch.id,
      ]);
      expect(stored.map((r) => r.rank)).toEqual([1, 2]);
      expect(stored.map((r) => r.reason)).toEqual([
        MatchingReason.PROFILE,
        MatchingReason.NEEDS,
      ]);
      expect(stored[0].finalScore).toBeGreaterThan(stored[1].finalScore);
    });

    it('uses the absolute weighted scores to explain a lone recommendation', async () => {
      const requester = await createEmbeddedUser(
        { role: UserRoles.COACH },
        { profileAngle: 0, needsAngle: 0 }
      );
      await createEmbeddedUser(
        { role: UserRoles.CANDIDATE },
        { profileAngle: 0.1, needsAngle: 0.1 }
      );

      await recommendationsService.updateRecommendationsByUserId(
        requester.id,
        10
      );
      const stored = await recommendationsService.findRecommendationsByUserId(
        requester.id
      );

      expect(stored).toHaveLength(1);
      expect(stored[0].reason).toBe(MatchingReason.PROFILE);
    });

    it('recommends coaches to a candidate', async () => {
      const requester = await createEmbeddedUser(
        { role: UserRoles.CANDIDATE },
        { profileAngle: 0 }
      );
      const coach = await createEmbeddedUser(
        { role: UserRoles.COACH },
        { profileAngle: 0.1 }
      );
      await createEmbeddedUser(
        { role: UserRoles.CANDIDATE },
        { profileAngle: 0.1 }
      );

      await recommendationsService.updateRecommendationsByUserId(
        requester.id,
        10
      );
      const stored = await recommendationsService.findRecommendationsByUserId(
        requester.id
      );

      expect(stored.map((r) => r.recommendedUserId)).toEqual([coach.id]);
    });

    it('does not store anything when nobody matches', async () => {
      const requester = await createEmbeddedUser(
        { role: UserRoles.COACH },
        { profileAngle: 0 }
      );

      const created =
        await recommendationsService.updateRecommendationsByUserId(
          requester.id,
          10
        );

      expect(created).toEqual([]);
    });
  });

  describe('retrieveOrComputeRecommendationsForUserIdIA', () => {
    const retrieve = async (userId: string, poolSize = 3) => {
      const user = await userProfilesService.findOneUser(userId);
      const userProfile = await userProfilesService.findOneByUserId(userId);
      return recommendationsService.retrieveOrComputeRecommendationsForUserIdIA(
        user,
        userProfile,
        poolSize
      );
    };

    const setUpCoachWithCandidates = async (candidateCount: number) => {
      const requester = await createEmbeddedUser(
        { role: UserRoles.COACH },
        { profileAngle: 0 }
      );
      const candidates = [];
      for (let i = 0; i < candidateCount; i++) {
        candidates.push(
          await createEmbeddedUser(
            { role: UserRoles.CANDIDATE },
            { profileAngle: 0.1 * (i + 1) }
          )
        );
      }
      return { requester, candidates };
    };

    it('computes the pool on the first call and returns the requested number of recommendations', async () => {
      const { requester, candidates } = await setUpCoachWithCandidates(4);

      const recommendations = await retrieve(requester.id, 3);

      expect(recommendations).toHaveLength(3);
      expect(recommendations.map((r) => r.publicProfile.id)).toEqual(
        candidates.slice(0, 3).map((c) => c.id)
      );
      expect(recommendations[0]).toEqual(
        expect.objectContaining({
          reason: MatchingReason.PROFILE,
          profileScore: expect.any(Number),
          finalScore: expect.any(Number),
        })
      );
      const profile = await userProfilesService.findOneByUserId(requester.id);
      expect(profile.lastRecommendationsDate).toBeTruthy();
      expect(
        await recommendationsService.countRecommendationsByUserId(requester.id)
      ).toBe(4);
    });

    it('reuses a fresh pool without computing it again', async () => {
      const { requester } = await setUpCoachWithCandidates(2);
      await retrieve(requester.id);
      const compute = jest.spyOn(
        recommendationsService,
        'updateRecommendationsByUserId'
      );

      const recommendations = await retrieve(requester.id);

      expect(recommendations).toHaveLength(2);
      expect(compute).not.toHaveBeenCalled();
      compute.mockRestore();
    });

    it('recomputes a pool older than a week', async () => {
      const { requester } = await setUpCoachWithCandidates(2);
      await retrieve(requester.id);
      await userProfilesService.updateByUserId(requester.id, {
        lastRecommendationsDate: moment().subtract(8, 'days').toDate(),
      });
      const compute = jest.spyOn(
        recommendationsService,
        'updateRecommendationsByUserId'
      );

      await retrieve(requester.id);

      expect(compute).toHaveBeenCalledTimes(1);
      compute.mockRestore();
    });

    it('recomputes the pool when a recommended user became unavailable', async () => {
      const { requester, candidates } = await setUpCoachWithCandidates(2);
      await retrieve(requester.id);
      await userProfilesService.updateByUserId(candidates[0].id, {
        unavailableAt: new Date(),
      });

      const recommendations = await retrieve(requester.id);

      expect(recommendations.map((r) => r.publicProfile.id)).toEqual([
        candidates[1].id,
      ]);
    });

    it('recomputes the pool when it holds legacy recommendations without score', async () => {
      const { requester, candidates } = await setUpCoachWithCandidates(1);
      await userProfilesService.updateByUserId(requester.id, {
        lastRecommendationsDate: new Date(),
      });
      await recommendationsService.createRecommendations(requester.id, [
        candidates[0].id,
      ]);
      const compute = jest.spyOn(
        recommendationsService,
        'updateRecommendationsByUserId'
      );

      const recommendations = await retrieve(requester.id);

      expect(compute).toHaveBeenCalledTimes(1);
      expect(recommendations[0].finalScore).not.toBeNull();
      compute.mockRestore();
    });

    it('recomputes an empty pool even when the last computation is recent', async () => {
      const { requester } = await setUpCoachWithCandidates(0);
      await userProfilesService.updateByUserId(requester.id, {
        lastRecommendationsDate: new Date(),
      });
      const compute = jest.spyOn(
        recommendationsService,
        'updateRecommendationsByUserId'
      );

      const recommendations = await retrieve(requester.id);

      expect(recommendations).toEqual([]);
      expect(compute).toHaveBeenCalledTimes(1);
      compute.mockRestore();
    });
  });

  describe('appendRecommendationsForUserId', () => {
    it('does nothing when the user has no stored pool yet', async () => {
      const requester = await createEmbeddedUser(
        { role: UserRoles.COACH },
        { profileAngle: 0 }
      );
      await createEmbeddedUser(
        { role: UserRoles.CANDIDATE },
        { profileAngle: 0.1 }
      );

      await recommendationsService.appendRecommendationsForUserId(
        requester.id,
        10
      );

      expect(
        await recommendationsService.countRecommendationsByUserId(requester.id)
      ).toBe(0);
    });

    it('appends the next candidates after the stored ones without duplicating any', async () => {
      const requester = await createEmbeddedUser(
        { role: UserRoles.COACH },
        { profileAngle: 0 }
      );
      const first = await createEmbeddedUser(
        { role: UserRoles.CANDIDATE },
        { profileAngle: 0.1 }
      );
      await recommendationsService.updateRecommendationsByUserId(
        requester.id,
        10
      );
      const second = await createEmbeddedUser(
        { role: UserRoles.CANDIDATE },
        { profileAngle: 0.3 }
      );

      await recommendationsService.appendRecommendationsForUserId(
        requester.id,
        10
      );
      const stored = await recommendationsService.findRecommendationsByUserId(
        requester.id
      );

      expect(stored.map((r) => r.recommendedUserId)).toEqual([
        first.id,
        second.id,
      ]);
      expect(stored.map((r) => r.rank)).toEqual([1, 2]);
    });

    it('keeps the pool unchanged when no new candidate is available', async () => {
      const requester = await createEmbeddedUser(
        { role: UserRoles.COACH },
        { profileAngle: 0 }
      );
      await createEmbeddedUser(
        { role: UserRoles.CANDIDATE },
        { profileAngle: 0.1 }
      );
      await recommendationsService.updateRecommendationsByUserId(
        requester.id,
        10
      );

      await recommendationsService.appendRecommendationsForUserId(
        requester.id,
        10
      );

      expect(
        await recommendationsService.countRecommendationsByUserId(requester.id)
      ).toBe(1);
    });
  });
});
