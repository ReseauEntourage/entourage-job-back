import { InjectQueue } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { JobOptions, Queue } from 'bull';
import { Job, JobData, Queues } from '../queues.types';

@Injectable()
export class QueuesService {
  constructor(
    @InjectQueue(Queues.WORK)
    private workQueue: Queue
  ) {}

  async addToWorkQueue<T extends Job>(
    type: T,
    data: JobData<T>,
    opts?: JobOptions
  ) {
    return this.workQueue.add(type, data, opts);
  }
}
