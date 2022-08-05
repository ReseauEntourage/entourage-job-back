import { Module } from '@nestjs/common';
import { CloudfrontService } from './cloudfront.service';
import { S3Service } from './s3.service';

@Module({
  providers: [S3Service, CloudfrontService],
  exports: [S3Service, CloudfrontService],
})
export class AWSModule {}
