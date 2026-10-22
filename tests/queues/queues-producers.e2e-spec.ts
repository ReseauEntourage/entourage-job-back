import { QueuesService } from 'src/queues/producers/queues.service';
import { Jobs, QueuePriority } from 'src/queues/queues.types';
import {
  getBullCronTasksQueueOptions,
  getBullProfileGenerationQueueOptions,
  getBullWorkQueueOptions,
  getEmbeddingQueueOptions,
} from 'src/queues/queues.utils';

describe('QueuesService', () => {
  const buildQueue = () => ({
    add: jest.fn().mockResolvedValue({ id: 'job-1' }),
    getJob: jest.fn().mockResolvedValue({ id: 'job-1' }),
  });

  const build = () => {
    const work = buildQueue();
    const profileGeneration = buildQueue();
    const cronTasks = buildQueue();
    const embedding = buildQueue();
    const service = new QueuesService(
      work as never,
      profileGeneration as never,
      cronTasks as never,
      embedding as never
    );
    return { service, work, profileGeneration, cronTasks, embedding };
  };

  it('adds work jobs to the work queue only', async () => {
    const { service, work, profileGeneration, cronTasks, embedding } = build();
    const data = { to: '+33600000000', text: 'hello' };

    const result = await service.addToWorkQueue(Jobs.SEND_SMS, data, {
      delay: 5,
    });

    expect(work.add).toHaveBeenCalledWith(Jobs.SEND_SMS, data, { delay: 5 });
    expect(result).toEqual({ id: 'job-1' });
    expect(profileGeneration.add).not.toHaveBeenCalled();
    expect(cronTasks.add).not.toHaveBeenCalled();
    expect(embedding.add).not.toHaveBeenCalled();
  });

  it('adds profile generation jobs to the profile generation queue only', async () => {
    const { service, work, profileGeneration } = build();
    const data = {
      s3Key: 'key',
      userProfileId: 'p1',
      userId: 'u1',
      fileHash: 'hash',
    };

    await service.addToProfileGenerationQueue(
      Jobs.GENERATE_PROFILE_FROM_PDF,
      data as never
    );

    expect(profileGeneration.add).toHaveBeenCalledWith(
      Jobs.GENERATE_PROFILE_FROM_PDF,
      data,
      undefined
    );
    expect(work.add).not.toHaveBeenCalled();
  });

  it('adds cron jobs to the cron tasks queue only', async () => {
    const { service, work, cronTasks } = build();

    await service.addToCronTasksQueue(Jobs.DELETE_INACTIVE_USERS, {});

    expect(cronTasks.add).toHaveBeenCalledWith(
      Jobs.DELETE_INACTIVE_USERS,
      {},
      undefined
    );
    expect(work.add).not.toHaveBeenCalled();
  });

  it('adds embedding jobs to the embedding queue only', async () => {
    const { service, work, embedding } = build();
    const data = { userId: 'u1', embeddingTypes: ['profile'] };

    await service.addToEmbeddingQueue(
      Jobs.UPDATE_USER_PROFILE_EMBEDDINGS,
      data as never,
      { jobId: 'custom' }
    );

    expect(embedding.add).toHaveBeenCalledWith(
      Jobs.UPDATE_USER_PROFILE_EMBEDDINGS,
      data,
      { jobId: 'custom' }
    );
    expect(work.add).not.toHaveBeenCalled();
  });

  it('retrieves a profile generation job by id', async () => {
    const { service, profileGeneration } = build();

    const job = await service.getProfileGenerationJob('job-1');

    expect(profileGeneration.getJob).toHaveBeenCalledWith('job-1');
    expect(job).toEqual({ id: 'job-1' });
  });

  it('propagates the queue errors to the caller', async () => {
    const { service, work } = build();
    work.add.mockRejectedValue(new Error('redis down'));

    await expect(
      service.addToWorkQueue(Jobs.SEND_SMS, { to: '1', text: 't' })
    ).rejects.toThrow('redis down');
  });
});

describe('queue options', () => {
  const savedEnv = {
    attempts: process.env.JOBS_NB_ATTEMPS,
    delay: process.env.JOBS_BACKOFF_DELAY,
  };

  const restore = (key: string, value: string | undefined) => {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  };

  afterEach(() => {
    restore('JOBS_NB_ATTEMPS', savedEnv.attempts);
    restore('JOBS_BACKOFF_DELAY', savedEnv.delay);
  });

  it('retries work jobs 10 times with a 1 minute exponential backoff by default', () => {
    delete process.env.JOBS_NB_ATTEMPS;
    delete process.env.JOBS_BACKOFF_DELAY;

    const options = getBullWorkQueueOptions();

    expect(options.defaultJobOptions).toMatchObject({
      attempts: 10,
      backoff: { type: 'exponential', delay: 60000 },
      removeOnFail: false,
      removeOnComplete: true,
      priority: QueuePriority.NORMAL,
    });
  });

  it('lets the environment override the work queue retries and backoff', () => {
    process.env.JOBS_NB_ATTEMPS = '3';
    process.env.JOBS_BACKOFF_DELAY = '500';

    const options = getBullWorkQueueOptions();

    expect(options.defaultJobOptions).toMatchObject({
      attempts: 3,
      backoff: { type: 'exponential', delay: 500 },
    });
  });

  it('never retries profile generation jobs and gives them a high priority', () => {
    const options = getBullProfileGenerationQueueOptions();

    expect(options.defaultJobOptions).toMatchObject({
      attempts: 1,
      priority: QueuePriority.HIGH,
      removeOnFail: false,
    });
  });

  it('never retries cron jobs and gives them a low priority', () => {
    const options = getBullCronTasksQueueOptions();

    expect(options.defaultJobOptions).toMatchObject({
      attempts: 1,
      priority: QueuePriority.LOW,
      removeOnFail: false,
    });
  });

  it('retries embedding jobs 5 times with a 1 minute exponential backoff', () => {
    const options = getEmbeddingQueueOptions();

    expect(options.defaultJobOptions).toMatchObject({
      attempts: 5,
      backoff: { type: 'exponential', delay: 60000 },
      priority: QueuePriority.NORMAL,
    });
  });

  it('gives the queues distinct names', () => {
    const names = [
      getBullWorkQueueOptions().name,
      getBullProfileGenerationQueueOptions().name,
      getBullCronTasksQueueOptions().name,
      getEmbeddingQueueOptions().name,
    ];

    expect(new Set(names).size).toBe(4);
  });
});
