import fs from 'fs';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import _ from 'lodash';
import sequelize, { Op, WhereOptions, QueryTypes } from 'sequelize';
import sharp from 'sharp';
import { BusinessSector } from 'src/common/business-sectors/models';
import { Contract } from 'src/common/contracts/models';
import { ExperiencesService } from 'src/common/experiences/experiences.service';
import { Experience } from 'src/common/experiences/models';
import { FormationsService } from 'src/common/formations/formations.service';
import { Formation } from 'src/common/formations/models';
import { Interest } from 'src/common/interests/models';
import { Department, Departments } from 'src/common/locations/locations.types';
import { Nudge } from 'src/common/nudge/models';
import { Occupation } from 'src/common/occupations/models';
import { Skill } from 'src/common/skills/models';
import { S3Service } from 'src/external-services/aws/s3.service';
import { SlackService } from 'src/external-services/slack/slack.service';
import { MailsService } from 'src/mails/mails.service';
import { MessagesService } from 'src/messages/messages.service';
import { MessagingService } from 'src/messaging/messaging.service';
import { User } from 'src/users/models';
import { getUserProfileRecommendationOrder } from 'src/users/models/user.include';
import { UserCandidatsService } from 'src/users/user-candidats.service';
import { UsersService } from 'src/users/users.service';
import { UserRole, UserRoles } from 'src/users/users.types';
import { ReportAbuseUserProfileDto } from './dto/report-abuse-user-profile.dto';
import {
  UserProfile,
  UserProfileSectorOccupation,
  UserProfileSectorOccupationWithPartialAssociations,
  UserProfileWithPartialAssociations,
} from './models';
import { UserProfileContract } from './models/user-profile-contract.model';
import { UserProfileLanguage } from './models/user-profile-language.model';
import { UserProfileNudge } from './models/user-profile-nudge.model';
import { UserProfileRecommendation } from './models/user-profile-recommendation.model';
import {
  UserProfilesAttributes,
  UserProfilesUserAttributes,
} from './models/user-profile.attributes';
import {
  getUserProfileInclude,
  getUserProfileOrder,
} from './models/user-profile.include';
import { ContactTypeEnum, PublicProfile } from './user-profiles.types';
import { userProfileSearchQuery } from './user-profiles.utils';

const UserProfileRecommendationsWeights = {
  BUSINESS_SECTORS: 0.3,
  NUDGES: 0.5,
};

