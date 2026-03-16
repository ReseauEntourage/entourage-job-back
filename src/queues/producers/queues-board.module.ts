import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { BullBoardModule } from '@bull-board/nestjs';
import { Module } from '@nestjs/common';
import basicAuth from 'express-basic-auth';
import { Queues } from '../queues.types';
import { QueuesModule } from './queues.module';

@Module({
  imports: [
    QueuesModule,
    BullBoardModule.forRoot({
      route: '/queues',
      adapter: ExpressAdapter,
      middleware: basicAuth({
        challenge: true,
        users: { admin: process.env.QUEUES_ADMIN_PASSWORD },
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
