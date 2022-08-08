import { Module } from '@nestjs/common';
import { CloudFrontService } from './cloud-front.service';
import { S3Service } from './s3.service';

@Module({
  providers: [CloudFrontService, S3Service],
  exports: [CloudFrontService, S3Service],
})
export class AWSModule {}
