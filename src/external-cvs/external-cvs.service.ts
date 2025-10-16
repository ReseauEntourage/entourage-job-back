import fs from 'fs';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { S3File, S3Service } from 'src/external-services/aws/s3.service';
import { CvSchemaType } from 'src/external-services/openai/openai.schemas';
import { OpenAiService } from 'src/external-services/openai/openai.service';
import { UserProfilesService } from 'src/user-profiles/user-profiles.service';
import { ExtractedCVData } from './models/extracted-cv-data.model';

@Injectable()
export class ExternalCvsService {
  constructor(
    private s3Service: S3Service,
    private userProfileService: UserProfilesService,
    private openAiService: OpenAiService,
    @InjectModel(ExtractedCVData)
    private extractedCVDataModel: typeof ExtractedCVData
  ) {}

  /**
   * Uploads an external CV for a user
   * @param userId - The ID of the user
   * @param file - The file to be uploaded
   * @returns {Promise<string>} - The S3 key of the uploaded file
   */
  async uploadExternalCV(
    userId: string,
    file: Express.Multer.File
  ): Promise<string> {
    const { path } = file;
    let uploadedCV: S3File;

    try {
      uploadedCV = await this.s3Service.upload(
        fs.readFileSync(path),
        'application/pdf',
        `external-cvs/${userId}.pdf`
      );
      await this.userProfileService.updateByUserId(userId, {
        hasExternalCv: true,
      });

      const userProfile = await this.userProfileService.findOneByUserId(
        userId,
        false
      );
      await this.extractedCVDataModel.destroy({
        where: { userProfileId: userProfile.id },
      });
      return uploadedCV.key;
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
        return this.s3Service.getSignedUrl(
          key,
          'application/pdf',
          'attachment'
        );
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

  async extractDataFromCVImages(
    base64ImageArray: string[]
  ): Promise<CvSchemaType> {
    try {
      return await this.openAiService.extractCVFromImages(base64ImageArray);
    } catch (error) {
      throw error;
    }
  }
}
