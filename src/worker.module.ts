import { Module } from '@nestjs/common';
import { ApiKeysModule } from 'src/api-keys/api-keys.module';
import { WorkerControllerModule } from 'src/worker/worker.module';

@Module({
  imports: [ApiKeysModule, WorkerControllerModule],
  providers: [],
})
export class WorkerModule {}
