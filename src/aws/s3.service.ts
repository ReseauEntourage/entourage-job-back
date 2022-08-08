import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  PutObjectRequest,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl as s3GetSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';

@Injectable()
export class S3Service {
  private s3: S3Client;

  constructor() {
    this.s3 = new S3Client({
      region: 'eu-west-3',
      credentials: {
        accessKeyId: process.env.AWSS3_ID,
        secretAccessKey: process.env.AWSS3_SECRET,
      },
    });
  }

  async upload(
    data: PutObjectRequest['Body'],
    contentType: PutObjectRequest['ContentType'],
    outputPath: string,
    isPrivate: boolean
  ) {
    const key = `${
      contentType.includes('image/')
        ? process.env.AWSS3_IMAGE_DIRECTORY
        : process.env.AWSS3_FILE_DIRECTORY
    }${outputPath}`;

    const putObjectCommand = new PutObjectCommand({
      Bucket: process.env.AWSS3_BUCKET_NAME,
      Key: key, // File name you want to save as in S3
      Body: data,
      ACL: isPrivate ? 'private' : 'public-read', // allow public reading access to the file
      ContentType: contentType,
    });

    await this.s3.send(putObjectCommand);

    return key;
  }

  async deleteFiles(keys: string | string[]) {
    if (!Array.isArray(keys)) {
      keys = [keys];
    }
    const deleteObjectsCommand = new DeleteObjectsCommand({
      Bucket: process.env.AWSS3_BUCKET_NAME,
      Delete: {
        Objects: keys.map((key) => {
          return { Key: key };
        }),
      },
    });

    await this.s3.send(deleteObjectsCommand);
    return keys;
  }

  async getHead(key: string) {
    const headObjectCommand = new HeadObjectCommand({
      Bucket: process.env.AWSS3_BUCKET_NAME,
      Key: key,
    });

    return await this.s3.send(headObjectCommand);
  }

  async getSignedUrl(key: string) {
    const getObjectCommand = new GetObjectCommand({
      Bucket: process.env.AWSS3_BUCKET_NAME,
      Key: key,
      ResponseContentDisposition: 'attachment',
      ResponseContentType: 'application/pdf',
    });

    return s3GetSignedUrl(this.s3, getObjectCommand, {
      expiresIn: 60,
    });
  }
}
