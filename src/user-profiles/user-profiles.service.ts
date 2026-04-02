import fs from 'fs';
import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import sequelize, { Op, WhereOptions, QueryTypes } from 'sequelize';
import sharp from 'sharp';
import { BusinessSector } from 'src/common/business-sectors/models';
import { ContractsService } from 'src/common/contracts/contracts.service';
import { Contract } from 'src/common/contracts/models';
import { DepartmentsService } from 'src/common/departments/departments.service';
import { ExperiencesService } from 'src/common/experiences/experiences.service';
import { Experience } from 'src/common/experiences/models';
import { FormationsService } from 'src/common/formations/formations.service';
import { Formation } from 'src/common/formations/models';
import { InterestsService } from 'src/common/interests/interests.service';
import { Interest } from 'src/common/interests/models';
import { LanguagesService } from 'src/common/languages/languages.service';
import { Nudge } from 'src/common/nudge/models';
import { NudgesService } from 'src/common/nudge/nudges.service';
import { Occupation } from 'src/common/occupations/models';
import { RecruitementAlert } from 'src/common/recruitement-alerts/models';
import { ReviewsService } from 'src/common/reviews/reviews.service';
import { Skill } from 'src/common/skills/models';
import { SkillsService } from 'src/common/skills/skills.service';
import {
  EMBEDDING_CONFIG,
  EmbeddingType,
} from 'src/embeddings/embedding.config';
import { S3File, S3Service } from 'src/external-services/aws/s3.service';
import { SlackService } from 'src/external-services/slack/slack.service';
import { VoyageAiService } from 'src/external-services/voyageai/voyageai.service';
import { UserAchievement } from 'src/gamification/models';
import { userAchievementAttributes } from 'src/gamification/models/user-achievement/user-achievement.helper';
import { MailsService } from 'src/mails/mails.service';
import { QueuesService } from 'src/queues/producers/queues.service';
import { Jobs } from 'src/queues/queues.types';
import { User } from 'src/users/models';
import { UsersService } from 'src/users/users.service';
import { OnboardingStatus, UserRole, UserRoles } from 'src/users/users.types';
import { UsersStatsService } from 'src/users-stats/users-stats.service';
import {
  generatePublicProfileDto,
  PublicProfileDto,
} from './dto/public-profile.dto';
import { ReportAbuseUserProfileDto } from './dto/report-abuse-user-profile.dto';
import {
  UnavailabilityReason,
  UserProfile,
  UserProfileSectorOccupation,
  UserProfileSectorOccupationWithPartialAssociations,
  UserProfileWithPartialAssociations,
} from './models';
import { UserProfileContract } from './models/user-profile-contract.model';
import { UserProfileEmbedding } from './models/user-profile-embedding.model';
import { UserProfileLanguage } from './models/user-profile-language.model';
import { UserProfileNudge } from './models/user-profile-nudge.model';
import { UserProfileSkill } from './models/user-profile-skill.model';
import {
  UserProfilesAttributes,
  UserProfilesUserAttributes,
} from './models/user-profile.attributes';
import {
  getUserProfileInclude,
  getUserProfileOrder,
} from './models/user-profile.include';
import { SCORING_WEIGHTS } from './recommendations/scoring.config';
import { UserProfileRecommendationsService } from './recommendations/user-profile-recommendations-ai.service';
import { ContactTypeEnum } from './user-profiles.types';
import { userProfileSearchQuery } from './user-profiles.utils';

@Injectable()
export class UserProfilesService {
  constructor(
    @InjectModel(UserProfile)
    private userProfileModel: typeof UserProfile,
    @InjectModel(Occupation)
    private occupationModel: typeof Occupation,
    @InjectModel(UserProfileSectorOccupation)
    private userProfileSectorOccupationModel: typeof UserProfileSectorOccupation,
    @InjectModel(UserProfileNudge)
    private userProfileNudgeModel: typeof UserProfileNudge,
    @InjectModel(Interest)
    private interestModel: typeof Interest,
    @InjectModel(Skill)
    private skillModel: typeof Skill,
    @InjectModel(UserProfileContract)
    private userProfileContractModel: typeof UserProfileContract,
    @InjectModel(UserProfileLanguage)
    private userProfileLanguageModel: typeof UserProfileLanguage,
    @InjectModel(UserProfileSkill)
    private userProfileSkillModel: typeof UserProfileSkill,
    @InjectModel(UserProfileEmbedding)
    private userProfileEmbeddingModel: typeof UserProfileEmbedding,
    private s3Service: S3Service,
    @Inject(forwardRef(() => UsersService))
    private usersService: UsersService,
    private usersStatsService: UsersStatsService,
    private slackService: SlackService,
    private mailsService: MailsService,
    private experiencesService: ExperiencesService,
    private formationsService: FormationsService,
    private nudgeService: NudgesService,
    private skillService: SkillsService,
    private contractsService: ContractsService,
    private languagesService: LanguagesService,
    private reviewsService: ReviewsService,
    private interestsService: InterestsService,
    private departmentsService: DepartmentsService,
    private queuesService: QueuesService,
    private voyageAiService: VoyageAiService,
    @Inject(forwardRef(() => UserProfileRecommendationsService))
    private userProfileRecommendationsService: UserProfileRecommendationsService
  ) {}

  // ─── Queries ─────────────────────────────────────────────────────────────────

