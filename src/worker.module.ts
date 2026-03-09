import { BullModule } from '@nestjs/bull';
import { CacheModule, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { SequelizeModule } from '@nestjs/sequelize';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import * as ioRedisStore from 'cache-manager-ioredis';
import { RedisOptions } from 'ioredis';
import { ApiKeysModule } from 'src/api-keys/api-keys.module';
import { ConsumersModule } from 'src/queues/consumers';
import { getSequelizeOptions } from './app.module';
import { CronModule } from './cron/cron.module';
import { RedisModule, REDIS_OPTIONS } from './redis/redis.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    RedisModule, // Module Redis partagé
    SequelizeModule.forRoot(getSequelizeOptions()),
    BullModule.forRootAsync({
      imports: [RedisModule],
      inject: [REDIS_OPTIONS],
      useFactory: (redisOptions) => ({
        redis: redisOptions,
      }),
    }),
    CacheModule.registerAsync<RedisOptions>({
      isGlobal: true,
      imports: [RedisModule],
      inject: [REDIS_OPTIONS],
      useFactory: (redisOptions) => ({
        store: ioRedisStore,
        ...redisOptions,
      }),
    }),
    ConsumersModule,
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot({
      ttl: 60,
      limit: 100,
    }),
    ApiKeysModule,
    CronModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class WorkerModule {}
