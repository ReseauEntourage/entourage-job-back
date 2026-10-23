import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { RedisMetricsHistoryProvider } from '@bull-board/metrics';
import { BullBoardModule } from '@bull-board/nestjs';
import { Module } from '@nestjs/common';
import basicAuth from 'express-basic-auth';
import Redis from 'ioredis';
import { Queues } from '../queues.types';
import { REDIS_CLIENT, RedisModule } from 'src/redis/redis.module';
import { QueuesModule } from './queues.module';

@Module({
  imports: [
    QueuesModule,
    // forRootAsync : process.env est lu à l'instanciation, une fois le .env chargé par ConfigModule
    BullBoardModule.forRootAsync({
      imports: [RedisModule],
      inject: [REDIS_CLIENT],
      useFactory: (redisClient: Redis) => ({
        route: '/queues',
        adapter: ExpressAdapter,
        // History is recorded by the worker (QueuesMetricsRecorderService); the board only reads it
        boardOptions: {
          historyProvider: new RedisMetricsHistoryProvider({
            connection: redisClient,
          }),
        },
        middleware: basicAuth({
          challenge: true,
          users: { admin: process.env.QUEUES_ADMIN_PASSWORD },
        }),
      }),
    }),
    BullBoardModule.forFeature({
      name: Queues.WORK,
      adapter: BullMQAdapter,
    }),
    BullBoardModule.forFeature({
      name: Queues.PROFILE_GENERATION,
      adapter: BullMQAdapter,
    }),
    BullBoardModule.forFeature({
      name: Queues.CRON_TASKS,
      adapter: BullMQAdapter,
    }),
    BullBoardModule.forFeature({
      name: Queues.EMBEDDING,
      adapter: BullMQAdapter,
    }),
  ],
  exports: [QueuesModule],
})
export class QueuesBoardModule {}
