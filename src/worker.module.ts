import { BullModule } from '@nestjs/bull';
import { CacheModule, Module } from '@nestjs/common';

import { ConfigModule } from '@nestjs/config';
import { SequelizeModule } from '@nestjs/sequelize';

import * as redisStore from 'cache-manager-redis-store';
import { ClientOpts } from 'redis';
import { ConsumersModule } from 'src/queues/consumers';
import { Queues } from 'src/queues/queues.types';
import { getRedisOptions, getSequelizeOptions } from './app.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    SequelizeModule.forRoot(getSequelizeOptions()),
    BullModule.forRoot({ redis: getRedisOptions() }),
    BullModule.registerQueue({
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
    }),
    CacheModule.register<ClientOpts>({
      isGlobal: true,
      store: redisStore,
      ...getRedisOptions(),
    }),
    ConsumersModule,
  ],
})
export class WorkerModule {}
