import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommandInput,
  S3Client,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';

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
    data: PutObjectCommandInput['Body'],
    contentType: PutObjectCommandInput['ContentType'],
    outputPath: string,
    isPrivate = false
  ) {
    const key = `${
      contentType.includes('image/')
        ? process.env.AWSS3_IMAGE_DIRECTORY
        : process.env.AWSS3_FILE_DIRECTORY
    }${outputPath}`;

    const upload = new Upload({
      client: this.s3,
      params: {
        Bucket: process.env.AWSS3_BUCKET_NAME,
        Key: key, // File name you want to save as in S3
        Body: data,
        ACL: isPrivate ? 'private' : 'public-read', // allow public reading access to the file
        ContentType: contentType,
      },
    });

    await upload.done();

    return key;
  }

  async copyFile(sourceKey: string, destKey: string) {
    const { Body } = await this.download(sourceKey);
    await this.upload(Body, 'image/jpeg', destKey);
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

    return this.s3.send(headObjectCommand);
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

  private async download(key: string) {
    const getObjectCommand = new GetObjectCommand({
      Bucket: process.env.AWSS3_BUCKET_NAME,
      Key: key,
    });
    return this.s3.send(getObjectCommand);
  }
}
