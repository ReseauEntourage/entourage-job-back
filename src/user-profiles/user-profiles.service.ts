/* eslint-disable no-console */
import fs from 'fs';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import _ from 'lodash';
import sequelize, { Op, WhereOptions, QueryTypes } from 'sequelize';
import sharp from 'sharp';
import { BusinessSector } from 'src/common/business-sectors/models';
import { Department, Departments } from 'src/common/locations/locations.types';
import { Occupation } from 'src/common/occupations/models';
import { S3Service } from 'src/external-services/aws/s3.service';
import { SlackService } from 'src/external-services/slack/slack.service';
import { MailsService } from 'src/mails/mails.service';
import { MessagesService } from 'src/messages/messages.service';
import { User } from 'src/users/models';
import { UserCandidatsService } from 'src/users/user-candidats.service';
import { UsersService } from 'src/users/users.service';
import { UserRole, UserRoles } from 'src/users/users.types';
import { ReportAbuseUserProfileDto } from './dto/report-abuse-user-profile.dto';
import {
  HelpNeed,
  HelpOffer,
  UserProfile,
  UserProfileSectorOccupation,
} from './models';
import { UserProfileRecommendation } from './models/user-profile-recommendation.model';
import {
  UserProfilesAttributes,
  UserProfilesUserAttributes,
} from './models/user-profile.attributes';
import { getUserProfileInclude } from './models/user-profile.include';
import { HelpValue, PublicProfile } from './user-profiles.types';
import { userProfileSearchQuery } from './user-profiles.utils';

const UserProfileRecommendationsWeights = {
  BUSINESS_SECTORS: 0.3,
  HELPS: 0.5,
};

