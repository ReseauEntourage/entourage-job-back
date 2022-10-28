import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { getBullWorkQueueOptions } from 'src/queues/queues.utils';
import { QueuesService } from './queues.service';

@Module({
  imports: [BullModule.registerQueue(getBullWorkQueueOptions())],
  providers: [QueuesService],
  exports: [QueuesService],
})
export class QueuesModule {}
