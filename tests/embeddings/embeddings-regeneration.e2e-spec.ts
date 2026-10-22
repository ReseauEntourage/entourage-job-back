import { Server } from 'http';
import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/sequelize';
import { Test, TestingModule } from '@nestjs/testing';
import { Sequelize } from 'sequelize-typescript';
import request from 'supertest';
import { EMBEDDING_CONFIG } from 'src/embeddings/embedding.config';
import { EmbeddingsRegenerationService } from 'src/embeddings/embeddings-regeneration.service';
import { EmbeddingsController } from 'src/embeddings/embeddings.controller';
import { QueuesService } from 'src/queues/producers/queues.service';
import { Jobs } from 'src/queues/queues.types';
import {
  UserProfileEmbedding,
  UserProfileEmbeddingType,
} from 'src/user-profiles/models/user-profile-embedding.model';
import { UserRoles } from 'src/users/users.types';
import { CustomTestingModule } from 'tests/custom-testing.module';
import { DatabaseHelper } from 'tests/database.helper';
import { LoggedInUser, UsersHelper } from 'tests/users/users.helper';

const VECTOR = `[${new Array(1024).fill(0.1).join(',')}]`;

describe('Embeddings regeneration', () => {
  let app: INestApplication;
  let server: Server;
  let databaseHelper: DatabaseHelper;
  let usersHelper: UsersHelper;
  let sequelize: Sequelize;
  let service: EmbeddingsRegenerationService;
  let embeddingModel: typeof UserProfileEmbedding;

  const queuesService = {
    addToEmbeddingQueue: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [CustomTestingModule],
      controllers: [EmbeddingsController],
      providers: [
        EmbeddingsRegenerationService,
        { provide: QueuesService, useValue: queuesService },
      ],
    })
      .overrideProvider(QueuesService)
      .useValue(queuesService)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    server = app.getHttpServer();

    databaseHelper = moduleFixture.get(DatabaseHelper);
    usersHelper = moduleFixture.get(UsersHelper);
    sequelize = moduleFixture.get(Sequelize);
    service = moduleFixture.get(EmbeddingsRegenerationService);
    embeddingModel = moduleFixture.get(getModelToken(UserProfileEmbedding), {
      strict: false,
    });
  });

  afterAll(async () => {
    await databaseHelper.resetTestDB();
    await app.close();
    server.close();
  });

  beforeEach(async () => {
    await databaseHelper.resetTestDB();
    queuesService.addToEmbeddingQueue.mockReset();
    queuesService.addToEmbeddingQueue.mockResolvedValue({ id: 'job-1' });
  });

  const profileIdOf = async (userId: string) => {
    const [row] = await sequelize.query<{ id: string }>(
      'SELECT id FROM "UserProfiles" WHERE "userId" = :userId',
      { replacements: { userId }, type: 'SELECT' as never }
    );
    return row.id;
  };

  const addEmbedding = async (
    user: LoggedInUser,
    type: UserProfileEmbeddingType,
    configVersion: string
  ) => {
    await embeddingModel.create({
      userProfileId: await profileIdOf(user.user.id),
      type,
      embedding: VECTOR,
      configVersion,
    });
  };

  const addUpToDateEmbeddings = async (user: LoggedInUser) => {
    await addEmbedding(
      user,
      UserProfileEmbeddingType.profile,
      EMBEDDING_CONFIG.profile.version
    );
    await addEmbedding(
      user,
      UserProfileEmbeddingType.needs,
      EMBEDDING_CONFIG.needs.version
    );
  };

  describe('findUsersWithOutdatedEmbeddings', () => {
    let missing: LoggedInUser;
    let upToDate: LoggedInUser;
    let outdatedProfile: LoggedInUser;
    let deleted: LoggedInUser;

    beforeEach(async () => {
      missing = await usersHelper.createLoggedInUser({
        role: UserRoles.CANDIDATE,
      });
      upToDate = await usersHelper.createLoggedInUser({
        role: UserRoles.COACH,
      });
      outdatedProfile = await usersHelper.createLoggedInUser({
        role: UserRoles.CANDIDATE,
      });
      deleted = await usersHelper.createLoggedInUser({
        role: UserRoles.CANDIDATE,
      });

      await addUpToDateEmbeddings(upToDate);
      await addEmbedding(
        outdatedProfile,
        UserProfileEmbeddingType.profile,
        'v0.1'
      );
      await addEmbedding(
        outdatedProfile,
        UserProfileEmbeddingType.needs,
        EMBEDDING_CONFIG.needs.version
      );
      await sequelize.query(
        'UPDATE "Users" SET "deletedAt" = NOW() WHERE id = :id',
        { replacements: { id: deleted.user.id } }
      );
    });

    it('returns the users with missing or outdated embeddings of any type by default', async () => {
      const userIds = await service.findUsersWithOutdatedEmbeddings();

      expect(userIds).toEqual(
        expect.arrayContaining([missing.user.id, outdatedProfile.user.id])
      );
      expect(userIds).not.toContain(upToDate.user.id);
    });

    it('never returns the deleted users', async () => {
      const userIds = await service.findUsersWithOutdatedEmbeddings('all');

      expect(userIds).not.toContain(deleted.user.id);
    });

    it('only looks at the profile embedding when asked to', async () => {
      const userIds = await service.findUsersWithOutdatedEmbeddings('profile');

      expect(userIds).toEqual(
        expect.arrayContaining([missing.user.id, outdatedProfile.user.id])
      );
    });

    it('does not report as outdated a user whose profile embedding is only outdated when looking at needs', async () => {
      const userIds = await service.findUsersWithOutdatedEmbeddings('needs');

      expect(userIds).toContain(missing.user.id);
      expect(userIds).not.toContain(outdatedProfile.user.id);
      expect(userIds).not.toContain(upToDate.user.id);
    });
  });

  describe('regenerateOutdatedEmbeddings', () => {
    it('does nothing when every embedding is up to date', async () => {
      const user = await usersHelper.createLoggedInUser({
        role: UserRoles.CANDIDATE,
      });
      await addUpToDateEmbeddings(user);

      const stats = await service.regenerateOutdatedEmbeddings();

      expect(stats).toEqual({
        totalUsers: 0,
        usersEnqueued: 0,
        errors: 0,
        dryRun: false,
      });
      expect(queuesService.addToEmbeddingQueue).not.toHaveBeenCalled();
    });

    it('only counts the users in dry run mode', async () => {
      await usersHelper.createLoggedInUser({ role: UserRoles.CANDIDATE });
      await usersHelper.createLoggedInUser({ role: UserRoles.COACH });

      const stats = await service.regenerateOutdatedEmbeddings({
        dryRun: true,
      });

      expect(stats).toEqual({
        totalUsers: 2,
        usersEnqueued: 0,
        errors: 0,
        dryRun: true,
      });
      expect(queuesService.addToEmbeddingQueue).not.toHaveBeenCalled();
    });

    it('enqueues one batch job per batch of users with both embedding types', async () => {
      const users = [
        await usersHelper.createLoggedInUser({ role: UserRoles.CANDIDATE }),
        await usersHelper.createLoggedInUser({ role: UserRoles.COACH }),
        await usersHelper.createLoggedInUser({ role: UserRoles.CANDIDATE }),
      ];

      const stats = await service.regenerateOutdatedEmbeddings({
        batchSize: 2,
        delayBetweenBatches: 0,
      });

      expect(stats).toEqual({
        totalUsers: 3,
        usersEnqueued: 3,
        errors: 0,
        dryRun: false,
      });
      expect(queuesService.addToEmbeddingQueue).toHaveBeenCalledTimes(2);
      const enqueuedIds = queuesService.addToEmbeddingQueue.mock.calls.flatMap(
        ([, data]) => data.userIds
      );
      expect(enqueuedIds.sort()).toEqual(users.map((u) => u.user.id).sort());
      expect(queuesService.addToEmbeddingQueue).toHaveBeenCalledWith(
        Jobs.UPDATE_USER_PROFILE_EMBEDDINGS_BATCH,
        expect.objectContaining({ embeddingTypes: ['profile', 'needs'] })
      );
    });

    it('restricts the enqueued embedding types to the requested one', async () => {
      await usersHelper.createLoggedInUser({ role: UserRoles.CANDIDATE });

      await service.regenerateOutdatedEmbeddings({
        embeddingType: 'needs',
        delayBetweenBatches: 0,
      });

      expect(queuesService.addToEmbeddingQueue).toHaveBeenCalledWith(
        Jobs.UPDATE_USER_PROFILE_EMBEDDINGS_BATCH,
        expect.objectContaining({ embeddingTypes: ['needs'] })
      );
    });

    it('counts the users of a batch that could not be enqueued as errors and carries on', async () => {
      await usersHelper.createLoggedInUser({ role: UserRoles.CANDIDATE });
      await usersHelper.createLoggedInUser({ role: UserRoles.COACH });
      await usersHelper.createLoggedInUser({ role: UserRoles.CANDIDATE });
      queuesService.addToEmbeddingQueue
        .mockRejectedValueOnce(new Error('redis down'))
        .mockResolvedValue({ id: 'job-2' });

      const stats = await service.regenerateOutdatedEmbeddings({
        batchSize: 2,
        delayBetweenBatches: 0,
      });

      expect(queuesService.addToEmbeddingQueue).toHaveBeenCalledTimes(2);
      expect(stats.errors).toBe(2);
      expect(stats.usersEnqueued).toBe(1);
    });
  });

  describe('getEmbeddingsStats', () => {
    it('counts the profiles by embedding status for each type', async () => {
      const upToDate = await usersHelper.createLoggedInUser({
        role: UserRoles.COACH,
      });
      const outdated = await usersHelper.createLoggedInUser({
        role: UserRoles.CANDIDATE,
      });
      await usersHelper.createLoggedInUser({ role: UserRoles.CANDIDATE });
      await addUpToDateEmbeddings(upToDate);
      await addEmbedding(outdated, UserProfileEmbeddingType.profile, 'v0.1');

      const stats = await service.getEmbeddingsStats();

      expect(stats.profile).toEqual({
        total: 3,
        upToDate: 1,
        outdated: 1,
        missing: 1,
      });
      expect(stats.needs).toEqual({
        total: 3,
        upToDate: 1,
        outdated: 0,
        missing: 2,
      });
    });
  });

  describe('POST /embeddings/regenerate', () => {
    const route = '/embeddings/regenerate';
    let admin: LoggedInUser;

    beforeEach(async () => {
      admin = await usersHelper.createLoggedInUser({ role: UserRoles.ADMIN });
    });

    it('lets an admin run a dry run and returns the statistics', async () => {
      const response = await request(server)
        .post(`${route}?dryRun=true`)
        .set('authorization', `Bearer ${admin.token}`);

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        totalUsers: 1,
        usersEnqueued: 0,
        errors: 0,
        dryRun: true,
      });
      expect(queuesService.addToEmbeddingQueue).not.toHaveBeenCalled();
    });

    it('lets an admin enqueue the regeneration of a single embedding type', async () => {
      const response = await request(server)
        .post(`${route}?type=profile&batchSize=10&delay=0`)
        .set('authorization', `Bearer ${admin.token}`);

      expect(response.status).toBe(201);
      expect(response.body.usersEnqueued).toBe(1);
      expect(queuesService.addToEmbeddingQueue).toHaveBeenCalledWith(
        Jobs.UPDATE_USER_PROFILE_EMBEDDINGS_BATCH,
        { userIds: [admin.user.id], embeddingTypes: ['profile'] }
      );
    });

    it.each([
      ['an unknown embedding type', 'type=unknown'],
      ['a non numeric batch size', 'batchSize=abc'],
      ['a negative batch size', 'batchSize=-1'],
      ['a batch size above 50', 'batchSize=51'],
      ['a non numeric delay', 'delay=abc'],
      ['a negative delay', 'delay=-5'],
    ])('rejects %s', async (_label, query) => {
      const response = await request(server)
        .post(`${route}?${query}`)
        .set('authorization', `Bearer ${admin.token}`);

      expect(response.status).toBe(400);
      expect(queuesService.addToEmbeddingQueue).not.toHaveBeenCalled();
    });

    it.each([UserRoles.CANDIDATE, UserRoles.COACH, UserRoles.REFERER])(
      'refuses a %s',
      async (role) => {
        const loggedInUser = await usersHelper.createLoggedInUser({ role });

        const response = await request(server)
          .post(`${route}?dryRun=true`)
          .set('authorization', `Bearer ${loggedInUser.token}`);

        expect(response.status).toBe(403);
      }
    );

    it('refuses an anonymous user', async () => {
      const response = await request(server).post(`${route}?dryRun=true`);

      expect(response.status).toBe(401);
    });
  });
});
