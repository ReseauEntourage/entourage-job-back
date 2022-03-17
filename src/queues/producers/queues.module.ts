import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { getBullWorkQueueOptions, Queues } from '../queues.type';

@Module({
  imports: [BullModule.registerQueue(getBullWorkQueueOptions())],
  exports: [BullModule],
})
export class QueuesModule {}
