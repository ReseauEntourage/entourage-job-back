import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Transaction } from 'sequelize';
import { v4 as uuid } from 'uuid';
import { S3Service } from 'src/external-services/aws/s3.service';
import { mediaAttributes } from 'src/messaging/messaging.attributes';
import { Conversation, Message } from 'src/messaging/models';
import { Media } from './models';

@Injectable()
export class MediasService {
  constructor(
    @InjectModel(Media)
    private mediaModel: typeof Media,
    private s3Service: S3Service
  ) {}

  /**
   * Upload a media file to S3 and create a media record in the database
   * @param files The media files to upload
   * @returns The created media records
   */
  async bulkUploadAndCreateMedias(
    files: Express.Multer.File[],
    uploaderId: string
  ) {
    // First upload all files to S3 one by one
    const uploadedFilesData = await Promise.all(
      files.map(async (file) => {
        const { fileName, s3Key } = await this.uploadMedia(file);
        return {
          userId: uploaderId,
          name: fileName,
          s3Key: s3Key.key,
          mimeType: file.mimetype,
          size: file.size,
        };
      })
    );
    return this.mediaModel.bulkCreate(uploadedFilesData);
  }

  /**
   * Fills the `signedUrl` virtual field of the given medias, in place.
   *
   * Must be called by every path that serves medias to the client — and only
   * by those: signing is useless for internal reads, and doing it here rather
   * than in a model hook keeps `S3Service` injected, hence stubbable in tests.
   *
   * @param medias The medias to sign
   * @returns The same medias, with `signedUrl` set
   */
  async attachSignedUrls<T extends Media>(medias: T[]): Promise<T[]> {
    await Promise.all(
      medias.map(async (media) => {
        media.signedUrl = await this.s3Service.getSignedUrl(
          media.s3Key,
          media.mimeType,
          'inline' // Permit to display the file directly in the browser
        );
      })
    );
    return medias;
  }

  async findMediasByConversationId(
    conversationId: string,
    transaction?: Transaction
  ) {
    // Media is linked to a message, which is linked to a conversation
    // So we need to find all messages linked to the conversation
    // And then find all medias linked to the messages but without the assiociations
    // This is because we only need the medias and not the messages
    const medias = await this.mediaModel.findAll({
      attributes: mediaAttributes,
      include: [
        {
          model: Message,
          as: 'message',
          required: true,
          attributes: [],
          include: [
            {
              model: Conversation,
              as: 'conversation',
              where: {
                id: conversationId,
              },
              attributes: [],
            },
          ],
          // through: { attributes: [] },
        },
      ],
      transaction,
    });

    return this.attachSignedUrls(medias);
  }

  async findMediaByMessageId(messageId: string, transaction?: Transaction) {
    const medias = await this.mediaModel.findAll({
      attributes: mediaAttributes,
      include: [
        {
          model: Message,
          as: 'message',
          where: {
            id: messageId,
          },
          attributes: [],
        },
      ],
      transaction,
    });

    return this.attachSignedUrls(medias);
  }

  //////////////////////
  // Private methods //
  //////////////////////

  /**
   * Upload a media file to S3
   * The filename in S3 will be the original filename with a random string appended
   *
   * @param file
   * @returns
   */
  private async uploadMedia(file: Express.Multer.File) {
    const randomString = uuid();
    const originalName = file.originalname;
    const extension = originalName.split('.').pop();
    const fileName = `${originalName.replace(
      '.' + extension,
      ''
    )}_${randomString}.${extension}`;
    const s3Key = await this.s3Service.upload(
      file.buffer,
      file.mimetype,
      fileName,
      true
    );
    return {
      fileName,
      s3Key,
    };
  }
}
