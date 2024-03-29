import {
  CloudFrontClient,
  CreateInvalidationCommand,
} from '@aws-sdk/client-cloudfront';

import { Injectable } from '@nestjs/common';

@Injectable()
export class CloudFrontService {
  private cloudFront: CloudFrontClient;

  constructor() {
    this.cloudFront = new CloudFrontClient({
      region: 'eu-west-3',
      credentials: {
        accessKeyId: process.env.AWSS3_ID,
        secretAccessKey: process.env.AWSS3_SECRET,
      },
    });
  }

  async invalidateCache(itemPaths: string[]) {
    const invalidateObjectCommand = new CreateInvalidationCommand({
      DistributionId: process.env.CDN_ID,
      InvalidationBatch: {
        CallerReference: Date.now().toString(),
        Paths: {
          Quantity: itemPaths.length,
          Items: itemPaths.map((itemPath) => {
            return encodeURI(itemPath);
          }),
        },
      },
    });

    const { Invalidation: Id } = await this.cloudFront.send(
      invalidateObjectCommand
    );

    return Id;
  }
}
