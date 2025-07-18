import { Injectable } from '@nestjs/common';
import { JobOptions } from 'bull';
import { Job, JobData } from 'src/queues/queues.types';

@Injectable()
export class QueuesServiceMock {
  /* eslint-disable @typescript-eslint/no-unused-vars */

  async addToWorkQueue<T extends Job>(
    type: T,
    data: JobData<T>,
    opts?: JobOptions
  ) {
    // Mock implementation that doesn't actually perform any operation
    return { id: 'mock-job-id' };
  }

  async addToProfileGenerationQueue<T extends Job>(
    type: T,
    data: JobData<T>,
    opts?: JobOptions
  ) {
    // Mock implementation that doesn't actually perform any operation
    return { id: 'mock-job-id' };
  }
  /* eslint-enable @typescript-eslint/no-unused-vars */
}
