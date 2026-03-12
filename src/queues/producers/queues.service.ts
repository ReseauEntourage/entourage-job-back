import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue, JobsOptions } from 'bullmq';
import { Job, JobData, Queues } from '../queues.types';

@Injectable()
export class QueuesService {
  private readonly logger = new Logger(QueuesService.name);

  constructor(
    @InjectQueue(Queues.WORK)
    private workQueue: Queue,
    @InjectQueue(Queues.PROFILE_GENERATION)
    private readonly profileGenerationQueue: Queue,
    @InjectQueue(Queues.CRON_TASKS)
    private readonly cronTasksQueue: Queue,
    @InjectQueue(Queues.EMBEDDING)
    private readonly embeddingQueue: Queue
  ) {}

  async addToWorkQueue<T extends Job>(
    type: T,
    data: JobData<T>,
    opts?: JobsOptions
  ) {
    this.logger.log(`Adding job to work queue: ${type}`);
    return this.workQueue.add(type, data, opts);
  }

  async addToProfileGenerationQueue<T extends Job>(
    type: T,
    data: JobData<T>,
    opts?: JobsOptions
  ) {
    this.logger.log(`Adding job to profile generation queue: ${type}`);
    return this.profileGenerationQueue.add(type, data, opts);
  }

  async addToCronTasksQueue<T extends Job>(
    type: T,
    data: JobData<T>,
    opts?: JobsOptions
  ) {
    this.logger.log(`Adding job to cron tasks queue: ${type}`);
    return this.cronTasksQueue.add(type, data, opts);
  }

  async addToEmbeddingQueue<T extends Job>(
    type: T,
    data: JobData<T>,
    opts?: JobsOptions
  ) {
    this.logger.log(`Adding job to embedding queue: ${type}`);
    return this.embeddingQueue.add(type, data, opts);
  }
}
