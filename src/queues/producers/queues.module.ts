import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import {
  getBullWorkQueueOptions,
  getBullProfileGenerationQueueOptions,
} from '../queues.utils';
import { QueuesService } from './queues.service';

@Module({
  imports: [
    BullModule.registerQueue(getBullWorkQueueOptions()),
    BullModule.registerQueue(getBullProfileGenerationQueueOptions()),
  ],
  providers: [QueuesService],
  exports: [QueuesService],
})
export class QueuesModule {}
