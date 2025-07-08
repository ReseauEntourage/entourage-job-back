import { Module } from '@nestjs/common';
import { AWSModule } from 'src/external-services/aws/aws.module';
import { CVsController } from './cvs.controller';
import { CVsService } from './cvs.service';

@Module({
  imports: [AWSModule],
  providers: [CVsService],
  controllers: [CVsController],
  exports: [CVsService],
})
export class CVsModule {}