  async findOne(id: string) {
    return this.userProfileModel.findByPk(id, {
      include: [
        ...getUserProfileInclude(),
        {
          model: User,
          as: 'user',
          attributes: UserProfilesUserAttributes,
        },
      ],
    });
  }

  async findOneByUserId(
    userId: string,
    complete = false
  ): Promise<UserProfile | null> {
    const userProfile = await this.userProfileModel.findOne({
      where: { userId },
      include: getUserProfileInclude(),
      order: getUserProfileOrder(),
    });

    if (!userProfile) {
      return null;
    }

    if (complete) {
      // Experiences
      userProfile.experiences =
        await this.experiencesService.findByUserProfileId(userProfile.id);

      // Formations
      userProfile.formations = await this.formationsService.findByUserProfileId(
        userProfile.id
      );

      // Custom Nudges
      userProfile.customNudges =
        await this.nudgeService.findCustomNudgesByUserProfileId(userProfile.id);

      // Skills
      userProfile.skills = await this.skillService.findSkillsByUserProfileId(
        userProfile.id
      );

      // Contracts
      userProfile.contracts =
        await this.contractsService.findContractByUserProfileId(userProfile.id);

      // UserProfile Languages
      userProfile.userProfileLanguages =
        await this.languagesService.findLanguagesByUserProfileId(
          userProfile.id
        );

      // Reviews
      userProfile.reviews = await this.reviewsService.findByUserProfileId(
        userProfile.id
      );

      // Interests
      userProfile.interests = await this.interestsService.findByUserProfileId(
        userProfile.id
      );
    }

    return userProfile;
  }

  async findOneUser(userId: string) {
    return this.usersService.findOneWithRelations(userId);
  }

  async findAll(query: {
    role: UserRole[];
    offset: number;
    limit: number;
    search: string;
    nudgeIds: string[];
    departments: string[];
    businessSectorIds: string[];
    contactTypes: ContactTypeEnum[];
    isAvailable?: boolean;
  }): Promise<PublicProfileDto[]> {
    const {
      role,
      offset,
      limit,
      search,
      nudgeIds,
      departments,
      businessSectorIds,
      contactTypes,
      isAvailable,
    } = query;

    // The request permits to provide department IDs, but in the UserProfile we store department NAMES
    // We need to map the IDs to names before querying
    const departmentsNames =
      departments && departments.length > 0
        ? await this.departmentsService.mapDepartmentsIdsToFormattedNames(
            departments
          )
        : [];

    const departmentsOptions: WhereOptions<UserProfile> =
      departmentsNames?.length > 0
        ? {
            department: { [Op.or]: departmentsNames },
          }
        : {};

    const businessSectorsOptions: WhereOptions<BusinessSector> =
      businessSectorIds?.length > 0
        ? {
            id: { [Op.in]: businessSectorIds },
          }
        : {};

    const nudgesOptions: WhereOptions<Nudge> =
      nudgeIds?.length > 0
        ? {
            id: {
              [Op.or]: nudgeIds,
            },
          }
        : {};

    const contactTypesWhereClause: WhereOptions<UserProfile> | undefined =
      contactTypes?.includes(ContactTypeEnum.PHYSICAL) ||
      contactTypes?.includes(ContactTypeEnum.REMOTE)
        ? {
            ...(contactTypes.includes(ContactTypeEnum.PHYSICAL) && {
              allowPhysicalEvents: true,
            }),
            ...(contactTypes.includes(ContactTypeEnum.REMOTE) && {
              allowRemoteEvents: true,
            }),
          }
        : undefined;

    const searchOptions = search
      ? { [Op.or]: [...userProfileSearchQuery(search)] }
      : {};

    // First, we filter the profiles to get only the IDs of the profiles matching the criteria
    const filteredProfiles = await this.userProfileModel.findAll({
      subQuery: false,
      offset,
      limit,
      attributes: ['id'],
      order: sequelize.literal('"user.lastConnection" DESC'),
      include: [
        ...getUserProfileInclude(businessSectorsOptions, nudgesOptions, false),
        {
          model: User,
          as: 'user',
          attributes: ['lastConnection'],
          where: {
            role,
            lastConnection: { [Op.ne]: null },
            onboardingStatus: OnboardingStatus.COMPLETED,
          },
          required: true,
        },
      ],
      where: {
        ...searchOptions,
        ...(contactTypesWhereClause ?? {}),
        ...(departmentsOptions ?? {}),
        ...(isAvailable !== undefined ? { isAvailable } : {}),
      },
      group: ['UserProfile.id', 'user.id', 'user.lastConnection'],
    });

    // Then we fetch the complete profiles with associations, based on the filtered IDs
    const profiles = await this.userProfileModel.findAll({
      attributes: UserProfilesAttributes,
      order: sequelize.literal('"user.lastConnection" DESC'),
      where: {
        id: { [Op.in]: filteredProfiles.map(({ id }) => id) },
      },
      include: [
        ...getUserProfileInclude(),
        {
          model: User,
          as: 'user',
          attributes: UserProfilesUserAttributes,
          include: [
            {
              model: UserAchievement,
              as: 'achievements',
              attributes: userAchievementAttributes,
              where: { active: true },
              required: false,
            },
          ],
        },
      ],
    });

    return Promise.all(
      profiles.map(async (profile): Promise<PublicProfileDto> => {
        const averageDelayResponse = await this.getAverageDelayResponse(
          profile.user.id
        );

        const { user, ...restProfile }: UserProfile = profile.toJSON();
        return {
          ...user,
          ...restProfile,
          id: profile.user.id,
          averageDelayResponse,
        };
      })
    );
  }

