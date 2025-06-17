import { BullModule } from '@nestjs/bull';
import { CacheModule, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { SequelizeModule } from '@nestjs/sequelize';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import * as redisStore from 'cache-manager-redis-store';
import { ClientOpts } from 'redis';
import { ConsumersModule } from 'src/queues/consumers';
import { Queues } from 'src/queues/queues.types';
import { getRedisOptions, getSequelizeOptions } from './app.module';
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    RedisModule, // Module Redis partagé
    SequelizeModule.forRoot(getSequelizeOptions()),
    BullModule.forRootAsync({
      imports: [RedisModule],
      inject: ['REDIS_CLIENT'],
      useFactory: (redisClient) => ({
        createClient: () => redisClient,
      }),
    }),
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
    ThrottlerModule.forRoot({
      ttl: 60,
      limit: 100,
    }),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class WorkerModule {}
