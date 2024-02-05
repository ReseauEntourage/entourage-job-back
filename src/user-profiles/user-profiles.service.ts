import fs from 'fs';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import _ from 'lodash';
import sequelize, { Op, WhereOptions } from 'sequelize';
import sharp from 'sharp';
import { Ambition } from 'src/common/ambitions/models';
import { BusinessLineValue } from 'src/common/business-lines/business-lines.types';
import { BusinessLine } from 'src/common/business-lines/models';
import { Department } from 'src/common/locations/locations.types';
import { S3Service } from 'src/external-services/aws/s3.service';
import { MessagesService } from 'src/messages/messages.service';
import { User } from 'src/users/models';
import { UsersService } from 'src/users/users.service';
import { UserRole } from 'src/users/users.types';
import {
  HelpNeed,
  HelpOffer,
  UserProfile,
  UserProfileNetworkBusinessLine,
  UserProfileSearchAmbition,
  UserProfileSearchBusinessLine,
} from './models';
import { UserProfilesAttributes } from './models/user-profile.attributes';
import { getUserProfileInclude } from './models/user-profile.include';
import { HelpValue, PublicProfile } from './user-profiles.types';
import { userProfileSearchQuery } from './user-profiles.utils';

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
    private s3Service: S3Service,
    private usersService: UsersService,
    private messagesService: MessagesService
  ) {}

  async findOne(id: string) {
    return this.userProfileModel.findByPk(id, {
      include: getUserProfileInclude(),
    });
  }

  async findOneByUserId(userId: string) {
    return this.userProfileModel.findOne({
      where: { UserId: userId },
      include: getUserProfileInclude(),
    });
  }

  async findOneUser(userId: string) {
    return this.usersService.findOne(userId);
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

    const profiles = await this.userProfileModel.findAll({
      offset,
      limit,
      attributes: UserProfilesAttributes,
      order: sequelize.literal('"user.createdAt" DESC'),
      ...(!_.isEmpty(departmentsOptions) ? { where: departmentsOptions } : {}),
      include: [
        ...getUserProfileInclude(role, businessLinesOptions, helpsOptions),
        {
          model: User,
          as: 'user',
          attributes: ['id', 'firstName', 'lastName', 'role', 'createdAt'],
          where: {
            role,
            id: { [Op.not]: userId },
            ...searchOptions,
          },
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

  removeByUserId(userId: string) {
    return this.userProfileModel.destroy({
      where: { UserId: userId },
      individualHooks: true,
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
}
