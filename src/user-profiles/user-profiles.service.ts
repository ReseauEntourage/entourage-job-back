import fs from 'fs';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import _ from 'lodash';
import sequelize, { Op, WhereOptions } from 'sequelize';
import sharp from 'sharp';
import { Ambition } from 'src/common/ambitions/models';
import { BusinessLineValue } from 'src/common/business-lines/business-lines.types';
import { BusinessLine } from 'src/common/business-lines/models';
import { Department, Departments } from 'src/common/locations/locations.types';
import { S3Service } from 'src/external-services/aws/s3.service';
import { MessagesService } from 'src/messages/messages.service';
import { InternalMessage } from 'src/messages/models';
import { User } from 'src/users/models';
import { UserCandidatsService } from 'src/users/user-candidats.service';
import { UsersService } from 'src/users/users.service';
import {
  CandidateUserRoles,
  CoachUserRoles,
  UserRole,
  UserRoles,
} from 'src/users/users.types';
import { isRoleIncluded } from 'src/users/users.utils';
import {
  HelpNeed,
  HelpOffer,
  UserProfile,
  UserProfileNetworkBusinessLine,
  UserProfileSearchAmbition,
  UserProfileSearchBusinessLine,
} from './models';
import { UserProfileRecommendation } from './models/user-profile-recommendation.model';
import {
  UserProfilesAttributes,
  UserProfilesUserAttributes,
} from './models/user-profile.attributes';
import {
  getUserProfileAmbitionsInclude,
  getUserProfileBusinessLinesInclude,
  getUserProfileInclude,
} from './models/user-profile.include';
import { HelpValue, PublicProfile } from './user-profiles.types';
import { userProfileSearchQuery } from './user-profiles.utils';

const UserProfileRecommendationsWeights = {
  BUSINESS_LINES: 0.3,
  HELPS: 0.5,
};

