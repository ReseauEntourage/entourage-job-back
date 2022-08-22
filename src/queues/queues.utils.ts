import { BullModuleOptions } from '@nestjs/bull';
import { Queues } from './queues.types';

export function getBullWorkQueueOptions(): BullModuleOptions {
  return {
    name: Queues.WORK,
    defaultJobOptions: {
      attempts: `${process.env.JOBS_NB_ATTEMPS}`
        ? parseInt(process.env.JOBS_NB_ATTEMPS)
        : 10,
      backoff: {
        type: 'exponential',
        delay: `${process.env.JOBS_BACKOFF_DELAY}`
          ? parseInt(process.env.JOBS_BACKOFF_DELAY, 10)
          : 60000,
      },
      removeOnFail: true,
      removeOnComplete: true,
    },
  };
}
