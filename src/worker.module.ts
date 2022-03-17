import { Module } from '@nestjs/common';

import { SequelizeModule } from '@nestjs/sequelize';

import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { MailsModule } from './mails/mails.module';
import { getBullOptions, getSequelizeOptions } from './app.module';
import { Queues } from './queues/queues.type';
import { ConsumersModule } from './queues/consumers/consumers.module';

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
