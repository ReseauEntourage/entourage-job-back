import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import {
  getBullWorkQueueOptions,
  getBullProfileGenerationQueueOptions,
  getBullCronTasksQueueOptions,
  getEmbeddingQueueOptions,
} from '../queues.utils';
import { QueuesService } from './queues.service';

@Module({
  imports: [
    BullModule.registerQueue(getBullWorkQueueOptions()),
    BullModule.registerQueue(getBullProfileGenerationQueueOptions()),
    BullModule.registerQueue(getBullCronTasksQueueOptions()),
    BullModule.registerQueue(getEmbeddingQueueOptions()),
  ],
  providers: [QueuesService],
  exports: [QueuesService],
})
export class QueuesModule {}
