import { _Object, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';

export class S3Service {
  private s3: S3Client;

  constructor() {
    this.s3 = new S3Client({
      region: 'eu-west-3',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });
  }

  async fetchAllObjects(extension: string) {
    let isTruncated = true;
    let continuationToken: string | undefined = undefined;
    const allObjects: _Object[] = [];

    try {
      while (isTruncated) {
        const command = new ListObjectsV2Command({
          Bucket: process.env.AWSS3_BUCKET_NAME,
          Prefix: process.env.AWSS3_IMAGE_DIRECTORY,
          ContinuationToken: continuationToken,
        });

        const s3Response = await this.s3.send(command);

        const filteredObjects =
          s3Response.Contents?.filter((item: _Object) =>
            item.Key?.endsWith(extension)
          ).map((item) => item) || [];

        allObjects.push(...filteredObjects);

        isTruncated = s3Response.IsTruncated ?? false;
        continuationToken = s3Response.NextContinuationToken;
      }
    } catch (error) {
      console.error(`Error retrieving S3 objects: ${error}`);
      return [];
    }
    return allObjects;
  }
}