@Injectable()
export class UserProfilesService {
  constructor(
    @InjectModel(UserProfile)
    private userProfileModel: typeof UserProfile,
    @InjectModel(BusinessLine)
    private businessLineModel: typeof BusinessLine,
    @InjectModel(UserProfileNetworkBusinessLine)
    private userProfileNetworkBusinessLineModel: typeof UserProfileNetworkBusinessLine,
    @InjectModel(UserProfileSearchBusinessLine)
    private userProfileSearchBusinessLineModel: typeof UserProfileSearchBusinessLine,
    @InjectModel(UserProfileSearchAmbition)
    private userProfileSearchAmbitionModel: typeof UserProfileSearchAmbition,
    @InjectModel(Ambition)
    private ambitionModel: typeof Ambition,
    @InjectModel(HelpNeed)
    private helpNeedModel: typeof HelpNeed,
    @InjectModel(HelpOffer)
    private helpOfferModel: typeof HelpOffer,
    @InjectModel(UserProfileRecommendation)
    private userProfileRecommandationModel: typeof UserProfileRecommendation,
    private s3Service: S3Service,
    private usersService: UsersService,
    private userCandidatsService: UserCandidatsService,
    private messagesService: MessagesService
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

  async findOneByUserId(userId: string) {
    return this.userProfileModel.findOne({
      where: { UserId: userId },
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
      helps: HelpValue[];
      departments: Department[];
      businessLines: BusinessLineValue[];
    }
  ): Promise<PublicProfile[]> {
    const { role, offset, limit, search, helps, departments, businessLines } =
      query;

    const searchOptions = search
      ? { [Op.or]: userProfileSearchQuery(search) }
      : {};

    const departmentsOptions: WhereOptions<UserProfile> =
      departments?.length > 0
        ? {
            department: { [Op.or]: departments },
          }
        : {};

    const businessLinesOptions: WhereOptions<BusinessLine> =
      businessLines?.length > 0
        ? {
            name: { [Op.or]: businessLines },
          }
        : {};

    const helpsOptions: WhereOptions<HelpNeed | HelpOffer> =
      helps?.length > 0
        ? {
            name: {
              [Op.or]: helps,
            },
          }
        : {};

    const filteredProfiles = await this.userProfileModel.findAll({
      offset,
      limit,
      attributes: ['id'],
      order: sequelize.literal('"user.createdAt" DESC'),
      ...(!_.isEmpty(departmentsOptions) ? { where: departmentsOptions } : {}),
      include: [
        ...getUserProfileInclude(role, businessLinesOptions, helpsOptions),
        {
          model: User,
          as: 'user',
          attributes: ['createdAt'],
          where: {
            role,
            id: { [Op.not]: userId },
            ...searchOptions,
          },
        },
      ],
    });

    const profiles = await this.userProfileModel.findAll({
      attributes: UserProfilesAttributes,
      order: sequelize.literal('"user.createdAt" DESC'),
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

        const { user, ...restProfile }: UserProfile = profile.toJSON();
        return {
          ...user,
          ...restProfile,
          lastSentMessage: lastSentMessage?.createdAt || null,
          lastReceivedMessage: lastReceivedMessage?.createdAt || null,
        };
      })
    );
  }

  async findRecommendationsByUserId(
    userId: string
  ): Promise<UserProfileRecommendation[]> {
    return this.userProfileRecommandationModel.findAll({
      where: { UserId: userId },
      order: sequelize.literal('"recommendedUser.createdAt" DESC'),
      include: {
        model: User,
        as: 'recommendedUser',
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

  async updateByUserId(
    userId: string,
    updateUserProfileDto: Partial<UserProfile>
  ) {
    const userProfileToUpdate = await this.findOneByUserId(userId);

    if (!userProfileToUpdate) {
      return null;
    }

    await this.userProfileModel.sequelize.transaction(async (t) => {
      await this.userProfileModel.update(updateUserProfileDto, {
        where: { UserId: userId },
        individualHooks: true,
        transaction: t,
      });

      if (updateUserProfileDto.networkBusinessLines) {
        const networkBusinessLines = await Promise.all(
          updateUserProfileDto.networkBusinessLines.map(
            ({ name, order = -1 }) => {
              return this.businessLineModel.create(
                { name, order },
                {
                  hooks: true,
                  transaction: t,
                }
              );
            }
          )
        );
        await userProfileToUpdate.$add(
          'networkBusinessLines',
          networkBusinessLines,
          { transaction: t }
        );
        await this.userProfileNetworkBusinessLineModel.destroy({
          where: {
            UserProfileId: userProfileToUpdate.id,
            BusinessLineId: {
              [Op.not]: networkBusinessLines.map((bl) => {
                return bl.id;
              }),
            },
          },
          hooks: true,
          transaction: t,
        });
      }
      if (updateUserProfileDto.searchBusinessLines) {
        const searchBusinessLines = await Promise.all(
          updateUserProfileDto.searchBusinessLines.map(
            ({ name, order = -1 }) => {
              return this.businessLineModel.create(
                { name, order },
                {
                  hooks: true,
                  transaction: t,
                }
              );
            }
          )
        );
        await userProfileToUpdate.$add(
          'searchBusinessLines',
          searchBusinessLines,
          { transaction: t }
        );

        await this.userProfileSearchBusinessLineModel.destroy({
          where: {
            UserProfileId: userProfileToUpdate.id,
            BusinessLineId: {
              [Op.not]: searchBusinessLines.map((bl) => {
                return bl.id;
              }),
            },
          },
          hooks: true,
          transaction: t,
        });
      }
      if (updateUserProfileDto.searchAmbitions) {
        const searchAmbitions = await Promise.all(
          updateUserProfileDto.searchAmbitions.map(
            ({ name, order = -1, prefix = 'dans' }) => {
              return this.ambitionModel.create(
                { name, order, prefix },
                {
                  hooks: true,
                  transaction: t,
                }
              );
            }
          )
        );
        await userProfileToUpdate.$add('searchAmbitions', searchAmbitions, {
          transaction: t,
        });

        await this.userProfileSearchAmbitionModel.destroy({
          where: {
            UserProfileId: userProfileToUpdate.id,
            AmbitionId: {
              [Op.not]: searchAmbitions.map((amb) => {
                return amb.id;
              }),
            },
          },
          hooks: true,
          transaction: t,
        });
      }
      if (updateUserProfileDto.helpNeeds) {
        const helpNeeds = await Promise.all(
          updateUserProfileDto.helpNeeds.map(({ name }) => {
            return this.helpNeedModel.create(
              { UserProfileId: userProfileToUpdate.id, name },
              {
                hooks: true,
                transaction: t,
              }
            );
          })
        );

        await this.helpNeedModel.destroy({
          where: {
            UserProfileId: userProfileToUpdate.id,
            id: {
              [Op.not]: helpNeeds.map((hn) => {
                return hn.id;
              }),
            },
          },
          hooks: true,
          transaction: t,
        });
      }
      if (updateUserProfileDto.helpOffers) {
        const helpOffers = await Promise.all(
          updateUserProfileDto.helpOffers.map(({ name }) => {
            return this.helpOfferModel.create(
              { UserProfileId: userProfileToUpdate.id, name },
              {
                hooks: true,
                transaction: t,
              }
            );
          })
        );
        await this.helpOfferModel.destroy({
          where: {
            UserProfileId: userProfileToUpdate.id,
            id: {
              [Op.not]: helpOffers.map((ho) => {
                return ho.id;
              }),
            },
          },
          hooks: true,
          transaction: t,
        });
      }
    });

    return this.findOneByUserId(userId);
  }

  async createRecommendations(userId: string, usersToRecommendIds: string[]) {
    return this.userProfileRecommandationModel.bulkCreate(
      usersToRecommendIds.map(
        (userToRecommendId) => {
          return {
            UserId: userId,
            RecommendedUserId: userToRecommendId,
          };
        },
        {
          hooks: true,
          individualHooks: true,
        }
      )
    );
  }

  async updateRecommendationsByUserId(userId: string) {
    const user = await this.findOneUser(userId);
    const userProfile = await this.findOneByUserId(userId);

    const rolesToFind = isRoleIncluded(CandidateUserRoles, user.role)
      ? [UserRoles.COACH]
      : CandidateUserRoles;

    const sameRegionDepartmentsOptions = Departments.filter(
      ({ region }) =>
        region ===
        Departments.find(({ name }) => userProfile.department === name).region
    ).map(({ name }) => name);

    const helps = [...userProfile.helpNeeds, ...userProfile.helpOffers];
    const businessLines = [
      ...userProfile.searchBusinessLines,
      ...userProfile.networkBusinessLines,
    ];

    const helpsOptions: WhereOptions<HelpNeed | HelpOffer> =
      helps?.length > 0
        ? {
            name: {
              [Op.or]: helps.map(({ name }) => name),
            },
          }
        : {};

    const filteredProfiles = await this.userProfileModel.findAll({
      attributes: ['id'],
      where: {
        isAvailable: true,
        department: sameRegionDepartmentsOptions,
        '$user.receivedMessages.id$': null,
        '$user.sentMessages.id$': null,
        [Op.not]: {
          ...(isRoleIncluded(CandidateUserRoles, rolesToFind)
            ? { '$helpNeeds.id$': null }
            : {}),
          ...(isRoleIncluded(CoachUserRoles, rolesToFind)
            ? { '$helpOffers.id$': null }
            : {}),
        },
      },
      include: [
        ...getUserProfileAmbitionsInclude(),
        ...getUserProfileBusinessLinesInclude(),
        {
          model: HelpNeed,
          as: 'helpNeeds',
          required: false,
          attributes: ['id'],
          ...(isRoleIncluded(CandidateUserRoles, rolesToFind)
            ? { where: helpsOptions }
            : {}),
        },
        {
          model: HelpOffer,
          as: 'helpOffers',
          required: false,
          attributes: ['id'],
          ...(isRoleIncluded(CoachUserRoles, rolesToFind)
            ? { where: helpsOptions }
            : {}),
        },
        {
          model: User,
          as: 'user',
          attributes: ['id'],
          include: [
            {
              model: InternalMessage,
              as: 'receivedMessages',
              required: false,
              attributes: ['id'],
              where: { senderUserId: userId },
            },
            {
              model: InternalMessage,
              as: 'sentMessages',
              required: false,
              attributes: ['id'],
              where: { addresseeUserId: userId },
            },
          ],
          where: {
            role: rolesToFind,
          },
        },
      ],
    });

    const profiles = await this.userProfileModel.findAll({
      attributes: UserProfilesAttributes,
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

    const sortedProfiles = _.orderBy(
      profiles,
      [
        (profile) => {
          const profileBusinessLines = [
            ...profile.searchBusinessLines,
            ...profile.networkBusinessLines,
          ];

          const businessLinesDifference = _.difference(
            businessLines.map(({ name }) => name),
            profileBusinessLines.map(({ name }) => name)
          );

          const businessLinesMatching =
            (businessLines.length - businessLinesDifference.length) *
            UserProfileRecommendationsWeights.BUSINESS_LINES;

          const profileHelps = [...profile.helpOffers, ...profile.helpNeeds];

          const helpsDifferences = _.difference(
            helps.map(({ name }) => name),
            profileHelps.map(({ name }) => name)
          );

          const helpsMatching =
            (helps.length - helpsDifferences.length) *
            UserProfileRecommendationsWeights.HELPS;

          return businessLinesMatching + helpsMatching;
        },
        ({ department }) => department === userProfile.department,
        ({ user: { createdAt } }) => createdAt,
      ],
      ['desc', 'asc', 'desc']
    );

    return this.createRecommendations(
      userId,
      sortedProfiles.slice(0, 3).map((profile) => profile.user.id)
    );
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
      where: { UserId: userId },
      individualHooks: true,
    });
  }

  async removeRecommendationsByUserId(userId: string) {
    return this.userProfileRecommandationModel.destroy({
      where: { UserId: userId },
      individualHooks: true,
    });
  }
}