  /**
   * Fetches profiles matching the given filters, ordered by semantic similarity
   * to the requesting user (via vector embeddings + multi-criteria scoring).
   *
   * Orchestration:
   * 1. Call findBySimilarity to get candidates ordered by finalScore DESC.
   *    Returns [] when the requesting user has no embeddings — method returns [] directly.
   * 2. Run the standard stage-1 filter query (no offset/limit) to get all eligible userIds.
   * 3. Intersect similarity results with eligible userIds, preserving finalScore order.
   * 4. Apply offset/limit pagination on the intersection.
   * 5. Fetch full profiles for the page, ordered by their position in the similarity results.
   */
  async findAllByRelevance(
    query: {
      role: UserRole[];
      offset: number;
      limit: number;
      search: string;
      nudgeIds: string[];
      departments: string[];
      businessSectorIds: string[];
      contactTypes: ContactTypeEnum[];
      isAvailable?: boolean;
    },
    requestingUserId: string
  ): Promise<PublicProfileDto[]> {
    const {
      role,
      offset,
      limit,
      search,
      nudgeIds,
      departments,
      businessSectorIds,
      contactTypes,
      isAvailable,
    } = query;

    // NestJS may return a single string instead of an array when only one value
    // is passed as a query param — normalize to array before calling .map()
    const normalizedRole: UserRole[] = Array.isArray(role) ? role : [role];

    // Step 1 — Similarity search
    const scoringResults =
      await this.userProfileRecommendationsService.findBySimilarity({
        userId: requestingUserId,
        rolesToFind: normalizedRole,
        configVersionProfile: EMBEDDING_CONFIG.profile.version,
        configVersionNeeds: EMBEDDING_CONFIG.needs.version,
        weightProfile: SCORING_WEIGHTS.profile,
        weightNeeds: SCORING_WEIGHTS.needs,
        weightActivity: SCORING_WEIGHTS.activity,
        weightLocationCompatibility: SCORING_WEIGHTS.locationCompatibility,
        poolSize: 500,
        annPoolSize: 500,
        excludeUserIds: [requestingUserId],
        filterByAvailability: isAvailable,
      });

    if (scoringResults.length === 0) return [];

    // Step 2 — Filter-eligible user IDs, scoped to similarity candidates only
    const candidateUserIds = scoringResults.map((r) => r.userId);

    const departmentsNames =
      departments && departments.length > 0
        ? await this.departmentsService.mapDepartmentsIdsToFormattedNames(
            departments
          )
        : [];

    const departmentsOptions: WhereOptions<UserProfile> =
      departmentsNames?.length > 0
        ? { department: { [Op.or]: departmentsNames } }
        : {};

    const businessSectorsOptions: WhereOptions<BusinessSector> =
      businessSectorIds?.length > 0
        ? { id: { [Op.in]: businessSectorIds } }
        : {};

    const nudgesOptions: WhereOptions<Nudge> =
      nudgeIds?.length > 0 ? { id: { [Op.or]: nudgeIds } } : {};

    const contactTypesWhereClause: WhereOptions<UserProfile> | undefined =
      contactTypes?.includes(ContactTypeEnum.PHYSICAL) ||
      contactTypes?.includes(ContactTypeEnum.REMOTE)
        ? {
            ...(contactTypes.includes(ContactTypeEnum.PHYSICAL) && {
              allowPhysicalEvents: true,
            }),
            ...(contactTypes.includes(ContactTypeEnum.REMOTE) && {
              allowRemoteEvents: true,
            }),
          }
        : undefined;

    const searchOptions = search
      ? { [Op.or]: [...userProfileSearchQuery(search)] }
      : {};

    const filteredProfiles = await this.userProfileModel.findAll({
      subQuery: false,
      attributes: ['id'],
      include: [
        ...getUserProfileInclude(businessSectorsOptions, nudgesOptions, false),
        {
          model: User,
          as: 'user',
          attributes: ['id'],
          where: {
            id: { [Op.in]: candidateUserIds },
            role: normalizedRole,
            lastConnection: { [Op.ne]: null },
            onboardingStatus: OnboardingStatus.COMPLETED,
          },
          required: true,
        },
      ],
      where: {
        ...searchOptions,
        ...(contactTypesWhereClause ?? {}),
        ...(departmentsOptions ?? {}),
        ...(isAvailable !== undefined ? { isAvailable } : {}),
      },
      group: ['UserProfile.id', 'user.id'],
    });

    const eligibleUserIds = new Set(filteredProfiles.map((p) => p.user.id));

    // Step 3 — Intersect (preserves finalScore order) + Step 4 — Paginate
    const intersected = scoringResults.filter((r) =>
      eligibleUserIds.has(r.userId)
    );
    const pageResults = intersected.slice(offset, offset + limit);

    if (pageResults.length === 0) return [];

    const pageUserIds = pageResults.map((r) => r.userId);

    // Build a map to retrieve profileId from userId
    const userIdToProfileId = new Map(
      filteredProfiles.map((p) => [p.user.id, p.id])
    );
    const pageProfileIds = pageUserIds
      .map((userId) => userIdToProfileId.get(userId))
      .filter(Boolean) as string[];

    // Step 5 — Fetch full profiles ordered by similarity rank
    const profiles = await this.userProfileModel.findAll({
      attributes: UserProfilesAttributes,
      order: [
        sequelize.literal(
          `ARRAY_POSITION(ARRAY[${pageUserIds
            .map((id) => `'${id}'`)
            .join(',')}]::uuid[], "user"."id")`
        ),
      ],
      where: {
        id: { [Op.in]: pageProfileIds },
      },
      include: [
        ...getUserProfileInclude(),
        {
          model: User,
          as: 'user',
          attributes: UserProfilesUserAttributes,
          include: [
            {
              model: UserAchievement,
              as: 'achievements',
              attributes: userAchievementAttributes,
              where: { active: true },
              required: false,
            },
          ],
        },
      ],
    });

    return Promise.all(
      profiles.map(async (profile): Promise<PublicProfileDto> => {
        const averageDelayResponse = await this.getAverageDelayResponse(
          profile.user.id
        );
        const { user, ...restProfile }: UserProfile = profile.toJSON();
        return {
          ...user,
          ...restProfile,
          id: profile.user.id,
          averageDelayResponse,
        };
      })
    );
  }

