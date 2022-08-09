import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { getBullWorkQueueOptions } from 'src/queues/queues.types';

@Module({
  imports: [BullModule.registerQueue(getBullWorkQueueOptions())],
  exports: [BullModule],
})
export class QueuesModule {}
