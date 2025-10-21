import { BullAdapter } from '@bull-board/api/bullAdapter';
import { BullBoardModule } from '@bull-board/nestjs';
import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { Queues } from '../queues.types';
import {
  getBullWorkQueueOptions,
  getBullProfileGenerationQueueOptions,
} from '../queues.utils';
import { QueuesService } from './queues.service';

@Module({
  imports: [
    BullModule.registerQueue(getBullWorkQueueOptions()),
    BullModule.registerQueue(getBullProfileGenerationQueueOptions()),
    BullBoardModule.forFeature({
      name: Queues.WORK,
      adapter: BullAdapter,
    }),
    BullBoardModule.forFeature({
      name: Queues.PROFILE_GENERATION,
      adapter: BullAdapter,
    }),
  ],
  providers: [QueuesService],
  exports: [QueuesService],
})
export class QueuesModule {}
