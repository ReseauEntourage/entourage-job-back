import { APIConnectionTimeoutError } from '@anthropic-ai/sdk';
import {
  forwardRef,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { QueuesService } from '../queues/producers/queues.service';
import { Experience } from 'src/experiences/models';
import { ExtractedCVData } from 'src/external-cvs/models/extracted-cv-data.model';
import { AnthropicService } from 'src/external-services/anthropic/anthropic.service';
import {
  CvSchemaType,
  SCHEMA_VERSION,
} from 'src/external-services/openai/openai.schemas';
import { Formation } from 'src/formations/models';
import { Interest } from 'src/interests/models';
import { LanguagesService } from 'src/languages/languages.service';

import { Jobs, GenerateProfileFromPDFJob } from 'src/queues/queues.types';
import { tracer } from 'src/tracer';
import { UserProfileWithPartialAssociations } from 'src/user-profiles/models';
import { UserProfilesService } from 'src/user-profiles/user-profiles.service';
import { UsersService } from 'src/users/users.service';
import { PRESENTATION_GENERATION_CONFIG } from './presentation-generation.config';
import {
  buildPresentationPromptInput,
  buildPresentationSystemPromptFor,
  buildPresentationUserMessage,
  hasParcours,
  postProcessPresentation,
} from './presentation-generation.utils';
import { normalizeCvDateRange } from './profile-generation.utils';

@Injectable()
export class ProfileGenerationService {
  private readonly logger = new Logger(ProfileGenerationService.name);

  constructor(
    @InjectModel(ExtractedCVData)
    private extractedCVDataModel: typeof ExtractedCVData,
    @Inject(forwardRef(() => QueuesService))
    private queuesService: QueuesService,
    @Inject(forwardRef(() => UserProfilesService))
    private userProfileService: UserProfilesService,
    @Inject(forwardRef(() => UsersService))
    private usersService: UsersService,
    private languagesService: LanguagesService,
    private anthropicService: AnthropicService
  ) {}

  /**
   * Generates a presentation proposal for the user from their saved profile.
   * Never writes to the profile: the caller decides whether to use the text.
   * Any failure (timeout, model error, empty output) resolves to `null`.
   */
  async generatePresentation(
    userId: string
  ): Promise<{ description: string | null }> {
    const [user, userProfile] = await Promise.all([
      this.usersService.findOneWithCompanyOnly(userId),
      this.userProfileService.findOneByUserId(userId, true),
    ]);
    if (!user || !userProfile) {
      return { description: null };
    }

    const input = buildPresentationPromptInput(user, userProfile);
    const tags = {
      feature: PRESENTATION_GENERATION_CONFIG.feature,
      role: input.role,
      hasParcours: String(hasParcours(input)),
      gender: String(input.gender),
    };

    return tracer.llmobs.trace(
      { kind: 'workflow', name: 'presentation-generation' },
      async () => {
        let outcome = 'error';
        try {
          const raw = await this.anthropicService.generateText(
            buildPresentationSystemPromptFor(input),
            buildPresentationUserMessage(input),
            {
              maxTokens: PRESENTATION_GENERATION_CONFIG.maxTokens,
              timeoutMs: PRESENTATION_GENERATION_CONFIG.timeoutMs,
              operation: PRESENTATION_GENERATION_CONFIG.operation,
              feature: PRESENTATION_GENERATION_CONFIG.feature,
            }
          );
          const result = postProcessPresentation(raw);
          outcome = result.outcome;
          if (!result.description) {
            this.logger.warn(
              `[PresentationGeneration] Empty generation (userId=${userId})`
            );
          }
          return { description: result.description };
        } catch (error) {
          outcome =
            error instanceof APIConnectionTimeoutError ? 'timeout' : 'error';
          this.logger.error(
            `[PresentationGeneration] ${outcome} (userId=${userId}): ${
              error instanceof Error ? error.message : String(error)
            }`,
            error instanceof Error ? error.stack : undefined
          );
          return { description: null };
        } finally {
          tracer.llmobs.annotate({ tags: { ...tags, outcome } });
        }
      }
    );
  }

  /**
   * Ajoute une tâche de génération de profil à la file d'attente
   * @param pdfContent Contenu du PDF en base64
   * @param userId ID de l'utilisateur
   * @param options Options supplémentaires
   * @returns ID du job créé
   */
  async generateProfileFromPDF(params: GenerateProfileFromPDFJob) {
    const job = await this.queuesService.addToProfileGenerationQueue(
      Jobs.GENERATE_PROFILE_FROM_PDF,
      params
    );

    return {
      jobId: job.id,
      status: 'processing',
    };
  }

  /**
   * Annule un job de génération de profil en cours pour l'utilisateur donné.
   * Job en attente : suppression directe. Job actif : signal d'annulation
   * porté par les métadonnées du job (data.cancelled), relu par le worker.
   */
  async cancelProfileGeneration(jobId: string, userId: string): Promise<void> {
    const job = await this.queuesService.getProfileGenerationJob(jobId);

    if (!job || job.data?.userId !== userId) {
      return;
    }

    const { userProfileId } = job.data;

    if ((await job.isWaiting()) || (await job.isDelayed())) {
      await job.remove();
      this.logger.warn(
        `[ProfileGeneration] Génération de profil annulée par l'utilisateur (jobId=${jobId}, userId=${userId}, userProfileId=${userProfileId}, état=waiting)`
      );
      return;
    }

    await job.updateData({ ...job.data, cancelled: true });
    this.logger.warn(
      `[ProfileGeneration] Génération de profil annulée par l'utilisateur (jobId=${jobId}, userId=${userId}, userProfileId=${userProfileId}, état=active)`
    );
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
    } catch {
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
      const userProfileDto: Partial<UserProfileWithPartialAssociations> = {};

      const userProfile = await this.userProfileService.findOneByUserId(userId);
      if (!userProfile) {
        throw new InternalServerErrorException();
      }

      userProfileDto.userId = userId;

      if (cvData.description) {
        // The schema maxLength is not enforced by the model: cut the text so
        // it fits the presentation field.
        const { description } = postProcessPresentation(cvData.description);
        if (description) {
          userProfileDto.description = description;
        }
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
          const { startDate, endDate } = normalizeCvDateRange(experience);

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
          const { startDate, endDate } = normalizeCvDateRange(formation);

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
        const userProfileLanguages = (
          await Promise.all(
            cvData.languages.map(async (cvDataLang) => {
              const language = await this.languagesService.findByValue(
                cvDataLang.value
              );
              if (!language) {
                return null;
              }
              return {
                userProfileId: userProfile.id,
                languageId: language.id,
                level: cvDataLang.level,
              };
            })
          )
        ).filter(
          (
            userProfileLanguage
          ): userProfileLanguage is NonNullable<typeof userProfileLanguage> =>
            userProfileLanguage !== null
        );

        userProfileDto.userProfileLanguages = userProfileLanguages;
      }

      await this.userProfileService.updateByUserId(userId, userProfileDto);
    } catch (error) {
      this.logger.error(
        `Failed to populate user profile from CV data (userId=${userId}): ${
          error instanceof Error ? error.stack : String(error)
        }`
      );
      throw new InternalServerErrorException(
        'Failed to populate user profile from CV data',
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }
}
