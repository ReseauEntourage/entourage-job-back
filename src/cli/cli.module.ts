import { BullModule } from '@nestjs/bull';
import { CacheModule, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SequelizeModule } from '@nestjs/sequelize';
import * as ioRedisStore from 'cache-manager-ioredis';
import { RedisOptions } from 'ioredis';
import { getSequelizeOptions } from 'src/app.module';

import { EmbeddingsModule } from 'src/embeddings/embeddings.module';
import { REDIS_OPTIONS, RedisModule } from 'src/redis/redis.module';
import { RegenerateEmbeddingsCommand } from './commands/regenerate-embeddings.command';

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
    EmbeddingsModule,
  ],
  providers: [RegenerateEmbeddingsCommand],
})
export class CliModule {}
