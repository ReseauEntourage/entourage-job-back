import fs from 'fs';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import _ from 'lodash';
import sequelize, { Op, WhereOptions, QueryTypes } from 'sequelize';
import sharp from 'sharp';
import { Ambition } from 'src/common/ambitions/models';
import { BusinessLineValue } from 'src/common/business-lines/business-lines.types';
import { BusinessLine } from 'src/common/business-lines/models';
import { Department, Departments } from 'src/common/locations/locations.types';
import { S3Service } from 'src/external-services/aws/s3.service';
import { SlackService } from 'src/external-services/slack/slack.service';
import { MailsService } from 'src/mails/mails.service';
import { MessagesService } from 'src/messages/messages.service';
import { User } from 'src/users/models';
import { UserCandidatsService } from 'src/users/user-candidats.service';
import { UsersService } from 'src/users/users.service';
import { CandidateUserRoles, UserRole, UserRoles } from 'src/users/users.types';
import { isRoleIncluded } from 'src/users/users.utils';
import { ReportAbuseUserProfileDto } from './dto/report-abuse-user-profile.dto';
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
import { getUserProfileInclude } from './models/user-profile.include';
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

    // this query is made in 2 steps because it filters the where clause inside the include
    // eg:
    // you want all user having in his businesslines one specific businessline
    // but you also want the request to response his businesslines list
    // you can't do that in one query, you have to do it in 2 steps, the first to filter, the second to get all attributes values
    const filteredProfiles = await this.userProfileModel.findAll({
      offset,
      limit,
      attributes: ['id'],
      order: sequelize.literal('"user.lastConnection" DESC'),
      ...(!_.isEmpty(departmentsOptions) ? { where: departmentsOptions } : {}),
      include: [
        ...getUserProfileInclude(role, businessLinesOptions, helpsOptions),
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

  // V3
  async updateRecommendationsByUserId(userId: string) {
    const [user, userProfile] = await Promise.all([
      this.findOneUser(userId),
      this.findOneByUserId(userId),
    ]);

    const rolesToFind = isRoleIncluded(CandidateUserRoles, user.role)
      ? [UserRoles.COACH]
      : CandidateUserRoles;

    const sameRegionDepartmentsOptions = userProfile.department
      ? Departments.filter(
          ({ region }) =>
            region ===
            Departments.find(({ name }) => userProfile.department === name)
              .region
        ).map(({ name }) => name)
      : Departments.map(({ name }) => name);

    const helps = [...userProfile.helpNeeds, ...userProfile.helpOffers];
    const businessLines = [
      ...userProfile.searchBusinessLines,
      ...userProfile.networkBusinessLines,
    ];

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
      ambitions: string;
      profileBusinessLines: string;
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
      string_agg(DISTINCT a.name, ', ') as ambitions,
      string_agg(DISTINCT COALESCE(sb.name, nb.name), ', ') as "profileBusinessLines",  
      string_agg(DISTINCT COALESCE(ho.name, hn.name), ', ') as "profileHelps"
    
    FROM "Users" u
    LEFT JOIN "User_Profiles" up 
      ON u.id = up."UserId"
    
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
      (department) => `'${department}'`
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
        logging(sql, timing) {
          /* eslint-disable no-console */
          console.log(sql);
          console.log('Timing: ', timing);
          /* eslint-enable no-console */
        },
        benchmark: true,
      });

    const sortedProfiles = _.orderBy(
      profiles,
      [
        (profile) => {
          const profileBusinessLines = profile.profileBusinessLines.length
            ? profile.profileBusinessLines.split(', ')
            : [];

          const businessLinesDifference = _.difference(
            businessLines.map(({ name }) => name),
            profileBusinessLines
          );

          const businessLinesMatching =
            (businessLines.length - businessLinesDifference.length) *
            UserProfileRecommendationsWeights.BUSINESS_LINES;

          const profileHelps = profile.profileHelps.length
            ? profile.profileHelps.split(', ')
            : [];

          const helpsDifferences = _.difference(
            helps.map(({ name }) => name),
            profileHelps
          );

          const helpsMatching =
            (helps.length - helpsDifferences.length) *
            UserProfileRecommendationsWeights.HELPS;

          return businessLinesMatching + helpsMatching;
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
