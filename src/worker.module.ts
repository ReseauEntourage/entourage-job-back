import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';

import { ConfigModule } from '@nestjs/config';
import { SequelizeModule } from '@nestjs/sequelize';

import { Queues } from 'src/queues';
import { ConsumersModule } from 'src/queues/consumers';
import { getBullOptions, getSequelizeOptions } from './app.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    SequelizeModule.forRoot(getSequelizeOptions(process.env.DATABASE_URL)),
    BullModule.forRoot(getBullOptions(process.env.REDIS_TLS_URL)),
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
    ConsumersModule,
  ],
})
export class WorkerModule {}
