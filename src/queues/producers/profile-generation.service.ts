import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Experience } from 'src/common/experiences/models';
import { Formation } from 'src/common/formations/models';
import { Interest } from 'src/common/interests/models';
import { LanguagesService } from 'src/common/languages/languages.service';
import { Department } from 'src/common/locations/locations.types';
import { ExtractedCVData } from 'src/external-cvs/models/extracted-cv-data.model';
import {
  CvSchemaType,
  SCHEMA_VERSION,
} from 'src/external-services/openai/openai.schemas';

import { Jobs, GenerateProfileFromPDFJob } from 'src/queues/queues.types';
import { UserProfileWithPartialAssociations } from 'src/user-profiles/models';
import { UserProfileLanguage } from 'src/user-profiles/models/user-profile-language.model';
import { UserProfilesService } from 'src/user-profiles/user-profiles.service';
import { QueuesService } from './queues.service';

@Injectable()
export class ProfileGenerationService {
  constructor(
    @InjectModel(ExtractedCVData)
    private extractedCVDataModel: typeof ExtractedCVData,
    private queuesService: QueuesService,
    private userProfileService: UserProfilesService,
    private languagesService: LanguagesService
  ) {}

  /**
   * Ajoute une tâche de génération de profil à la file d'attente
   * @param pdfContent Contenu du PDF en base64
   * @param userId ID de l'utilisateur
   * @param options Options supplémentaires
   * @returns ID du job créé
   */
  async generateProfileFromPDF(params: GenerateProfileFromPDFJob) {
    const job = await this.queuesService.addToWorkQueue(
      Jobs.GENERATE_PROFILE_FROM_PDF,
      params
    );

    return {
      jobId: job.id,
      status: 'processing',
    };
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
      const userProfileDto: Partial<UserProfileWithPartialAssociations> & {
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
        userProfileDto.skills = cvData.skills.map((skill) => ({
          name: skill.name,
          userProfileSkill: {
            order: skill.order,
          },
        }));
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
}
