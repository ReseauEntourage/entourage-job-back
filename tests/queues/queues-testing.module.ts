import { Module } from '@nestjs/common';
import { QueuesService } from 'src/queues/producers/queues.service';
import { QueuesServiceMock } from './queues.service.mock';

@Module({
  providers: [
    {
      provide: QueuesService,
      useClass: QueuesServiceMock,
    },
  ],
  exports: [QueuesService],
})
export class QueuesTestingModule {}
