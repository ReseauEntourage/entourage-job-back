import { Module } from '@nestjs/common';
import { QueuesModule } from 'src/queues/producers';
import { ExternalDatabasesService } from './external-databases.service';

@Module({
  imports: [QueuesModule],
  providers: [ExternalDatabasesService],
  exports: [ExternalDatabasesService],
})
export class ExternalDatabasesModule {}
