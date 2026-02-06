import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import {
  getBullWorkQueueOptions,
  getBullProfileGenerationQueueOptions,
  getBullCronTasksQueueOptions,
} from '../queues.utils';
import { QueuesService } from './queues.service';

@Module({
  imports: [
    BullModule.registerQueue(getBullWorkQueueOptions()),
    BullModule.registerQueue(getBullProfileGenerationQueueOptions()),
    BullModule.registerQueue(getBullCronTasksQueueOptions()),
  ],
  providers: [QueuesService],
  exports: [QueuesService],
})
export class QueuesModule {}
