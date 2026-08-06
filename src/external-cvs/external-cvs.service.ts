import fs from 'fs';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { v4 as uuid } from 'uuid';
import { S3Service } from 'src/external-services/aws/s3.service';
import { OpenAiService } from 'src/external-services/openai/openai.service';
import { Media } from 'src/medias/models';
import { UserProfilesService } from 'src/user-profiles/user-profiles.service';
import { ExternalCv } from './models/external-cv.model';
import { ExtractedCVData } from './models/extracted-cv-data.model';

const DEFAULT_CV_FILE_NAME = 'cv.pdf';

/**
 * Builds the `Content-Disposition` that makes the browser save the file under
 * the name the candidate uploaded it with, instead of deriving it from the S3
 * key (`{userId}_{uuid}.pdf`).
 *
 * Two forms are emitted, as per RFC 6266: `filename` is an ASCII-only fallback
 * for clients that ignore the extended form, and `filename*` (RFC 5987) is the
 * real name — accents are common in French file names and would otherwise be
 * mangled.
 */
const buildAttachmentDisposition = (fileName: string) => {
  const name = fileName?.trim() || DEFAULT_CV_FILE_NAME;
  // Drop anything outside printable ASCII, then the characters that would
  // close the quoted string early.
  const asciiFallback =
    name
      .replace(/[^\x20-\x7e]/g, '_')
      .replace(/["\\]/g, '')
      .trim() || DEFAULT_CV_FILE_NAME;

  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(
    name
  )}`;
};

@Injectable()
export class ExternalCvsService {
  constructor(
    private s3Service: S3Service,
    private userProfileService: UserProfilesService,
    private openAiService: OpenAiService,
    @InjectModel(ExtractedCVData)
    private extractedCVDataModel: typeof ExtractedCVData,
    @InjectModel(ExternalCv)
    private externalCvModel: typeof ExternalCv,
    @InjectModel(Media)
    private mediaModel: typeof Media
  ) {}

  /**
   * Uploads an external CV for a user.
   *
   * Each upload writes a brand new S3 object under a unique key and registers
   * it as a new `Media` + `ExternalCv` pair: no previous version is ever
   * overwritten, deleted or soft-deleted.
   *
   * @param userId - The ID of the user
   * @param file - The file to be uploaded
   * @returns {Promise<ExternalCv>} - The created link, with its media loaded
   */
  async uploadExternalCV(
    userId: string,
    file: Express.Multer.File
  ): Promise<ExternalCv> {
    const { path } = file;

    try {
      const userProfile = await this.userProfileService.findOneByUserId(
        userId,
        false
      );
      if (!userProfile) {
        throw new InternalServerErrorException();
      }

      const uploadedCV = await this.s3Service.upload(
        fs.readFileSync(path),
        'application/pdf',
        `external-cvs/${userId}_${uuid()}.pdf`
      );

      const media = await this.mediaModel.create({
        name: file.originalname ?? 'cv.pdf',
        s3Key: uploadedCV.key,
        mimeType: 'application/pdf',
        size: file.size,
        userId,
      });

      const externalCv = await this.externalCvModel.create({
        userProfileId: userProfile.id,
        mediaId: media.id,
      });
      externalCv.media = media;

      // The extracted data is profile-scoped and always describes the current
      // CV, so it is dropped as soon as a new CV becomes the current one.
      await this.extractedCVDataModel.destroy({
        where: { userProfileId: userProfile.id },
      });

      return externalCv;
    } catch {
      throw new InternalServerErrorException();
    } finally {
      if (fs.existsSync(path)) {
        fs.unlinkSync(path);
      }
    }
  }

  /**
   * Finds the current external CV of a profile: the most recently created
   * link that has not been soft-deleted.
   *
   * @param userProfileId - The ID of the user profile
   * @returns {Promise<ExternalCv | null>} - The link, with its media loaded
   */
  async findCurrentExternalCv(
    userProfileId: string
  ): Promise<ExternalCv | null> {
    return this.externalCvModel.findOne({
      where: { userProfileId },
      order: [['createdAt', 'DESC']],
      include: [{ model: Media, as: 'media' }],
    });
  }

  /**
   * Finds the current external CV of a user.
   *
   * @param userId - The ID of the user
   * @returns {Promise<ExternalCv | null>} - The link, with its media loaded
   */
  async findCurrentExternalCvByUserId(
    userId: string
  ): Promise<ExternalCv | null> {
    const userProfile = await this.userProfileService.findOneByUserId(
      userId,
      false
    );
    if (!userProfile) {
      return null;
    }
    return this.findCurrentExternalCv(userProfile.id);
  }

  /**
   * Builds a signed download URL for a CV media, from the key stored in
   * database — no key is ever reconstructed. The file is served back under the
   * name the candidate uploaded it with, not under its S3 key.
   *
   * @param media - The media holding the CV file
   * @returns {Promise<string | null>} - The signed URL, or null if the object is gone
   */
  async getExternalCvSignedUrl(media: Media): Promise<string | null> {
    if (!media) {
      return null;
    }
    try {
      const pdfExists = await this.s3Service.getHead(media.s3Key);
      if (pdfExists) {
        return this.s3Service.getSignedUrl(
          media.s3Key,
          'application/pdf',
          buildAttachmentDisposition(media.name)
        );
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Removes the external CV of a user.
   *
   * Every still-active link of the profile is soft-deleted — not only the most
   * recent one — so that no older version can resurface as the current CV.
   * Neither the `Media` rows nor the S3 objects are touched.
   *
   * @param userId - The ID of the user
   * @returns {Promise<void>}
   */
  async deleteExternalCv(userId: string) {
    const userProfile = await this.userProfileService.findOneByUserId(
      userId,
      false
    );
    if (!userProfile) {
      return;
    }
    await this.externalCvModel.destroy({
      where: { userProfileId: userProfile.id },
    });
  }

  /**
   * Erases every CV a user ever uploaded, for account deletion.
   *
   * Already soft-deleted links are included on purpose: removing a CV from a
   * profile never deletes the S3 object, so those files are still there.
   *
   * Both sides of the soft-delete invariant are recorded explicitly:
   * `Media.deletedAt` (the S3 object is really gone) and `ExternalCv.deletedAt`
   * (a link must never outlive its file) — neither is inferred from the
   * profile's own soft-delete.
   *
   * @param userId - The ID of the user whose account is being deleted
   * @returns {Promise<void>}
   */
  async deleteAllExternalCvsForUser(userId: string) {
    const userProfile = await this.userProfileService.findOneByUserId(
      userId,
      false
    );
    if (!userProfile) {
      return;
    }

    const externalCvs = await this.externalCvModel.findAll({
      where: { userProfileId: userProfile.id },
      paranoid: false,
      include: [{ model: Media, as: 'media', paranoid: false }],
    });

    if (externalCvs.length === 0) {
      return;
    }

    const mediaIds = [...new Set(externalCvs.map(({ mediaId }) => mediaId))];
    const s3Keys = [
      ...new Set(
        externalCvs
          .map(({ media }) => media?.s3Key)
          .filter((s3Key): s3Key is string => !!s3Key)
      ),
    ];

    if (s3Keys.length > 0) {
      await this.s3Service.deleteFiles(s3Keys);
    }

    await this.mediaModel.destroy({ where: { id: mediaIds } });
    await this.externalCvModel.destroy({
      where: { userProfileId: userProfile.id },
    });
  }
}