@Injectable()
export class UserProfilesService {
  constructor(
    @InjectModel(UserProfile)
    private userProfileModel: typeof UserProfile,
    @InjectModel(BusinessSector)
    private businessSectorModel: typeof BusinessSector,
    @InjectModel(Occupation)
    private occupationModel: typeof Occupation,
    @InjectModel(UserProfileSectorOccupation)
    private userProfileSectorOccupationModel: typeof UserProfileSectorOccupation,
    @InjectModel(HelpNeed)
    private helpNeedModel: typeof HelpNeed,
    @InjectModel(HelpOffer)
    private helpOfferModel: typeof HelpOffer,
    @InjectModel(UserProfileRecommendation)
    private userProfileRecommandationModel: typeof UserProfileRecommendation,
    private s3Service: S3Service,
    private usersService: UsersService,
    private userCandidatsService: UserCandidatsService,
    private messagesService: MessagesService,
    private slackService: SlackService,
    private mailsService: MailsService
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

  async findOneByUserId(userId: string, complete = false) {
    return this.userProfileModel.findOne({
      where: { userId },
      include: getUserProfileInclude(complete),
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
      businessSectorIds: string[];
    }
  ): Promise<PublicProfile[]> {
    const {
      role,
      offset,
      limit,
      search,
      helps,
      departments,
      businessSectorIds,
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

    const helpsOptions: WhereOptions<HelpNeed | HelpOffer> =
      helps?.length > 0
        ? {
            name: {
              [Op.or]: helps,
            },
          }
        : {};

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
      ...(!_.isEmpty(departmentsOptions) ? { where: departmentsOptions } : {}),
      include: [
        ...getUserProfileInclude(
          false,
          role,
          businessSectorsOptions,
          helpsOptions
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
      where: { userId },
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
      // UserProfile
      await this.userProfileModel.update(updateUserProfileDto, {
        where: { userId },
        individualHooks: true,
        transaction: t,
      });

      // Business Sectors & Occupation
      if (updateUserProfileDto.sectorOccupations) {
        console.log(
          'updateUserProfileDto.sectorOccupations',
          updateUserProfileDto.sectorOccupations
        );
        const sectorOccupations = await Promise.all(
          updateUserProfileDto.sectorOccupations.map(
            async ({ businessSectorId, occupation, order }) => {
              console.log('--- Inputs -----');
              console.log('businessSectorId', businessSectorId);
              console.log('occupation', occupation);
              console.log('order', order);
              console.log('-----');
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
                      where: {
                        name: occupation.name,
                      },
                    },
                  ],
                });

              console.log('existingSectorOccupation', existingSectorOccupation);

              if (existingSectorOccupation) {
                return existingSectorOccupation;
              }
              const newOccupation = await this.occupationModel.create(
                {
                  name: occupation.name,
                  prefix: occupation.prefix,
                },
                {
                  hooks: true,
                  transaction: t,
                }
              );
              console.log('newOccupation', newOccupation);
              return await this.userProfileSectorOccupationModel.create(
                {
                  userProfileId: userProfileToUpdate.id,
                  businessSectorId,
                  occupationId: newOccupation.id,
                  order,
                },
                {
                  hooks: true,
                  transaction: t,
                }
              );
            }
          )
        );

        userProfileToUpdate.$set('sectorOccupations', sectorOccupations, {
          transaction: t,
        });
      }

      // HelpsNeeds
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
            userId,
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

    const helps = [...userProfile.helpNeeds, ...userProfile.helpOffers];
    const businessSectors = userProfile.businessSectors;

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
      profileBusinessSectors: string;
      profileHelps: string;
    }

    const sql = `
    SELECT
      u.id,
      u."firstName",
      u."lastName",
      u.email,
      up.department,
      up."currentJob",
      u.role,
      u."lastConnection",
      u."createdAt" as "createdAt",
      string_agg(DISTINCT a.name, ', ') as occupations,
      string_agg(DISTINCT COALESCE(sb.name, nb.name), ', ') as "profileBusinessSectors",  
      string_agg(DISTINCT COALESCE(ho.name, hn.name), ', ') as "profileHelps"
    
    FROM "Users" u
    LEFT JOIN "User_Profiles" up 
      ON u.id = up."userId"
    
    LEFT JOIN "User_Profile_Search_Ambitions" upsa
      ON up.id = upsa."UserProfileId"
    LEFT JOIN "Ambitions" a
      ON a.id = upsa."AmbitionId"
    
    LEFT JOIN "User_Profile_Search_BusinessLines" upsb
      ON up.id = upsb."UserProfileId"
    LEFT JOIN "BusinessLines" sb
      ON sb.id = upsb."BusinessLineId"
    
    LEFT JOIN "User_Profile_Network_BusinessLines" upnb
      ON up.id = upnb."UserProfileId"
    LEFT JOIN "BusinessLines" nb
      ON nb.id = upnb."BusinessLineId"
    
    LEFT JOIN "Help_Needs" hn 
      ON up.id = hn."UserProfileId"
    LEFT JOIN "Help_Offers" ho
      ON up.id = ho."UserProfileId"
    
    WHERE u."deletedAt" IS NULL
    AND up."isAvailable" IS TRUE
    AND up.department IN (${sameRegionDepartmentsOptions.map(
      // remplacer un appostrophe par deux appostrophes
      (department) => `'${department.replace(/'/g, "''")}'`
    )})
    AND u.role IN (${rolesToFind.map((role) => `'${role}'`)})
    AND u."lastConnection" IS NOT NULL

    -- InternalMessages join optimisation
    AND u.id NOT IN (
      SELECT
        "addresseeUserId"
      FROM
        "InternalMessages"
      WHERE
        "senderUserId" = '${userId}'
    )
    AND u.id NOT IN (
      SELECT
        "senderUserId"
      FROM
        "InternalMessages"
      WHERE
        "addresseeUserId" = '${userId}'
    )
        
    GROUP BY u.id, u."firstName", u."lastName", u.email, u."zone", u.role, u."lastConnection", up.department, up."currentJob"
    ;`;

    const profiles: UserRecommendationSQL[] =
      await this.userProfileModel.sequelize.query(sql, {
        type: QueryTypes.SELECT,
      });

    const sortedProfiles = _.orderBy(
      profiles,
      [
        (profile) => {
          const profileBusinessSectors = profile.profileBusinessSectors
            ? profile.profileBusinessSectors.split(', ')
            : [];

          const businessSectorsDifference = _.difference(
            businessSectors.map(({ name }) => name),
            profileBusinessSectors
          );

          const businessSectorsMatching =
            (businessSectors.length - businessSectorsDifference.length) *
            UserProfileRecommendationsWeights.BUSINESS_SECTORS;

          const profileHelps = profile.profileHelps
            ? profile.profileHelps.split(', ')
            : [];

          const helpsDifferences = _.difference(
            helps.map(({ name }) => name),
            profileHelps
          );

          const helpsMatching =
            (helps.length - helpsDifferences.length) *
            UserProfileRecommendationsWeights.HELPS;

          return businessSectorsMatching + helpsMatching;
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
      where: { userId },
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
