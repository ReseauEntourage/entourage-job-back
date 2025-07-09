import { forwardRef, Module } from '@nestjs/common';
import { QueuesModule } from 'src/queues/producers/queues.module';
import { ExternalDatabasesService } from './external-databases.service';

@Module({
  imports: [forwardRef(() => QueuesModule)],
  providers: [ExternalDatabasesService],
  exports: [ExternalDatabasesService],
})
export class ExternalDatabasesModule {}
