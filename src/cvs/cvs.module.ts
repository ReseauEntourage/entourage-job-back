import { Module } from '@nestjs/common';
import { AWSModule } from 'src/external-services/aws/aws.module';
import { QueuesModule } from 'src/queues/producers/queues.module';
import { CVsController } from './cvs.controller';
import { CVsService } from './cvs.service';

@Module({
  imports: [QueuesModule, AWSModule],
  providers: [CVsService],
  controllers: [CVsController],
  exports: [CVsService],
})
export class CVsModule {}
