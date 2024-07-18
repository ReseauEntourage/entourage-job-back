import fs from 'fs';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { S3Service } from 'src/external-services/aws/s3.service';
import { UserProfilesService } from 'src/user-profiles/user-profiles.service';

@Injectable()
export class ExternalCvsService {
  constructor(
    private s3Service: S3Service,
    private userProfileService: UserProfilesService
  ) {}

  /**
   * Uploads an external CV for a user
   * @param userId - The ID of the user
   * @param file - The file to be uploaded
   * @returns {Promise<string>} - The S3 key of the uploaded file
   */
  async uploadExternalCV(userId: string, file: Express.Multer.File) {
    const { path } = file;
    let uploadedCV: string;

    try {
      uploadedCV = await this.s3Service.upload(
        fs.readFileSync(path),
        'application/pdf',
        `external-cvs/${userId}.pdf`
      );
      await this.userProfileService.updateByUserId(userId, {
        hasExternalCv: true,
      });
      return uploadedCV;
    } catch (error) {
      throw new InternalServerErrorException();
    } finally {
      if (fs.existsSync(path)) {
        fs.unlinkSync(path);
      }
    }
  }

  /**
   * Finds the external CV of a user
   * @param key - The s3 key of the external CV
   * @returns {Promise<string | null>} - The signed URL of the external CV
   */
  async findExternalCv(key: string) {
    try {
      const pdfExists = await this.s3Service.getHead(key);
      if (pdfExists) {
        return this.s3Service.getSignedUrl(key);
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Deletes the external CV of a user
   * @param userId - The ID of the user
   * @returns {Promise<void>}
   */
  async deleteExternalCv(userId: string) {
    await this.userProfileService.updateByUserId(userId, {
      hasExternalCv: false,
    });
  }
}
