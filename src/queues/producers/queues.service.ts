import { InjectQueue } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { JobOptions, Queue } from 'bull';
import { Job, JobData, Queues } from '../queues.types';

@Injectable()
export class QueuesService {
  constructor(
    @InjectQueue(Queues.WORK)
    private workQueue: Queue,
    @InjectQueue(Queues.PROFILE_GENERATION)
    private readonly profileGenerationQueue: Queue,
    @InjectQueue(Queues.CRON_TASKS)
    private readonly cronTasksQueue: Queue
  ) {}

  async addToWorkQueue<T extends Job>(
    type: T,
    data: JobData<T>,
    opts?: JobOptions
  ) {
    return this.workQueue.add(type, data, opts);
  }

  async addToProfileGenerationQueue<T extends Job>(
    type: T,
    data: JobData<T>,
    opts?: JobOptions
  ) {
    return this.profileGenerationQueue.add(type, data, opts);
  }

  async addToCronTasksQueue<T extends Job>(
    type: T,
    data: JobData<T>,
    opts?: JobOptions
  ) {
    return this.cronTasksQueue.add(type, data, opts);
  }
}
