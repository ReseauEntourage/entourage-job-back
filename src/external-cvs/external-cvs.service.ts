import fs from 'fs';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { ToBase64Response } from 'pdf2pic/dist/types/convertResponse';
import { S3Service } from 'src/external-services/aws/s3.service';
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

  async shouldExtractCV(userId: string, fileHash: string): Promise<boolean> {
    try {
      // Vérification si des données extraites existent déjà pour cet utilisateur
      const existingData = await this.extractedCVDataModel.findOne({
        where: { userId: userId },
      });

      // Si aucune donnée n'existe, une extraction est nécessaire
      if (!existingData) {
        return true;
      }

      // Si le hash du fichier est différent, une nouvelle extraction est nécessaire
      return existingData.fileHash !== fileHash;
    } catch (error) {
      // En cas d'erreur, effectuer une extraction par sécurité
      return true;
    }
  }

  async extractDataFromCVImages(
    image: ToBase64Response
  ): Promise<CvSchemaType> {
    try {
      return await this.openAiService.extractCVFromImages(image);
    } catch (error) {
      throw error;
    }
  }

  async getExtractedCVData(userId: string): Promise<CvSchemaType | null> {
    try {
      const existingData = await this.extractedCVDataModel.findOne({
        where: { userId: userId },
      });

      if (!existingData) {
        return null;
      }

      return existingData.data as CvSchemaType;
    } catch (error) {
      throw error;
    }
  }

  async saveExtractedCVData(
    userId: string,
    data: CvSchemaType,
    fileHash: string
  ): Promise<ExtractedCVData> {
    try {
      // Vérification si des données existent déjà pour cet utilisateur
      const existingData = await this.extractedCVDataModel.findOne({
        where: { userId: userId },
      });

      if (existingData) {
        // Mise à jour des données existantes
        await existingData.update({ data, fileHash });
        return existingData;
      } else {
        // Création d'une nouvelle entrée
        return await this.extractedCVDataModel.create({
          userId: userId,
          data,
          fileHash,
        });
      }
    } catch (error) {
      throw error;
    }
  }
}