  /**
   * Finds profiles matching the criteria of a recruitment alert
   * @param recruitementAlert Recruitment alert to use for the search
   * @returns List of profiles matching the alert criteria
   */
  async findMatchingProfilesForRecruitementAlert(
    recruitementAlert: RecruitementAlert
  ): Promise<PublicProfileDto[]> {
    // Prepare criteria
    const businessSectorIds =
      recruitementAlert.businessSectors?.map((sector) => sector.id) || [];

    const sanitizedJobName = recruitementAlert.jobName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^a-z0-9\s]/g, ''); // Remove special characters except spaces
    // Not used for now, we may use it later for additional filtering or ordering
    // const skillIds = recruitementAlert.skills?.map((skill) => skill.id) || [];

    // Base conditions that are always applied
    const whereOptions = {
      // Job Name
      [Op.or]: [
        sequelize.where(
          sequelize.fn(
            'LOWER',
            sequelize.fn('unaccent', sequelize.col('UserProfile.introduction'))
          ),
          'LIKE',
          `%${sanitizedJobName}%`
        ),
        sequelize.where(
          sequelize.fn(
            'LOWER',
            sequelize.fn('unaccent', sequelize.col('UserProfile.description'))
          ),
          'LIKE',
          `%${sanitizedJobName}%`
        ),
        sequelize.where(
          sequelize.fn(
            'LOWER',
            sequelize.fn('unaccent', sequelize.col('experiences.title'))
          ),
          'LIKE',
          `%${sanitizedJobName}%`
        ),
        sequelize.where(
          sequelize.fn(
            'LOWER',
            sequelize.fn('unaccent', sequelize.col('experiences.description'))
          ),
          'LIKE',
          `%${sanitizedJobName}%`
        ),
        sequelize.where(
          sequelize.fn(
            'LOWER',
            sequelize.fn(
              'unaccent',
              sequelize.col('sectorOccupations.occupation.name')
            )
          ),
          'LIKE',
          `%${sanitizedJobName}%`
        ),
      ],
      // Department
      ...(recruitementAlert.department
        ? { department: recruitementAlert.department }
        : {}),
    };

    // Get all profiles matching the criteria
    const filteredProfiles = await this.userProfileModel.findAll({
      attributes: ['id', 'introduction', 'description'],
      where: whereOptions,
      include: [
        {
          model: BusinessSector,
          attributes: ['id'],
          as: 'businessSectors',
          through: { attributes: [] },
          required: recruitementAlert.businessSectors?.length > 0,
          where:
            recruitementAlert.businessSectors?.length > 0
              ? { id: { [Op.in]: businessSectorIds } }
              : undefined,
        },
        {
          model: UserProfileSectorOccupation,
          as: 'sectorOccupations',
          required: false,
          include: [
            {
              model: Occupation,
              as: 'occupation',
              required: false,
            },
          ],
        },
        {
          model: Skill,
          as: 'skills',
          attributes: ['id'],
          through: { attributes: [] },
          required: false,
        },
        {
          model: Contract,
          as: 'contracts',
          attributes: ['id'],
          through: { attributes: [] },
          required: false,
        },
        {
          model: Experience,
          as: 'experiences',
          attributes: ['id', 'title', 'description'],
          required: false,
        },
        {
          model: User,
          as: 'user',
          attributes: ['id', 'role'],
          where: {
            role: [UserRoles.CANDIDATE],
            lastConnection: { [Op.ne]: null },
          },
          required: true,
        },
      ],
    });

    // Apply manual filtering that can't be done directly in the query
    const filteredIds = await Promise.all(
      filteredProfiles.map(async (profile) => {
        const fullProfile = await this.userProfileModel.findByPk(profile.id, {
          include: [
            {
              model: BusinessSector,
              as: 'businessSectors',
            },
            {
              model: Skill,
              as: 'skills',
            },
            {
              model: Contract,
              as: 'contracts',
            },
          ],
        });

        // We check if the user has defined at least one contract type in his profile.
        // If yes, then we exclude the profile if it doesnt match the alert
        if (recruitementAlert.contractType) {
          const userHasContractTypeDefined = fullProfile.contracts.length > 0;
          if (userHasContractTypeDefined) {
            const hasMatchingContract = fullProfile.contracts.some(
              (contract) => contract.name === recruitementAlert.contractType
            );
            if (!hasMatchingContract) {
              return null;
            }
          }
        }

        return profile.id;
      })
    );

    const validIds = filteredIds.filter((id) => id !== null);

    // Get details on filtered profiles
    const profiles = await this.userProfileModel.findAll({
      attributes: UserProfilesAttributes,
      order: sequelize.literal('"user.lastConnection" DESC'),
      where: {
        id: { [Op.in]: validIds },
      },
      include: [
        ...getUserProfileInclude(),
        {
          model: User,
          as: 'user',
          attributes: UserProfilesUserAttributes,
        },
      ],
    });

    // Transform into PublicProfile
    return profiles.map((profile): PublicProfileDto => {
      return generatePublicProfileDto(profile.user, profile);
    });
  }

  async findAllReferedCandidates(
    userId: string,
    query: {
      offset: number;
      limit: number;
    }
  ): Promise<PublicProfileDto[]> {
    const { offset, limit } = query;

    const profiles = await this.userProfileModel.findAll({
      attributes: UserProfilesAttributes,
      order: sequelize.literal('"user.lastConnection" DESC'),
      include: [
        ...getUserProfileInclude(),
        {
          model: User,
          as: 'user',
          attributes: UserProfilesUserAttributes,
          where: {
            refererId: userId,
          },
        },
      ],
      limit,
      offset,
    });

    return Promise.all(
      profiles.map(async (profile): Promise<PublicProfileDto> => {
        return generatePublicProfileDto(profile.user, profile);
      })
    );
  }

  // ─── Write ───────────────────────────────────────────────────────────────────

  async updateByUserId(
    userId: string,
    updateUserProfileDto: UserProfileWithPartialAssociations & {
      nudgeIds?: string[];
    }
  ) {
    const userProfileToUpdate = await this.findOneByUserId(userId);

    if (!userProfileToUpdate) {
      return null;
    }
    await this.userProfileModel.sequelize.transaction(async (t) => {
      // UserProfile
      await this.userProfileModel.update(updateUserProfileDto, {
        where: { userId },
        individualHooks: true,
        transaction: t,
      });

      // Sector occupations
      if (updateUserProfileDto.sectorOccupations) {
        await this.updateSectorOccupationsByUserProfileId(
          userProfileToUpdate,
          updateUserProfileDto.sectorOccupations,
          t
        );
      }

      // Experiences
      if (updateUserProfileDto.experiences) {
        await this.updateExperiencesByUserProfileId(
          userProfileToUpdate,
          updateUserProfileDto.experiences,
          t
        );
      }

      // Formations
      if (updateUserProfileDto.formations) {
        await this.updateFormationsByUserProfileId(
          userProfileToUpdate,
          updateUserProfileDto.formations,
          t
        );
      }

      // Nudges
      if (updateUserProfileDto.nudges) {
        await this.updateNudgesByUserProfileId(
          userProfileToUpdate,
          updateUserProfileDto.nudges,
          t
        );
      }

      // Custom Nudges
      if (updateUserProfileDto.customNudges) {
        await this.updateCustomNudgesByUserProfileId(
          userProfileToUpdate,
          updateUserProfileDto.customNudges,
          t
        );
      }

      // Interests
      if (updateUserProfileDto.interests) {
        await this.updateInterestsByUserProfileId(
          userProfileToUpdate,
          updateUserProfileDto.interests,
          t
        );
      }

      // Skills
      if (updateUserProfileDto.skills) {
        await this.updateSkillsByUserProfileId(
          userProfileToUpdate,
          updateUserProfileDto.skills,
          t
        );
      }

      // Contracts
      if (updateUserProfileDto.contracts) {
        await this.updateContractsByUserProfileId(
          userProfileToUpdate,
          updateUserProfileDto.contracts,
          t
        );
      }

      // UserProfileLanguages
      if (updateUserProfileDto.userProfileLanguages) {
        await this.updateUserProfileLanguagesByUserProfileId(
          userProfileToUpdate,
          updateUserProfileDto.userProfileLanguages,
          t
        );
      }
    });

    const updatedKeys = Object.keys(updateUserProfileDto);
    await this.enqueueUserProfileEmbeddingsUpdate(userId, updatedKeys);
    return this.findOneByUserId(userId, true);
  }

  async updateExperiencesByUserProfileId(
    userProfileToUpdate: UserProfile,
    experiences: Partial<Experience>[],
    t: sequelize.Transaction
  ): Promise<void> {
    await this.experiencesService.updateExperiencesForUserProfile(
      userProfileToUpdate,
      experiences,
      t
    );
  }

  async updateCustomNudgesByUserProfileId(
    userProfileToUpdate: UserProfile,
    customNudges: Partial<UserProfileNudge>[],
    t: sequelize.Transaction
  ): Promise<void> {
    // Remove the custom nudges that don't exist anymore
    await this.userProfileNudgeModel.destroy({
      where: {
        userProfileId: userProfileToUpdate.id,
        id: {
          [Op.notIn]: customNudges
            .filter((customNudge) => !!customNudge.id)
            .map((customNudge) => customNudge.id),
        },
      },
      individualHooks: true,
      transaction: t,
    });
    // Update the custom nudges that exist
    await Promise.all(
      customNudges
        .filter((customNudge) => !!customNudge.id)
        .map(async (customNudge) => {
          const existingCustomNudge = await this.userProfileNudgeModel.findOne({
            where: {
              userProfileId: userProfileToUpdate.id,
              id: customNudge.id,
            },
          });

          if (existingCustomNudge) {
            return existingCustomNudge.update(
              {
                content: customNudge.content,
              },
              {
                hooks: true,
                transaction: t,
              }
            );
          }
        })
    );

    // Create the new custom nudges that don't exist yet
    const newCustomNudgesData = await Promise.all(
      customNudges
        .filter((customNudge) => !customNudge.id)
        .map((customNudge) => {
          return {
            userProfileId: userProfileToUpdate.id,
            content: customNudge.content,
          };
        })
    );
    await this.userProfileNudgeModel.bulkCreate(newCustomNudgesData, {
      hooks: true,
      transaction: t,
    });
  }

  async updateNudgesByUserProfileId(
    userProfileToUpdate: UserProfile,
    nudges: Partial<Nudge>[],
    t: sequelize.Transaction
  ): Promise<void> {
    const currentNudges = userProfileToUpdate.get('nudges');

    // Create or update userProfileNudge
    await Promise.all(
      nudges.map(async (nudge) => {
        const existingNudge = currentNudges.find(
          (existingNudge) => existingNudge.id === nudge.id
        );
        if (!existingNudge) {
          return this.userProfileNudgeModel.create(
            {
              userProfileId: userProfileToUpdate.id,
              nudgeId: nudge.id,
            },
            {
              hooks: true,
              transaction: t,
            }
          );
        }
      })
    );

    await this.userProfileNudgeModel.destroy({
      where: {
        userProfileId: userProfileToUpdate.id,
        nudgeId: {
          [Op.ne]: null,
          [Op.notIn]: nudges.map((nudge) => nudge.id),
        },
      },
      individualHooks: true,
      transaction: t,
    });
  }

  async updateFormationsByUserProfileId(
    userProfileToUpdate: UserProfile,
    formations: Partial<Formation>[],
    t: sequelize.Transaction
  ): Promise<void> {
    await this.formationsService.updateFormationsForUserProfile(
      userProfileToUpdate,
      formations,
      t
    );
  }

  async updateSectorOccupationsByUserProfileId(
    userProfileToUpdate: UserProfile,
    sectorOccupations: Partial<UserProfileSectorOccupationWithPartialAssociations>[],
    t: sequelize.Transaction
  ): Promise<void> {
    const newSectorOccupations = await Promise.all(
      sectorOccupations.map(async ({ businessSectorId, occupation, order }) => {
        const existingSectorOccupation =
          await this.userProfileSectorOccupationModel.findOne({
            where: {
              userProfileId: userProfileToUpdate.id,
              businessSectorId,
            },
            include: [
              {
                model: Occupation,
                as: 'occupation',
                attributes: ['name'],
                where:
                  occupation && occupation.name
                    ? { name: occupation.name }
                    : undefined,
              },
            ],
          });

        if (existingSectorOccupation) {
          return existingSectorOccupation;
        }
        let newOccupation = null;
        if (occupation && occupation.name) {
          newOccupation = await this.occupationModel.create(
            {
              name: occupation.name,
            },
            {
              hooks: true,
              transaction: t,
            }
          );
        }
        return await this.userProfileSectorOccupationModel.create(
          {
            userProfileId: userProfileToUpdate.id,
            businessSectorId,
            occupationId: newOccupation ? newOccupation.id : undefined,
            order,
          },
          {
            hooks: true,
            transaction: t,
          }
        );
      })
    );

    await this.userProfileSectorOccupationModel.destroy({
      where: {
        userProfileId: userProfileToUpdate.id,
        id: {
          [Op.notIn]: newSectorOccupations.map(
            (sectorOccupation) => sectorOccupation.id
          ),
        },
      },
      individualHooks: true,
      transaction: t,
    });

    await userProfileToUpdate.$set('sectorOccupations', newSectorOccupations, {
      transaction: t,
    });
  }

  async updateInterestsByUserProfileId(
    userProfileToUpdate: UserProfile,
    interests: Partial<Interest>[],
    t: sequelize.Transaction
  ): Promise<void> {
    const interestsData = interests.map((interest, order) => {
      return {
        userProfileId: userProfileToUpdate.id,
        name: interest.name,
        order,
      };
    });
    const userProfileInterests = await this.interestModel.bulkCreate(
      interestsData,
      {
        hooks: true,
        transaction: t,
      }
    );
    await this.interestModel.destroy({
      where: {
        userProfileId: userProfileToUpdate.id,
        id: {
          [Op.notIn]: userProfileInterests.map((interest) => interest.id),
        },
      },
      individualHooks: true,
      transaction: t,
    });
  }

  async updateSkillsByUserProfileId(
    userProfileToUpdate: UserProfile,
    skills: Partial<Skill>[],
    t: sequelize.Transaction
  ): Promise<void> {
    const skillsData = await Promise.all(
      skills.map(async (skill, order) => {
        const existingSkill = await this.skillModel.findOne({
          where: { name: { [Op.iLike]: skill.name } },
        });

        if (existingSkill) {
          return {
            userProfileId: userProfileToUpdate.id,
            skillId: existingSkill.id,
            order,
          };
        }

        const newSkill = await this.skillModel.create(
          {
            name: skill.name,
          },
          {
            hooks: true,
            transaction: t,
          }
        );

        return {
          userProfileId: userProfileToUpdate.id,
          skillId: newSkill.id,
          order,
        };
      })
    );

    // Remove the user profile skills that don't exist anymore
    await this.userProfileSkillModel.destroy({
      where: {
        userProfileId: userProfileToUpdate.id,
        skillId: {
          [Op.notIn]: skillsData.map((skillData) => skillData.skillId),
        },
      },
      individualHooks: true,
      transaction: t,
    });

    // Create or update userProfileSkill (and update order)
    await Promise.all(
      skillsData.map(async (skillData) => {
        const existingUserProfileSkill =
          await this.userProfileSkillModel.findOne({
            where: {
              userProfileId: userProfileToUpdate.id,
              skillId: skillData.skillId,
            },
          });

        if (existingUserProfileSkill) {
          return existingUserProfileSkill.update(
            { order: skillData.order },
            {
              hooks: true,
              transaction: t,
            }
          );
        }

        return this.userProfileSkillModel.create(skillData, {
          hooks: true,
          transaction: t,
        });
      })
    );
  }

  async updateContractsByUserProfileId(
    userProfileToUpdate: UserProfile,
    contracts: Partial<Contract>[],
    t: sequelize.Transaction
  ): Promise<void> {
    const contractsData = contracts.map((contract) => {
      return {
        userProfileId: userProfileToUpdate.id,
        contractId: contract.id,
      };
    });
    const userProfileContracts = await this.userProfileContractModel.bulkCreate(
      contractsData,
      {
        hooks: true,
        transaction: t,
      }
    );
    await this.userProfileContractModel.destroy({
      where: {
        userProfileId: userProfileToUpdate.id,
        id: {
          [Op.notIn]: userProfileContracts.map((upContract) => upContract.id),
        },
      },
      individualHooks: true,
      transaction: t,
    });
  }

  async updateUserProfileLanguagesByUserProfileId(
    userProfileToUpdate: UserProfile,
    userProfileLanguages: Partial<UserProfileLanguage>[],
    t: sequelize.Transaction
  ): Promise<void> {
    // Languages already exists, we need to create UserProfileLanguage
    const languagesData = userProfileLanguages.map((upLanguage) => {
      return {
        userProfileId: userProfileToUpdate.id,
        languageId: upLanguage.languageId,
        level: upLanguage.level,
      };
    });
    const createdUpLanguages = await this.userProfileLanguageModel.bulkCreate(
      languagesData,
      {
        hooks: true,
        transaction: t,
      }
    );
    await this.userProfileLanguageModel.destroy({
      where: {
        userProfileId: userProfileToUpdate.id,
        id: {
          [Op.notIn]: createdUpLanguages.map((upLanguage) => upLanguage.id),
        },
      },
      individualHooks: true,
      transaction: t,
    });
  }

  async updateHasPicture(userId: string, hasPicture: boolean) {
    await this.updateByUserId(userId, {
      hasPicture,
    });
  }

  async uploadProfileImage(userId: string, file: Express.Multer.File) {
    const { path } = file;

    let uploadedImg: S3File;

    try {
      const fileBuffer = await sharp(path).jpeg({ quality: 75 }).toBuffer();

      uploadedImg = await this.s3Service.upload(
        fileBuffer,
        'image/jpeg',
        `${userId}.profile.jpg`
      );
      await this.updateHasPicture(userId, true);
    } catch (error) {
      uploadedImg = null;
    } finally {
      if (fs.existsSync(path)) {
        fs.unlinkSync(path); // remove image locally after upload to S3
      }
    }
    return uploadedImg;
  }

  async removeByUserId(userId: string) {
    return this.userProfileModel.destroy({
      where: { userId },
      individualHooks: true,
    });
  }

  // ─── Analytics ───────────────────────────────────────────────────────────────

  async calculateProfileCompletion(userId: string): Promise<number> {
    // Using a SQL query rather than models to optimize performance
    const sql = `
      SELECT
        up."hasPicture",
        up.department,
        up.introduction,
        up.description,
        u."firstName",
        u."lastName",
        u.phone,
        (SELECT COUNT(*) > 0 FROM "UserProfileSectorOccupations" upso WHERE upso."userProfileId" = up.id) AS "hasSectorOccupations",
        (SELECT COUNT(*) > 0 FROM "UserProfileSkills" ups WHERE ups."userProfileId" = up.id) AS "hasSkills",
        (SELECT COUNT(*) > 0 FROM "UserProfileNudges" upn WHERE upn."userProfileId" = up.id AND upn."nudgeId" IS NULL) AS "hasCustomNudges",
        (SELECT COUNT(*) > 0 FROM "Experiences" e WHERE e."userProfileId" = up.id) AS "hasExperiences",
        (SELECT COUNT(*) > 0 FROM "Formations" f WHERE f."userProfileId" = up.id) AS "hasFormations",
        (SELECT COUNT(*) > 0 FROM "UserProfileLanguages" upl WHERE upl."userProfileId" = up.id) AS "hasLanguages",
        (SELECT COUNT(*) > 0 FROM "Interests" i WHERE i."userProfileId" = up.id) AS "hasInterests"
      FROM "UserProfiles" up
      JOIN "Users" u ON u.id = up."userId"
      WHERE up."userId" = :userId
    `;

    const result = await this.userProfileModel.sequelize.query(sql, {
      type: QueryTypes.SELECT,
      replacements: { userId },
      plain: true,
    });

    if (!result) {
      return 0;
    }

    // Calculate the completion percentage based on the returned fields
    const fields = Object.entries(result);
    if (fields.length === 0) return 0;

    // Count fields that are filled (not null, not undefined and not false)
    const filledFields = fields.filter(([fieldName, value]) => {
      // Boolean fields (starting with "has")
      if (fieldName.startsWith('has')) {
        return value === true || value === 't';
      }
      // String fields (firstName, lastName, etc.)
      if (typeof value === 'string') {
        return value?.trim().length > 0;
      }
      // Other types (null, undefined, number, etc.)
      return !!value;
    });

    // Round percentage to the nearest integer
    const percentage = Math.round((filledFields.length / fields.length) * 100);

    return percentage;
  }

  async getAverageDelayResponse(userId: string): Promise<number> {
    return this.usersStatsService.getAverageDelayResponse(userId);
  }

  async getResponseRate(userId: string): Promise<number> {
    return this.usersStatsService.getResponseRate(userId);
  }

  async getTotalConversationWithMirrorRoleCount(
    userId: string,
    userRole: UserRole
  ): Promise<number> {
    return this.usersStatsService.getTotalConversationWithMirrorRoleCount(
      userId,
      userRole
    );
  }

  async getUsersStats(userId: string, userRole: UserRole) {
    const [
      averageDelayResponse,
      responseRate,
      totalConversationWithMirrorRoleCount,
    ] = await Promise.all([
      this.getAverageDelayResponse(userId),
      this.getResponseRate(userId),
      this.getTotalConversationWithMirrorRoleCount(userId, userRole),
    ]);

    return {
      averageDelayResponse,
      responseRate,
      totalConversationWithMirrorRoleCount,
    };
  }

  // ─── Embeddings & AI ─────────────────────────────────────────────────────────

  async updateEmbedding(
    userProfileId: string,
    embeddingType: EmbeddingType,
    data: string
  ) {
    // Generate embedding from data
    const embeddingArray = await this.voyageAiService.generateEmbedding(data);

    // Convert number array to pgvector format: [num1,num2,num3,...]
    const embedding = `[${embeddingArray.join(',')}]`;

    await this.saveEmbedding(userProfileId, embeddingType, embedding);
  }

  /**
   * Generates embeddings for multiple texts in a single batch API call
   * Optimizes VoyageAI calls by respecting rate limits
   * @param dataArray Array of texts to convert to embeddings
   * @returns Array of embeddings (each embedding is an array of numbers)
   */
  async generateEmbeddingsBatch(dataArray: string[]): Promise<number[][]> {
    return await this.voyageAiService.generateEmbeddingsBatch(dataArray);
  }

  /**
   * Saves an already computed embedding (without calling VoyageAI)
   * Used during batch processing to avoid redundant API calls
   */
  async saveEmbedding(
    userProfileId: string,
    embeddingType: EmbeddingType,
    embedding: string
  ) {
    const existingEmbedding = await this.userProfileEmbeddingModel.findOne({
      where: {
        userProfileId,
        type: embeddingType,
      },
    });

    if (existingEmbedding) {
      await existingEmbedding.update({
        embedding,
        configVersion: EMBEDDING_CONFIG[embeddingType].version,
      });
    } else {
      await this.userProfileEmbeddingModel.create({
        userProfileId,
        type: embeddingType,
        embedding,
        configVersion: EMBEDDING_CONFIG[embeddingType].version,
      });
    }
  }

  // ─── Moderation ──────────────────────────────────────────────────────────────

  async reportAbuse(
    report: ReportAbuseUserProfileDto,
    userReporter: User,
    userReported: User
  ) {
    await Promise.all([
      this.slackService.sendMessageUserReported(
        userReporter,
        userReported,
        report.reason,
        report.comment
      ),
      this.mailsService.sendUserReportedMail(
        report,
        userReported,
        userReporter
      ),
    ]);
  }

  async setUserAsUnavailableDueToInactivity(user: User): Promise<void> {
    await this.mailsService.sendAutoSetUnavailableMail(user);
    await this.updateByUserId(user.id, {
      isAvailable: false,
      unavailabilityReason: UnavailabilityReason.INACTIVITY,
    });
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private async enqueueUserProfileEmbeddingsUpdate(
    userId: string,
    updatedKeys: string[]
  ): Promise<void> {
    // If no keys are updated, we don't need to update the embedding
    if (updatedKeys.length === 0) {
      return;
    }

    // Determine which embedding types need to be updated based on the updated keys and the fields
    // used in each embedding type(defined in EMBEDDING_CONFIG)
    const embeddingTypesToUpdate = Object.entries(EMBEDDING_CONFIG)
      .filter(([, config]) =>
        config.fields.some((key) => updatedKeys.includes(key))
      )
      .map(([type]) => type as EmbeddingType);

    if (embeddingTypesToUpdate.length === 0) {
      // No embedding needs to be updated based on the updated keys
      return;
    }

    // Add a job to the queue to update the embeddings of the user profile, with the list of embedding types to update
    await this.queuesService.addToEmbeddingQueue(
      Jobs.UPDATE_USER_PROFILE_EMBEDDINGS,
      {
        userId,
        embeddingTypes: embeddingTypesToUpdate,
      }
    );
  }
}
