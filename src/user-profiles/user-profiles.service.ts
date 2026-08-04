import {
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import sequelize, { Op, WhereOptions } from 'sequelize';
import { BusinessSector } from 'src/business-sectors/models';
import { ReviewsService } from 'src/common/reviews/reviews.service';
import { Contract } from 'src/contracts/models';
import { DepartmentsService } from 'src/departments/departments.service';
import {
  EMBEDDING_CONFIG,
  EmbeddingType,
} from 'src/embeddings/embedding.config';
import { Experience } from 'src/experiences/models';
import { AchievementTypes } from 'src/gamification/config/achievements.config';
import { UserAchievement } from 'src/gamification/models';
import { userAchievementInclude } from 'src/gamification/models/user-achievement/user-achievement.helper';
import { MailsService } from 'src/mails/mails.service';
import { Nudge } from 'src/nudge/models';
import { Occupation } from 'src/occupations/models';
import { QueuesService } from 'src/queues/producers/queues.service';
import { Jobs } from 'src/queues/queues.types';
import { RecruitementAlert } from 'src/recruitement-alerts/models';
import { Skill } from 'src/skills/models';
import { UserProfileAnalyticsService } from 'src/user-profile-analytics/user-profile-analytics.service';
import { UserProfileContractsService } from 'src/user-profile-contracts/user-profile-contracts.service';
import { UserProfileExperiencesService } from 'src/user-profile-experiences/user-profile-experiences.service';
import { UserProfileFormationsService } from 'src/user-profile-formations/user-profile-formations.service';
import { UserProfileInterestsService } from 'src/user-profile-interests/user-profile-interests.service';
import { UserProfileLanguagesService } from 'src/user-profile-languages/user-profile-languages.service';
import { UserProfileNudgesService } from 'src/user-profile-nudges/user-profile-nudges.service';
import { SCORING_WEIGHTS } from 'src/user-profile-recommendations/scoring.config';
import { UserProfileRecommendationsService } from 'src/user-profile-recommendations/user-profile-recommendations-ai.service';
import { UserProfileSectorOccupationsService } from 'src/user-profile-sector-occupations/user-profile-sector-occupations.service';
import { UserProfileSkillsService } from 'src/user-profile-skills/user-profile-skills.service';
import { User } from 'src/users/models';
import { UsersService } from 'src/users/users.service';
import { Gender, Genders, UserRole, UserRoles } from 'src/users/users.types';
import { UsersStatsService } from 'src/users-stats/users-stats.service';
import { getDepartmentLocative } from 'src/utils/misc/department-locative';
import {
  generatePublicProfileDto,
  PublicProfileDto,
} from './dto/public-profile.dto';
import {
  UnavailabilityReason,
  UserProfile,
  UserProfileSectorOccupation,
  UserProfileWithPartialAssociations,
} from './models';
import {
  UserProfilesAttributes,
  UserProfilesUserAttributes,
} from './models/user-profile.attributes';
import {
  getUserProfileInclude,
  getUserProfileNudgesInclude,
  getUserProfileOrder,
} from './models/user-profile.include';
import { ContactTypeEnum } from './user-profiles.types';
import {
  availabilityWhere,
  profileVisibilityEligibilityWhere,
  userProfileSearchQuery,
} from './user-profiles.utils';

const LINKEDIN_ENTOURAGE_PRO_ORG_ID = '42693016';

@Injectable()
export class UserProfilesService {
  private readonly logger = new Logger(UserProfilesService.name);

  constructor(
    @InjectModel(UserProfile)
    private userProfileModel: typeof UserProfile,
    @Inject(forwardRef(() => UsersService))
    private usersService: UsersService,
    @Inject(forwardRef(() => UsersStatsService))
    private usersStatsService: UsersStatsService,
    private mailsService: MailsService,
    private reviewsService: ReviewsService,
    private departmentsService: DepartmentsService,
    private queuesService: QueuesService,
    private userProfileAnalyticsService: UserProfileAnalyticsService,
    private userProfileLanguagesService: UserProfileLanguagesService,
    private userProfileSkillsService: UserProfileSkillsService,
    private userProfileExperiencesService: UserProfileExperiencesService,
    private userProfileFormationsService: UserProfileFormationsService,
    private userProfileNudgesService: UserProfileNudgesService,
    private userProfileContractsService: UserProfileContractsService,
    private userProfileInterestsService: UserProfileInterestsService,
    private userProfileSectorOccupationsService: UserProfileSectorOccupationsService,
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
        await this.userProfileExperiencesService.findByUserProfileId(
          userProfile.id
        );

      // Formations
      userProfile.formations =
        await this.userProfileFormationsService.findByUserProfileId(
          userProfile.id
        );

      // Custom Nudges
      userProfile.customNudges =
        await this.userProfileNudgesService.findCustomNudgesByUserProfileId(
          userProfile.id
        );

      // Skills
      userProfile.skills =
        await this.userProfileSkillsService.findSkillsByUserProfileId(
          userProfile.id
        );

      // Contracts
      userProfile.contracts =
        await this.userProfileContractsService.findContractByUserProfileId(
          userProfile.id
        );

      // UserProfile Languages
      userProfile.userProfileLanguages =
        await this.userProfileLanguagesService.findLanguagesByUserProfileId(
          userProfile.id
        );

      // Reviews
      userProfile.reviews = await this.reviewsService.findByUserProfileId(
        userProfile.id
      );

      // Interests
      userProfile.interests =
        await this.userProfileInterestsService.findByUserProfileId(
          userProfile.id
        );
    }

    return userProfile;
  }

  async findOneUser(userId: string) {
    return this.usersService.findOneWithRelations(userId);
  }

  async findAll(
    query: {
      businessSectorIds: string[];
      contactTypes: ContactTypeEnum[];
      departments: string[];
      hasSuperCoachBadge?: boolean;
      isAvailable?: boolean;
      limit: number;
      nudgeIds: string[];
      offset: number;
      role: UserRole[];
      search: string;
    },
    isAdminRequester = false
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
      hasSuperCoachBadge,
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
            ...(!isAdminRequester && profileVisibilityEligibilityWhere),
          },
          required: true,
          ...(hasSuperCoachBadge
            ? {
                include: [
                  {
                    model: UserAchievement,
                    as: 'achievements',
                    attributes: [],
                    where: {
                      achievementType: AchievementTypes.SUPER_ENGAGED_COACH,
                      active: true,
                    },
                    required: true,
                  },
                ],
              }
            : {}),
        },
      ],
      where: {
        ...searchOptions,
        ...(contactTypesWhereClause ?? {}),
        ...(departmentsOptions ?? {}),
        ...availabilityWhere(isAvailable),
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
          include: [userAchievementInclude()],
        },
      ],
    });

    return Promise.all(
      profiles.map(async (profile): Promise<PublicProfileDto> => {
        const averageDelayResponse =
          await this.userProfileAnalyticsService.getAverageDelayResponse(
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
      businessSectorIds: string[];
      contactTypes: ContactTypeEnum[];
      departments: string[];
      hasSuperCoachBadge?: boolean;
      isAvailable?: boolean;
      limit: number;
      nudgeIds: string[];
      offset: number;
      role: UserRole[];
      search: string;
    },
    requestingUserId: string,
    isAdminRequester = false
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
      hasSuperCoachBadge,
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
        isAdminRequester,
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
            ...(!isAdminRequester && profileVisibilityEligibilityWhere),
          },
          required: true,
          ...(hasSuperCoachBadge
            ? {
                include: [
                  {
                    model: UserAchievement,
                    as: 'achievements',
                    attributes: [],
                    where: {
                      achievementType: AchievementTypes.SUPER_ENGAGED_COACH,
                      active: true,
                    },
                    required: true,
                  },
                ],
              }
            : {}),
        },
      ],
      where: {
        ...searchOptions,
        ...(contactTypesWhereClause ?? {}),
        ...(departmentsOptions ?? {}),
        ...availabilityWhere(isAvailable),
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
          include: [userAchievementInclude()],
        },
      ],
    });

    return Promise.all(
      profiles.map(async (profile): Promise<PublicProfileDto> => {
        const averageDelayResponse =
          await this.userProfileAnalyticsService.getAverageDelayResponse(
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

  async findPreRegistrationCompatibleProfiles(
    role: UserRole,
    nudgeIds: string[] = [],
    businessSectorIds: string[] = []
  ): Promise<{
    broadened: boolean;
    count: number;
    profiles: PublicProfileDto[];
  }> {
    const targetRole =
      role === UserRoles.CANDIDATE ? UserRoles.COACH : UserRoles.CANDIDATE;

    const baseWhere: WhereOptions<UserProfile> = { unavailableAt: null };
    const userInclude = {
      model: User,
      as: 'user',
      where: { role: targetRole },
      required: true,
      attributes: [] as string[],
    };

    const hasNudges = nudgeIds.length > 0;
    const hasSectors = businessSectorIds.length > 0;

    let selectedIds: string[];
    let count: number;
    let broadened = false;

    if (!hasNudges && !hasSectors) {
      count = await this.userProfileModel.count({
        distinct: true,
        col: 'id',
        where: baseWhere,
        include: [userInclude],
      });

      const randomSample = await this.userProfileModel.findAll({
        subQuery: false,
        limit: 6,
        attributes: ['id'],
        order: sequelize.literal('RANDOM()'),
        where: baseWhere,
        include: [userInclude],
      });
      selectedIds = randomSample.map(({ id }) => id);
    } else if (hasNudges && hasSectors) {
      // AND: a profile must match at least one nudge AND at least one sector
      const andInclude = [
        userInclude,
        ...getUserProfileNudgesInclude({ id: { [Op.in]: nudgeIds } }, false),
        {
          model: UserProfileSectorOccupation,
          as: 'sectorOccupations',
          required: true,
          attributes: [] as string[],
          where: { businessSectorId: { [Op.in]: businessSectorIds } },
        },
      ];

      count = await this.userProfileModel.count({
        distinct: true,
        col: 'id',
        where: baseWhere,
        include: andInclude,
      });

      const andMatches = await this.userProfileModel.findAll({
        subQuery: false,
        limit: 6,
        attributes: ['id'],
        order: sequelize.literal('RANDOM()'),
        where: baseWhere,
        include: andInclude,
        group: ['UserProfile.id'],
      });
      selectedIds = andMatches.map(({ id }) => id);

      if (selectedIds.length === 0) {
        const sectorOnlyInclude = [
          userInclude,
          {
            model: UserProfileSectorOccupation,
            as: 'sectorOccupations',
            required: true,
            attributes: [] as string[],
            where: { businessSectorId: { [Op.in]: businessSectorIds } },
          },
        ];

        count = await this.userProfileModel.count({
          distinct: true,
          col: 'id',
          where: baseWhere,
          include: sectorOnlyInclude,
        });

        const sectorMatches = await this.userProfileModel.findAll({
          subQuery: false,
          limit: 6,
          attributes: ['id'],
          order: sequelize.literal('RANDOM()'),
          where: baseWhere,
          include: sectorOnlyInclude,
          group: ['UserProfile.id'],
        });
        selectedIds = sectorMatches.map(({ id }) => id);
        broadened = true;
      }
    } else if (hasNudges) {
      const nudgeInclude = [
        userInclude,
        ...getUserProfileNudgesInclude({ id: { [Op.in]: nudgeIds } }, false),
      ];

      count = await this.userProfileModel.count({
        distinct: true,
        col: 'id',
        where: baseWhere,
        include: nudgeInclude,
      });

      const nudgeMatches = await this.userProfileModel.findAll({
        subQuery: false,
        limit: 6,
        attributes: ['id'],
        order: sequelize.literal('RANDOM()'),
        where: baseWhere,
        include: nudgeInclude,
        group: ['UserProfile.id'],
      });
      selectedIds = nudgeMatches.map(({ id }) => id);
    } else {
      const sectorInclude = [
        userInclude,
        {
          model: UserProfileSectorOccupation,
          as: 'sectorOccupations',
          required: true,
          attributes: [] as string[],
          where: { businessSectorId: { [Op.in]: businessSectorIds } },
        },
      ];

      count = await this.userProfileModel.count({
        distinct: true,
        col: 'id',
        where: baseWhere,
        include: sectorInclude,
      });

      const sectorMatches = await this.userProfileModel.findAll({
        subQuery: false,
        limit: 6,
        attributes: ['id'],
        order: sequelize.literal('RANDOM()'),
        where: baseWhere,
        include: sectorInclude,
        group: ['UserProfile.id'],
      });
      selectedIds = sectorMatches.map(({ id }) => id);
    }

    if (selectedIds.length === 0) {
      return { count: 0, profiles: [], broadened: false };
    }

    const profileRows = await this.userProfileModel.findAll({
      attributes: UserProfilesAttributes,
      where: { id: { [Op.in]: selectedIds } },
      include: [
        ...getUserProfileInclude(),
        {
          model: User,
          as: 'user',
          attributes: UserProfilesUserAttributes,
          include: [userAchievementInclude()],
        },
      ],
    });

    const publicProfiles = await Promise.all(
      profileRows.map(async (profile): Promise<PublicProfileDto> => {
        const averageDelayResponse =
          await this.userProfileAnalyticsService.getAverageDelayResponse(
            profile.user.id
          );
        const { user, ...restProfile } = profile.toJSON();
        return {
          ...user,
          ...restProfile,
          id: profile.user.id,
          averageDelayResponse,
        };
      })
    );

    return { count, profiles: publicProfiles, broadened };
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
      attributes: ['id', 'description'],
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
      limit: number;
      offset: number;
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
        await this.userProfileSectorOccupationsService.updateSectorOccupationsByUserProfileId(
          userProfileToUpdate,
          updateUserProfileDto.sectorOccupations,
          t
        );
      }

      // Experiences
      if (updateUserProfileDto.experiences) {
        await this.userProfileExperiencesService.updateExperiencesByUserProfileId(
          userProfileToUpdate,
          updateUserProfileDto.experiences,
          t
        );
      }

      // Formations
      if (updateUserProfileDto.formations) {
        await this.userProfileFormationsService.updateFormationsByUserProfileId(
          userProfileToUpdate,
          updateUserProfileDto.formations,
          t
        );
      }

      // Nudges
      if (updateUserProfileDto.nudges) {
        await this.userProfileNudgesService.updateNudgesByUserProfileId(
          userProfileToUpdate,
          updateUserProfileDto.nudges,
          t
        );
      }

      // Custom Nudges
      if (updateUserProfileDto.customNudges) {
        await this.userProfileNudgesService.updateCustomNudgesByUserProfileId(
          userProfileToUpdate,
          updateUserProfileDto.customNudges,
          t
        );
      }

      // Interests
      if (updateUserProfileDto.interests) {
        await this.userProfileInterestsService.updateInterestsByUserProfileId(
          userProfileToUpdate,
          updateUserProfileDto.interests,
          t
        );
      }

      // Skills
      if (updateUserProfileDto.skills) {
        await this.userProfileSkillsService.updateSkillsByUserProfileId(
          userProfileToUpdate,
          updateUserProfileDto.skills,
          t
        );
      }

      // Contracts
      if (updateUserProfileDto.contracts) {
        await this.userProfileContractsService.updateContractsByUserProfileId(
          userProfileToUpdate,
          updateUserProfileDto.contracts,
          t
        );
      }

      // UserProfileLanguages
      if (updateUserProfileDto.userProfileLanguages) {
        await this.userProfileLanguagesService.updateUserProfileLanguagesByUserProfileId(
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

  // ─── Analytics ───────────────────────────────────────────────────────────────

  async getTotalConversationWithMirrorRoleCount(
    userId: string,
    userRole: UserRole
  ): Promise<number> {
    return this.usersStatsService.getTotalConversationWithMirrorRoleCount(
      userId,
      userRole
    );
  }

  async getAvailableMirrorRoleParticipantsCount(
    userId: string,
    userRole: UserRole
  ): Promise<number> {
    return this.usersStatsService.getAvailableMirrorRoleParticipantsCount(
      userId,
      userRole
    );
  }

  async getUsersStats(userId: string, userRole: UserRole) {
    const [
      averageDelayResponse,
      responseRate,
      totalConversationWithMirrorRoleCount,
      availableMirrorRoleParticipantsCount,
    ] = await Promise.all([
      this.userProfileAnalyticsService.getAverageDelayResponse(userId),
      this.userProfileAnalyticsService.getResponseRate(userId),
      this.getTotalConversationWithMirrorRoleCount(userId, userRole),
      this.getAvailableMirrorRoleParticipantsCount(userId, userRole),
    ]);

    return {
      averageDelayResponse,
      responseRate,
      totalConversationWithMirrorRoleCount,
      availableMirrorRoleParticipantsCount,
    };
  }

  async setUserAsUnavailableDueToInactivity(user: User): Promise<void> {
    await this.mailsService.sendAutoSetUnavailableMail(user);
    await this.updateByUserId(user.id, {
      unavailableAt: new Date(),
      unavailabilityReason: UnavailabilityReason.INACTIVITY,
    });
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private async enqueueUserProfileEmbeddingsUpdate(
    userId: string,
    updatedKeys: string[]
  ): Promise<void> {
    if (updatedKeys.length === 0) {
      return;
    }

    const embeddingTypesToUpdate = Object.entries(EMBEDDING_CONFIG)
      .filter(([, config]) =>
        config.fields.some((key) => updatedKeys.includes(key))
      )
      .map(([type]) => type as EmbeddingType);

    if (embeddingTypesToUpdate.length === 0) {
      this.logger.log(
        `[Embeddings] Profile update for user ${userId} touched no embedding fields (updated keys: ${updatedKeys.join(
          ', '
        )}) — skipping`
      );
      return;
    }

    this.logger.log(
      `[Embeddings] Queuing embedding update for user ${userId} — types: ${embeddingTypesToUpdate.join(
        ', '
      )} (triggered by: ${updatedKeys.join(', ')})`
    );

    await this.userProfileModel.update(
      { embeddingPendingAt: new Date() },
      { where: { userId } }
    );

    await this.queuesService.addToEmbeddingQueue(
      Jobs.UPDATE_USER_PROFILE_EMBEDDINGS,
      {
        userId,
        embeddingTypes: embeddingTypesToUpdate,
      }
    );

    this.logger.log(`[Embeddings] Job enqueued for user ${userId}`);
  }

  async getShareText(
    profileUserId: string,
    channel: 'linkedin' | 'default' = 'default'
  ): Promise<string> {
    const userProfile = await this.findOneByUserId(profileUserId, true);

    if (!userProfile) {
      throw new NotFoundException('Candidate profile not found');
    }

    const candidateUser = await this.usersService.findOneWithAttributes(
      profileUserId,
      ['id', 'firstName', 'gender']
    );

    const profileUrl = `${process.env.FRONT_URL}/cv/${profileUserId}`;
    return this.generateShareText(
      userProfile,
      candidateUser?.firstName ?? '',
      profileUrl,
      channel,
      candidateUser?.gender
    );
  }

  generateShareText(
    profile: UserProfile,
    firstName: string,
    profileUrl: string,
    channel: 'linkedin' | 'default' = 'default',
    gender?: Gender
  ): string {
    const stripParens = (s: string) => s.replace(/\s*\([^)]*\)/g, '').trim();

    const isFemale = gender === Genders.FEMALE;

    const prenom = firstName || (isFemale ? 'cette candidate' : 'ce candidat');
    const locative = getDepartmentLocative(profile.department ?? null);

    const sectorNames = (profile.sectorOccupations ?? [])
      .map((s) => stripParens(s.businessSector?.name ?? ''))
      .filter(Boolean);
    const secteurLine =
      sectorNames.length > 0
        ? ` dans le${sectorNames.length > 1 ? 's' : ''} domaine${
            sectorNames.length > 1 ? 's' : ''
          } ${sectorNames.slice(0, 2).join(' et ')}.`
        : '.';

    const occupationNames = (profile.sectorOccupations ?? [])
      .map((s) => stripParens(s.occupation?.name ?? ''))
      .filter(Boolean);

    const searchAmbition = profile.currentJob
      ? stripParens(profile.currentJob)
      : occupationNames.length > 0
        ? occupationNames.slice(0, 2).join(' ou ')
        : null;

    const skills = (profile.skills ?? [])
      .map((s) => stripParens(s.name))
      .filter(Boolean);

    const ceQuApporte = isFemale ? "Ce qu'elle apporte" : "Ce qu'il apporte";
    const skillsParagraph =
      skills.length > 0
        ? `\n\n${ceQuApporte} : ${skills
            .slice(0, 3)
            .join(', ')}, et bien plus encore.`
        : '';

    const ilElle = isFemale ? 'Elle' : 'Il';

    const entourageProRef =
      channel === 'linkedin'
        ? `@[Entourage Pro](urn:li:organization:${LINKEDIN_ENTOURAGE_PRO_ORG_ID})`
        : 'Entourage Pro';
    const entourageRef =
      channel === 'linkedin'
        ? '@[Entourage](urn:li:organization:9177905)'
        : 'Entourage';

    return (
      `Je soutiens ${prenom} dans sa recherche professionnelle via ${entourageProRef}, le réseau professionnel solidaire de l'association ${entourageRef}.\n\n` +
      `${prenom} est bas${
        isFemale ? 'ée' : 'é'
      } ${locative} à la recherche d'un emploi${secteurLine}\n` +
      `Son objectif : ${
        searchAmbition
          ? `décrocher un poste de ${searchAmbition}`
          : 'décrocher un emploi'
      }.${skillsParagraph}\n\n` +
      `${ilElle} a tout pour réussir. Ce qui lui manque, c'est du réseau. Si vous connaissez quelqu'un qui recrute, qui travaille dans ce secteur, ou si vous avez simplement 10 minutes pour un échange, votre coup de pouce peut changer la donne.\n\n` +
      `Contactez-moi en MP, je ferai le lien avec ${prenom}.\nVous pouvez aussi liker ou republier ce post pour lui donner plus de visibilité, ça compte énormément.\n\n` +
      `Son profil complet est ici : ${profileUrl}`
    );
  }
}