@Injectable()
export class UserProfilesService {
  constructor(
    @InjectModel(UserProfile)
    private userProfileModel: typeof UserProfile,
    @InjectModel(Occupation)
    private occupationModel: typeof Occupation,
    @InjectModel(UserProfileSectorOccupation)
    private userProfileSectorOccupationModel: typeof UserProfileSectorOccupation,
    @InjectModel(UserProfileRecommendation)
    private userProfileRecommandationModel: typeof UserProfileRecommendation,
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
    private s3Service: S3Service,
    private usersService: UsersService,
    private userCandidatsService: UserCandidatsService,
    private messagesService: MessagesService,
    private messagingService: MessagingService,
    private slackService: SlackService,
    private mailsService: MailsService,
    private experiencesService: ExperiencesService,
    private formationsService: FormationsService
  ) {}

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
  ): Promise<UserProfile> {
    return this.userProfileModel.findOne({
      where: { userId },
      include: getUserProfileInclude(complete),
      order: getUserProfileOrder(complete),
    });
  }

  async findOneUser(userId: string) {
    return this.usersService.findOne(userId);
  }

  async findUserCandidateByCandidateId(candidateId: string) {
    return this.userCandidatsService.findOneByCandidateId(candidateId);
  }

  async findAll(
    userId: string,
    query: {
      role: UserRole[];
      offset: number;
      limit: number;
      search: string;
      nudgeIds: string[];
      departments: Department[];
      businessSectorIds: string[];
      contactTypes: ContactTypeEnum[];
    }
  ): Promise<PublicProfile[]> {
    const {
      role,
      offset,
      limit,
      search,
      nudgeIds,
      departments,
      businessSectorIds,
      contactTypes,
    } = query;

    const searchOptions = search
      ? { [Op.or]: userProfileSearchQuery(search) }
      : {};

    const departmentsOptions: WhereOptions<UserProfile> =
      departments?.length > 0
        ? {
            department: { [Op.or]: departments },
          }
        : {};

    const businessSectorsOptions: WhereOptions<BusinessSector> =
      businessSectorIds?.length > 0
        ? {
            id: { [Op.in]: businessSectorIds },
          }
        : {};

    const nudgesSectorsOptions: WhereOptions<Nudge> =
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
            [Op.or]: {
              ...(contactTypes.includes(ContactTypeEnum.PHYSICAL) && {
                allowPhysicalEvents: true,
              }),
              ...(contactTypes.includes(ContactTypeEnum.REMOTE) && {
                allowRemoteEvents: true,
              }),
            },
          }
        : undefined;

    // this query is made in 2 steps because it filters the where clause inside the include
    // eg:
    // you want all user having in his businessSectors one specific businessSector
    // but you also want the request to response his businessSectors list
    // you can't do that in one query, you have to do it in 2 steps, the first to filter, the second to get all attributes values
    const filteredProfiles = await this.userProfileModel.findAll({
      offset,
      limit,
      attributes: ['id'],
      order: sequelize.literal('"user.lastConnection" DESC'),
      include: [
        ...getUserProfileInclude(
          false,
          businessSectorsOptions,
          nudgesSectorsOptions
        ),
        {
          model: User,
          as: 'user',
          attributes: ['lastConnection'],
          where: {
            role,
            lastConnection: { [Op.ne]: null },
            ...searchOptions,
          },
        },
      ],
      where: {
        ...(contactTypesWhereClause ? contactTypesWhereClause : {}),
        ...(departmentsOptions ? departmentsOptions : {}),
      },
    });

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
        },
      ],
    });

    return Promise.all(
      profiles.map(async (profile): Promise<PublicProfile> => {
        const lastSentMessage = await this.getLastContact(
          userId,
          profile.user.id
        );
        const lastReceivedMessage = await this.getLastContact(
          profile.user.id,
          userId
        );
        const averageDelayResponse = await this.getAverageDelayResponse(
          profile.user.id
        );

        const { user, ...restProfile }: UserProfile = profile.toJSON();
        return {
          ...user,
          ...restProfile,
          id: profile.user.id,
          lastSentMessage: lastSentMessage?.createdAt || null,
          lastReceivedMessage: lastReceivedMessage?.createdAt || null,
          averageDelayResponse,
        };
      })
    );
  }

  async findAllReferedCandidates(
    userId: string,
    query: {
      offset: number;
      limit: number;
    }
  ): Promise<PublicProfile[]> {
    const { offset, limit } = query;

    const profiles = await this.userProfileModel.findAll({
      attributes: UserProfilesAttributes,
      order: sequelize.literal('"user.createdAt" DESC'),
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
      profiles.map(async (profile): Promise<PublicProfile> => {
        const lastSentMessage = await this.getLastContact(
          userId,
          profile.user.id
        );
        const lastReceivedMessage = await this.getLastContact(
          profile.user.id,
          userId
        );
        const averageDelayResponse = await this.getAverageDelayResponse(
          profile.user.id
        );

        const { user, ...restProfile }: UserProfile = profile.toJSON();
        return {
          ...user,
          ...restProfile,
          id: profile.user.id,
          lastSentMessage: lastSentMessage?.createdAt || null,
          lastReceivedMessage: lastReceivedMessage?.createdAt || null,
          averageDelayResponse,
        };
      })
    );
  }

  async findRecommendationsByUserId(
    userId: string
  ): Promise<UserProfileRecommendation[]> {
    return this.userProfileRecommandationModel.findAll({
      where: { UserId: userId },
      order: getUserProfileRecommendationOrder(),
      include: {
        model: User,
        as: 'recUser',
        attributes: UserProfilesUserAttributes,
        include: [
          {
            model: UserProfile,
            as: 'userProfile',
            attributes: UserProfilesAttributes,
            include: getUserProfileInclude(),
          },
        ],
      },
    });
  }

  async getLastContact(senderUserId: string, addresseeUserId: string) {
    if (!senderUserId || !addresseeUserId) {
      return null;
    }
    return this.messagesService.getLastMessageBetweenUsers(
      senderUserId,
      addresseeUserId
    );
  }

  async getAverageDelayResponse(userId: string): Promise<number | null> {
    return this.messagingService.getAverageDelayResponse(userId);
  }

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
    const skillsData = skills.map((skill, order) => {
      return {
        userProfileId: userProfileToUpdate.id,
        name: skill.name,
        order,
      };
    });
    const skillsCreated = await this.skillModel.bulkCreate(skillsData, {
      hooks: true,
      transaction: t,
    });
    await this.skillModel.destroy({
      where: {
        userProfileId: userProfileToUpdate.id,
        id: {
          [Op.notIn]: skillsCreated.map((skill) => skill.id),
        },
        order: {
          [Op.ne]: -1,
        },
      },
      individualHooks: true,
      transaction: t,
    });
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

  async createRecommendations(userId: string, usersToRecommendIds: string[]) {
    return this.userProfileRecommandationModel.bulkCreate(
      usersToRecommendIds.map(
        (userToRecommendId) => {
          return {
            UserId: userId,
            recommendedUserId: userToRecommendId,
          };
        },
        {
          hooks: true,
          individualHooks: true,
        }
      )
    );
  }

  // V3
  async updateRecommendationsByUserId(userId: string) {
    const [user, userProfile] = await Promise.all([
      this.findOneUser(userId),
      this.findOneByUserId(userId),
    ]);

    const rolesToFind =
      user.role === UserRoles.CANDIDATE
        ? [UserRoles.COACH]
        : [UserRoles.CANDIDATE];

    const sameRegionDepartmentsOptions = userProfile.department
      ? Departments.filter(
          ({ region }) =>
            region ===
            Departments.find(({ name }) => userProfile.department === name)
              .region
        ).map(({ name }) => name)
      : Departments.map(({ name }) => name);

    const nudgeIds = userProfile.nudges.map((nudge) => nudge.id);
    const sectorOccupations = userProfile.sectorOccupations;
    const businessSectorIds = sectorOccupations.map(
      (sectorOccupation) => sectorOccupation.businessSector?.id
    );

    interface UserRecommendationSQL {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      department: Department;
      currentJob: string;
      role: UserRole;
      lastConnection: Date;
      createdAt: Date;
      occupations: string;
      businessSectorIds: string;
      nudgeIds: string;
    }

    const sql = `
    SELECT
      u.id,
      u."firstName",
      u."lastName",
      u.email,
      up.department,
      u.role,
      u."lastConnection",
      u."createdAt" as "createdAt",
      string_agg(DISTINCT upso."businessSectorId"::text, ', ') as "businessSectorIds",
      string_agg(DISTINCT upn."nudgeId"::text, ', ') as "nudgeIds"
    
    FROM "Users" u
    LEFT JOIN "UserProfiles" up
      ON u.id = up."userId"
    
    LEFT JOIN "UserProfileSectorOccupations" upso
      ON up.id = upso."userProfileId"

    LEFT JOIN "UserProfileNudges" upn
      ON up.id = upn."userProfileId"
    
    WHERE u."deletedAt" IS NULL
    AND up."isAvailable" IS TRUE
    AND up.department IN (${sameRegionDepartmentsOptions.map(
      // remplacer un appostrophe par deux appostrophes
      (department) => `'${department.replace(/'/g, "''")}'`
    )})
    AND u.role IN (${rolesToFind.map((role) => `'${role}'`)})
    AND u."lastConnection" IS NOT NULL
        
    GROUP BY u.id, u."firstName", u."lastName", u.email, u."zone", u.role, u."lastConnection", up.department
    ;`;

    const profiles: UserRecommendationSQL[] =
      await this.userProfileModel.sequelize.query(sql, {
        type: QueryTypes.SELECT,
      });

    const sortedProfiles = _.orderBy(
      profiles,
      [
        (profile) => {
          const profileBusinessSectors = profile.businessSectorIds
            ? profile.businessSectorIds.split(', ')
            : [];

          const businessSectorsDifference = _.difference(
            businessSectorIds,
            profileBusinessSectors
          );

          const businessSectorsMatching =
            (businessSectorIds.length - businessSectorsDifference.length) *
            UserProfileRecommendationsWeights.BUSINESS_SECTORS;

          const profileNudgeIds = profile.nudgeIds
            ? profile.nudgeIds.split(', ')
            : [];

          const nudgesDifferences = _.difference(nudgeIds, profileNudgeIds);

          const nudgesMatching =
            (nudgeIds.length - nudgesDifferences.length) *
            UserProfileRecommendationsWeights.NUDGES;

          return businessSectorsMatching + nudgesMatching;
        },
        ({ department }) => department === userProfile.department,
        ({ createdAt }) => createdAt,
      ],
      ['desc', 'asc', 'desc']
    );

    return this.createRecommendations(
      userId,
      sortedProfiles.slice(0, 3).map((profile) => profile.id)
    );
  }

  async updateHasPicture(userId: string, hasPicture: boolean) {
    await this.updateByUserId(userId, {
      hasPicture,
    });
  }

  async uploadProfileImage(userId: string, file: Express.Multer.File) {
    const { path } = file;

    let uploadedImg: string;

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

  async removeRecommendationsByUserId(userId: string) {
    return this.userProfileRecommandationModel.destroy({
      where: { UserId: userId },
      individualHooks: true,
    });
  }

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
}
