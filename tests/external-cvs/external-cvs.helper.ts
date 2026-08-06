import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { v4 as uuid } from 'uuid';
import { ExternalCv } from 'src/external-cvs/models/external-cv.model';
import { Media } from 'src/medias/models';

@Injectable()
export class ExternalCvsHelper {
  constructor(
    @InjectModel(ExternalCv)
    private externalCvModel: typeof ExternalCv,
    @InjectModel(Media)
    private mediaModel: typeof Media
  ) {}

  /**
   * Creates a CV version (a `Media` and the `ExternalCv` linking it to the
   * profile) without going through S3.
   */
  async createExternalCv(
    userProfileId: string,
    userId: string,
    props: { createdAt?: Date; deletedAt?: Date; name?: string } = {}
  ): Promise<ExternalCv> {
    const { name = 'cv.pdf', ...externalCvProps } = props;

    const media = await this.mediaModel.create({
      name,
      s3Key: `files/external-cvs/${userId}_${uuid()}.pdf`,
      mimeType: 'application/pdf',
      size: 1234,
      userId,
    });

    return this.externalCvModel.create({
      userProfileId,
      mediaId: media.id,
      ...externalCvProps,
    });
  }

  async findExternalCvs(
    userProfileId: string,
    { withDeleted = false } = {}
  ): Promise<ExternalCv[]> {
    return this.externalCvModel.findAll({
      where: { userProfileId },
      order: [['createdAt', 'ASC']],
      paranoid: !withDeleted,
    });
  }

  async findMedia(mediaId: string): Promise<Media | null> {
    return this.mediaModel.findByPk(mediaId, { paranoid: false });
  }

  /**
   * Soft-deletes a media without soft-deleting the links pointing at it, to
   * reproduce a broken cascade (the state the `required` include guards).
   */
  async deleteMedia(mediaId: string): Promise<number> {
    return this.mediaModel.destroy({ where: { id: mediaId } });
  }
}
