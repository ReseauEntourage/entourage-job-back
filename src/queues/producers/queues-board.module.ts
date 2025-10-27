import { BullAdapter } from '@bull-board/api/bullAdapter';
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
      adapter: BullAdapter,
    }),
    BullBoardModule.forFeature({
      name: Queues.PROFILE_GENERATION,
      adapter: BullAdapter,
    }),
  ],
  exports: [QueuesModule],
})
export class QueuesBoardModule {}
