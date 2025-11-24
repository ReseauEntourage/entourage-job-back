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

export interface S3File {
  key: string;
  publicUrl: string | null;
}

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

  /**
   * Uploads a file to S3 and returns information about the uploaded file
   *
   * @param data - The file data to upload
   * @param contentType - The content type of the file
   * @param outputPath - The path where the file should be saved in S3
   * @param isPrivate - Whether the file should be private (default: false)
   * @param returnPublicUrl - Whether to return the public URL in addition to the key (default: false)
   * @returns The S3 key of the uploaded file and optionally the public URL
   */
  async upload(
    data: PutObjectCommandInput['Body'],
    contentType: PutObjectCommandInput['ContentType'],
    outputPath: string,
    isPrivate = false
  ): Promise<S3File> {
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

    // If the file is private, return only the key
    if (isPrivate) {
      return { key, publicUrl: null };
    }

    // Pour les fichiers publics, générer et retourner l'URL publique avec la clé
    const publicUrl = `https://${process.env.AWSS3_BUCKET_NAME}.s3.eu-west-3.amazonaws.com/${key}`;
    return { key, publicUrl };
  }

  async copyFile(sourceKey: string, destKey: string) {
    const { Body } = await this.download(sourceKey);
    return await this.upload(Body, 'image/jpeg', destKey);
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

  async getSignedUrl(
    key: string,
    contentType: string,
    contentDisposition = 'attachment'
  ) {
    const getObjectCommand = new GetObjectCommand({
      Bucket: process.env.AWSS3_BUCKET_NAME,
      Key: key,
      ResponseContentDisposition: contentDisposition,
      ResponseContentType: contentType,
    });

    return await s3GetSignedUrl(this.s3, getObjectCommand, {
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
