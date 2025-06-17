import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Experience } from 'src/common/experiences/models';
import { Formation } from 'src/common/formations/models';
import { Interest } from 'src/common/interests/models';
import { LanguagesService } from 'src/common/languages/languages.service';
import { Department } from 'src/common/locations/locations.types';
import { Skill } from 'src/common/skills/models';
import { detectPdftocairoPath } from 'src/cvs/cvs.utils';
import { S3Service } from 'src/external-services/aws/s3.service';
import {
  CvSchemaType,
  SCHEMA_VERSION,
} from 'src/external-services/openai/openai.schemas';
import { OpenAiService } from 'src/external-services/openai/openai.service';
import { UserProfile } from 'src/user-profiles/models';
import { UserProfileLanguage } from 'src/user-profiles/models/user-profile-language.model';
import { UserProfilesService } from 'src/user-profiles/user-profiles.service';
import { ExtractedCVData } from './models/extracted-cv-data.model';

@Injectable()
export class ExternalCvsService {
  constructor(
    private s3Service: S3Service,
    private userProfileService: UserProfilesService,
    private openAiService: OpenAiService,
    @InjectModel(ExtractedCVData)
    private extractedCVDataModel: typeof ExtractedCVData,
    private languagesService: LanguagesService
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

      const userProfile = await this.userProfileService.findOneByUserId(
        userId,
        false
      );
      await this.extractedCVDataModel.destroy({
        where: { userProfileId: userProfile.id },
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

  async shouldExtractCV(
    userProfileId: string,
    fileHash: string
  ): Promise<boolean> {
    try {
      const currentSchemaVersion = SCHEMA_VERSION;
      // Vérification si des données extraites existent déjà pour cet utilisateur
      const existingData = await this.extractedCVDataModel.findOne({
        where: { userProfileId },
      });

      // Si aucune donnée n'existe, une extraction est nécessaire
      if (!existingData) {
        return true;
      }

      // Une nouvelle extraction est nécessaire si :
      // - le hash du fichier est différent, ou
      // - la version du schéma est différente
      return (
        existingData.fileHash !== fileHash ||
        existingData.schemaVersion !== currentSchemaVersion
      );
    } catch (error) {
      // En cas d'erreur, effectuer une extraction par sécurité
      return true;
    }
  }

  async extractDataFromCVImages(base64Image: string): Promise<CvSchemaType> {
    try {
      return await this.openAiService.extractCVFromImages(base64Image);
    } catch (error) {
      throw error;
    }
  }

  async getExtractedCVData(
    userProfileId: string
  ): Promise<CvSchemaType | null> {
    try {
      const existingData = await this.extractedCVDataModel.findOne({
        where: { userProfileId },
      });

      if (!existingData) {
        return null;
      }

      return existingData.data as CvSchemaType;
    } catch (error) {
      throw error;
    }
  }

  async hasExtractedCVData(userProfileId: string): Promise<boolean> {
    try {
      const existingData = await this.extractedCVDataModel.findOne({
        where: { userProfileId },
      });
      return !!existingData;
    } catch (error) {
      throw error;
    }
  }

  async saveExtractedCVData(
    userProfileId: string,
    data: CvSchemaType,
    fileHash: string
  ): Promise<ExtractedCVData> {
    try {
      const currentSchemaVersion = SCHEMA_VERSION;
      // Vérification si des données existent déjà pour cet utilisateur
      const existingData = await this.extractedCVDataModel.findOne({
        where: { userProfileId },
      });

      if (existingData) {
        // Mise à jour des données existantes
        await existingData.update({
          data,
          fileHash,
          schemaVersion: currentSchemaVersion,
        });
        return existingData;
      } else {
        // Création d'une nouvelle entrée
        return await this.extractedCVDataModel.create({
          userProfileId,
          data,
          fileHash,
          schemaVersion: currentSchemaVersion,
        });
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * Populates user profile with data extracted from a CV
   * @param userId - The ID of the user
   * @param cvData - The data extracted from the CV
   * @returns {Promise<void>}
   */
  async populateUserProfileFromCVData(
    userId: string,
    cvData: CvSchemaType
  ): Promise<void> {
    try {
      // Mise à jour des informations de base du profil utilisateur
      const userProfileDto: Partial<UserProfile> & {
        nudgeIds?: string[];
      } = {};

      const userProfile = await this.userProfileService.findOneByUserId(userId);
      if (!userProfile) {
        throw new InternalServerErrorException();
      }

      userProfileDto.userId = userId;

      if (cvData.description) {
        userProfileDto.description = cvData.description;
      }
      if (cvData.department) {
        userProfileDto.department = cvData.department as Department;
      }
      if (cvData.linkedinUrl) {
        userProfileDto.linkedinUrl = cvData.linkedinUrl;
      }

      if (cvData.skills) {
        const skills = cvData.skills.map((skill) => ({
          name: skill.name,
          order: skill.order,
          userProfileId: userProfile.id,
        }));
        userProfileDto.skills = skills as Skill[];
      }

      if (cvData.experiences) {
        const experiences = cvData.experiences.map((experience) => {
          let startDate = new Date();
          let endDate = new Date();

          try {
            startDate = new Date(experience.startDate);
            if (isNaN(startDate.getTime())) {
              startDate = new Date();
            }
          } catch (e) {}

          try {
            endDate = new Date(experience.endDate);
            if (isNaN(endDate.getTime())) {
              endDate = new Date();
            }
          } catch (e) {}

          return {
            title: experience.title,
            description: experience.description,
            company: experience.company,
            location: experience.location,
            startDate,
            endDate,
          };
        });
        userProfileDto.experiences = experiences as Experience[];
      }

      if (cvData.formations) {
        const formations = cvData.formations.map((formation) => {
          let startDate = new Date();
          let endDate = new Date();

          try {
            startDate = new Date(formation.startDate);
            if (isNaN(startDate.getTime())) {
              startDate = new Date();
            }
          } catch (e) {}

          try {
            endDate = new Date(formation.endDate);
            if (isNaN(endDate.getTime())) {
              endDate = new Date();
            }
          } catch (e) {}
          return {
            title: formation.title,
            description: formation.description,
            location: formation.location,
            startDate,
            endDate,
          };
        });
        userProfileDto.formations = formations as Formation[];
      }

      if (cvData.interests) {
        const interests = cvData.interests.map((interest) => ({
          name: interest.name,
        }));
        userProfileDto.interests = interests as Interest[];
      }

      if (cvData.languages) {
        const userProfileLanguages = await Promise.all(
          cvData.languages.map(async (cvDataLang) => {
            const language = await this.languagesService.findByValue(
              cvDataLang.value
            );
            if (language) {
              return {
                userProfileId: userProfile.id,
                languageId: language.id,
                level: cvDataLang.level,
              };
            }
          })
        );

        userProfileDto.userProfileLanguages =
          userProfileLanguages as UserProfileLanguage[];
      }

      await this.userProfileService.updateByUserId(userId, userProfileDto);
    } catch (error) {
      console.error(`Error populating user profile for user ${userId}`);
      throw new InternalServerErrorException(
        'Failed to populate user profile from CV data'
      );
    }
  }

  async convertPdfToPngBase64(pdfPath: string, page = 1): Promise<string> {
    const outputDir = path.join(__dirname, 'output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }

    const outputPrefix = 'page';
    const outputFile = path.join(outputDir, `${outputPrefix}-${page}.png`);

    const pdftocairoPath = detectPdftocairoPath();

    return new Promise((resolve, reject) => {
      const args = [
        '-png',
        '-f',
        `${page}`,
        '-l',
        `${page}`,
        '-scale-to',
        '1024',
        pdfPath,
        path.join(outputDir, outputPrefix),
      ];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      execFile(pdftocairoPath, args, (error: any) => {
        if (error)
          return reject(new Error(`Erreur conversion PDF: ${error?.message}`));

        fs.readFile(outputFile, (err, buffer) => {
          if (err)
            return reject(new Error(`Erreur lecture PNG : ${err.message}`));
          resolve(buffer.toString('base64'));
        });
      });
    });
  }
}
