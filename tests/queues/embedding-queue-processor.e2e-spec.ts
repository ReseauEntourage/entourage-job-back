import {
  PusherChannels,
  PusherEvents,
} from 'src/external-services/pusher/pusher.types';
import { EmbeddingQueueProcessor } from 'src/queues/consumers/embedding-queue.processor';
import { Jobs } from 'src/queues/queues.types';
import { tracer } from 'src/tracer';

// Pure unit tests (no database, no network): the Datadog tracer is mocked.
jest.mock('src/tracer', () => ({
  tracer: { llmobs: { trace: jest.fn(), annotate: jest.fn() } },
}));

const span = { name: 'workflow-span' };
const trace = tracer.llmobs.trace as jest.Mock;
const annotate = tracer.llmobs.annotate as jest.Mock;

const job = <T>(name: string, data: T) =>
  ({ id: 'job-1', name, data }) as never;

describe('EmbeddingQueueProcessor', () => {
  beforeEach(() => {
    trace.mockReset().mockImplementation((_options, fn) => fn(span));
    annotate.mockReset();
  });

  const build = () => {
    const usersService = {
      findOne: jest
        .fn()
        .mockImplementation((id: string) =>
          Promise.resolve({ id, role: 'Candidat' })
        ),
    };
    const userProfilesService = {
      findOneByUserId: jest
        .fn()
        .mockImplementation((userId: string) =>
          Promise.resolve({ id: `profile-of-${userId}` })
        ),
    };
    const userProfileEmbeddingsService = {
      updateEmbedding: jest.fn().mockResolvedValue(undefined),
      resetLastRecommendationsDate: jest.fn().mockResolvedValue(undefined),
      clearEmbeddingPending: jest.fn().mockResolvedValue(undefined),
      generateEmbeddingsBatch: jest
        .fn()
        .mockImplementation((texts: string[]) =>
          Promise.resolve(texts.map(() => [0.1, 0.2]))
        ),
      saveEmbedding: jest.fn().mockResolvedValue(undefined),
    };
    const embeddingBuilder = {
      build: jest
        .fn()
        .mockImplementation(
          (_role: string, profile: { id: string }, type: string) =>
            `${type}:${profile.id}`
        ),
    };
    const pusherService = { sendEvent: jest.fn().mockResolvedValue(undefined) };

    const processor = new EmbeddingQueueProcessor(
      usersService as never,
      userProfilesService as never,
      userProfileEmbeddingsService as never,
      embeddingBuilder as never,
      pusherService as never
    );

    return {
      processor,
      usersService,
      userProfilesService,
      userProfileEmbeddingsService,
      embeddingBuilder,
      pusherService,
    };
  };

  describe('process (job dispatch)', () => {
    it('routes the single profile job', async () => {
      const { processor } = build();
      const spy = jest
        .spyOn(processor, 'generateUserProfileEmbeddings')
        .mockResolvedValue('done');

      const result = await processor.process(
        job(Jobs.UPDATE_USER_PROFILE_EMBEDDINGS, {})
      );

      expect(spy).toHaveBeenCalledTimes(1);
      expect(result).toBe('done');
    });

    it('routes the batch job', async () => {
      const { processor } = build();
      const spy = jest
        .spyOn(processor, 'generateUserProfileEmbeddingsBatch')
        .mockResolvedValue('done');

      const result = await processor.process(
        job(Jobs.UPDATE_USER_PROFILE_EMBEDDINGS_BATCH, {})
      );

      expect(spy).toHaveBeenCalledTimes(1);
      expect(result).toBe('done');
    });

    it('rejects an unknown job type', async () => {
      const { processor } = build();

      await expect(processor.process(job(Jobs.SEND_MAIL, {}))).rejects.toThrow(
        `Unknown job type: ${Jobs.SEND_MAIL}`
      );
    });
  });

  describe('generateUserProfileEmbeddings', () => {
    const data = { userId: 'u1', embeddingTypes: ['profile', 'needs'] };

    it('builds and saves each requested embedding then notifies the user', async () => {
      const {
        processor,
        embeddingBuilder,
        userProfileEmbeddingsService,
        pusherService,
      } = build();

      const result = await processor.generateUserProfileEmbeddings(
        job(Jobs.UPDATE_USER_PROFILE_EMBEDDINGS, data)
      );

      expect(embeddingBuilder.build).toHaveBeenCalledWith(
        'Candidat',
        { id: 'profile-of-u1' },
        'profile'
      );
      expect(userProfileEmbeddingsService.updateEmbedding).toHaveBeenCalledWith(
        'profile-of-u1',
        'profile',
        'profile:profile-of-u1'
      );
      expect(userProfileEmbeddingsService.updateEmbedding).toHaveBeenCalledWith(
        'profile-of-u1',
        'needs',
        'needs:profile-of-u1'
      );
      expect(
        userProfileEmbeddingsService.resetLastRecommendationsDate
      ).toHaveBeenCalledWith('u1');
      expect(
        userProfileEmbeddingsService.clearEmbeddingPending
      ).toHaveBeenCalledWith('u1');
      expect(pusherService.sendEvent).toHaveBeenCalledWith(
        `${PusherChannels.EMBEDDING}-u1`,
        PusherEvents.EMBEDDING_READY,
        { success: true }
      );
      expect(result).toBe(
        'Embeddings updated for user u1 with embedding types: profile, needs'
      );
      expect(trace).toHaveBeenCalledWith(
        { kind: 'workflow', name: 'user-profile-embedding' },
        expect.any(Function)
      );
      expect(annotate).toHaveBeenCalledWith(span, {
        tags: {
          userId: 'u1',
          feature: 'profile_recommendation',
          outcome: 'success',
        },
      });
    });

    it.each([
      ['the user does not exist', 'findOne', 'User not found for userId: u1'],
      [
        'the user has no profile',
        'findOneByUserId',
        'User profile not found for userId: u1',
      ],
    ])(
      'fails and tells the front end it is over when %s',
      async (_label, missing, message) => {
        const {
          processor,
          usersService,
          userProfilesService,
          userProfileEmbeddingsService,
          pusherService,
        } = build();
        if (missing === 'findOne') {
          usersService.findOne.mockResolvedValue(null);
        } else {
          userProfilesService.findOneByUserId.mockResolvedValue(null);
        }

        await expect(
          processor.generateUserProfileEmbeddings(
            job(Jobs.UPDATE_USER_PROFILE_EMBEDDINGS, data)
          )
        ).rejects.toThrow(message);

        expect(
          userProfileEmbeddingsService.updateEmbedding
        ).not.toHaveBeenCalled();
        expect(
          userProfileEmbeddingsService.clearEmbeddingPending
        ).toHaveBeenCalledWith('u1');
        expect(pusherService.sendEvent).toHaveBeenCalledWith(
          `${PusherChannels.EMBEDDING}-u1`,
          PusherEvents.EMBEDDING_READY,
          { success: false }
        );
      }
    );

    it('clears the pending flag and notifies a failure when VoyageAI fails', async () => {
      const { processor, userProfileEmbeddingsService, pusherService } =
        build();
      userProfileEmbeddingsService.updateEmbedding.mockRejectedValue(
        new Error('voyage down')
      );

      await expect(
        processor.generateUserProfileEmbeddings(
          job(Jobs.UPDATE_USER_PROFILE_EMBEDDINGS, data)
        )
      ).rejects.toThrow('voyage down');

      expect(
        userProfileEmbeddingsService.resetLastRecommendationsDate
      ).not.toHaveBeenCalled();
      expect(pusherService.sendEvent).toHaveBeenCalledWith(
        `${PusherChannels.EMBEDDING}-u1`,
        PusherEvents.EMBEDDING_READY,
        { success: false }
      );
      expect(annotate).toHaveBeenCalledWith(span, {
        tags: {
          userId: 'u1',
          feature: 'profile_recommendation',
          outcome: 'error',
        },
      });
    });

    it('still reports the original error when the cleanup itself fails', async () => {
      const { processor, userProfileEmbeddingsService, pusherService } =
        build();
      userProfileEmbeddingsService.updateEmbedding.mockRejectedValue(
        new Error('voyage down')
      );
      userProfileEmbeddingsService.clearEmbeddingPending.mockRejectedValue(
        new Error('db down')
      );
      pusherService.sendEvent.mockRejectedValue(new Error('pusher down'));

      await expect(
        processor.generateUserProfileEmbeddings(
          job(Jobs.UPDATE_USER_PROFILE_EMBEDDINGS, data)
        )
      ).rejects.toThrow('voyage down');
    });
  });

  describe('generateUserProfileEmbeddingsBatch', () => {
    const batch = (userIds: string[], embeddingTypes = ['profile']) =>
      job(Jobs.UPDATE_USER_PROFILE_EMBEDDINGS_BATCH, {
        userIds,
        embeddingTypes,
      });

    it('generates all the embeddings of a type in a single VoyageAI call and saves them one by one', async () => {
      const { processor, userProfileEmbeddingsService } = build();

      const result = await processor.generateUserProfileEmbeddingsBatch(
        batch(['u1', 'u2'])
      );

      expect(
        userProfileEmbeddingsService.generateEmbeddingsBatch
      ).toHaveBeenCalledTimes(1);
      expect(
        userProfileEmbeddingsService.generateEmbeddingsBatch
      ).toHaveBeenCalledWith([
        'profile:profile-of-u1',
        'profile:profile-of-u2',
      ]);
      expect(userProfileEmbeddingsService.saveEmbedding).toHaveBeenCalledWith(
        'profile-of-u1',
        'profile',
        '[0.1,0.2]'
      );
      expect(userProfileEmbeddingsService.saveEmbedding).toHaveBeenCalledWith(
        'profile-of-u2',
        'profile',
        '[0.1,0.2]'
      );
      expect(result).toBe(
        'Batch completed: 2 embeddings updated for 2 users. Invalid users: 0'
      );
      expect(trace).toHaveBeenCalledWith(
        { kind: 'workflow', name: 'user-profile-embedding' },
        expect.any(Function)
      );
      expect(annotate).toHaveBeenCalledWith(span, {
        tags: {
          batchSize: '2',
          feature: 'profile_recommendation',
          outcome: 'success',
        },
      });
    });

    it('makes one VoyageAI call per embedding type', async () => {
      const { processor, userProfileEmbeddingsService } = build();

      const result = await processor.generateUserProfileEmbeddingsBatch(
        batch(['u1', 'u2'], ['profile', 'needs'])
      );

      expect(
        userProfileEmbeddingsService.generateEmbeddingsBatch
      ).toHaveBeenCalledTimes(2);
      expect(result).toContain('4 embeddings updated for 2 users');
    });

    it('skips the users that do not exist or have no profile', async () => {
      const { processor, usersService, userProfilesService } = build();
      usersService.findOne.mockImplementation((id: string) =>
        Promise.resolve(id === 'ghost' ? null : { id, role: 'Coach' })
      );
      userProfilesService.findOneByUserId.mockImplementation((id: string) =>
        Promise.resolve(id === 'no-profile' ? null : { id: `profile-of-${id}` })
      );

      const result = await processor.generateUserProfileEmbeddingsBatch(
        batch(['u1', 'ghost', 'no-profile'])
      );

      expect(result).toBe(
        'Batch completed: 1 embeddings updated for 1 users. Invalid users: 2'
      );
    });

    it('fails when none of the users of the batch is valid', async () => {
      const { processor, usersService, userProfileEmbeddingsService } = build();
      usersService.findOne.mockResolvedValue(null);

      await expect(
        processor.generateUserProfileEmbeddingsBatch(batch(['ghost']))
      ).rejects.toThrow('No valid users found in batch');
      expect(
        userProfileEmbeddingsService.generateEmbeddingsBatch
      ).not.toHaveBeenCalled();
    });

    it('fails the job when the VoyageAI call fails, after having tried the other types', async () => {
      const { processor, userProfileEmbeddingsService } = build();
      userProfileEmbeddingsService.generateEmbeddingsBatch
        .mockRejectedValueOnce(new Error('voyage down'))
        .mockImplementation((texts: string[]) =>
          Promise.resolve(texts.map(() => [1]))
        );

      await expect(
        processor.generateUserProfileEmbeddingsBatch(
          batch(['u1'], ['profile', 'needs'])
        )
      ).rejects.toThrow(
        'Batch failed with 1 error(s): Failed to generate profile embeddings: voyage down'
      );
      // The second type has still been saved
      expect(userProfileEmbeddingsService.saveEmbedding).toHaveBeenCalledWith(
        'profile-of-u1',
        'needs',
        '[1]'
      );
      expect(annotate).toHaveBeenCalledWith(span, {
        tags: {
          batchSize: '1',
          feature: 'profile_recommendation',
          outcome: 'error',
        },
      });
    });

    it('fails the job and names the users whose embedding could not be saved', async () => {
      const { processor, userProfileEmbeddingsService } = build();
      userProfileEmbeddingsService.saveEmbedding.mockImplementation(
        async (profileId: string) => {
          if (profileId === 'profile-of-u2') throw new Error('db down');
        }
      );

      await expect(
        processor.generateUserProfileEmbeddingsBatch(batch(['u1', 'u2']))
      ).rejects.toThrow('Failed to save profile embeddings for 1 user(s): u2');
      expect(userProfileEmbeddingsService.saveEmbedding).toHaveBeenCalledTimes(
        2
      );
    });
  });
});
