import fs from 'fs';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { ToBase64Response } from 'pdf2pic/dist/types/convertResponse';
import { Experience } from 'src/common/experiences/models';
import { Formation } from 'src/common/formations/models';
import { Interest } from 'src/common/interests/models';
import { Department } from 'src/common/locations/locations.types';
import { Skill } from 'src/common/skills/models';
import { S3Service } from 'src/external-services/aws/s3.service';
import {
  CvSchemaType,
  SCHEMA_VERSION,
} from 'src/external-services/openai/openai.schemas';
import { OpenAiService } from 'src/external-services/openai/openai.service';
import { UserProfile } from 'src/user-profiles/models';
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
      const currentSchemaVersion = SCHEMA_VERSION;
      // Vérification si des données extraites existent déjà pour cet utilisateur
      const existingData = await this.extractedCVDataModel.findOne({
        where: { userId: userId },
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
      const currentSchemaVersion = SCHEMA_VERSION;
      // Vérification si des données existent déjà pour cet utilisateur
      const existingData = await this.extractedCVDataModel.findOne({
        where: { userId: userId },
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
          userId: userId,
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

      if (cvData.introduction) {
        userProfileDto.introduction = cvData.introduction;
      }
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
        const experiences = cvData.experiences.map((experience) => ({
          title: experience.title,
          description: experience.description,
          company: experience.company,
          location: experience.location,
          startDate: experience.startDate
            ? new Date(experience.startDate)
            : new Date(),
          endDate: experience.endDate
            ? new Date(experience.endDate)
            : new Date(),
        }));
        userProfileDto.experiences = experiences as Experience[];
      }

      if (cvData.formations) {
        const formations = cvData.formations.map((formation) => ({
          title: formation.title,
          description: formation.description,
          location: formation.location,
          startDate: formation.startDate
            ? new Date(formation.startDate)
            : new Date(),
          endDate: formation.endDate ? new Date(formation.endDate) : new Date(),
        }));
        userProfileDto.formations = formations as Formation[];
      }

      if (cvData.interests) {
        const interests = cvData.interests.map((interest) => ({
          name: interest.name,
        }));
        userProfileDto.interests = interests as Interest[];
      }

      // TODO: Uncomment when Language level is implemented
      // if (cvData.languages) {
      //   const languages = cvData.languages.map((language) => ({
      //     name: language.name,
      //     level: language.level,
      //   }));
      //   userProfileDto.languages = languages as Language[];
      // }

      await this.userProfileService.updateByUserId(userId, userProfileDto);
    } catch (error) {
      console.error(`Error populating user profile for user ${userId}`);
      throw new InternalServerErrorException(
        'Failed to populate user profile from CV data'
      );
    }
  }
}
