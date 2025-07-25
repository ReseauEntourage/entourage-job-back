import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, QueryTypes } from 'sequelize';
import { FindOptions } from 'sequelize/types/model';
import { AuthService } from 'src/auth/auth.service';
import { BusinessSectorsService } from 'src/common/business-sectors/business-sectors.service';
import { MailsService } from 'src/mails/mails.service';
import { Organization } from 'src/organizations/models';
import { PublicProfileFilterKey } from 'src/public-profiles/public-profiles.types';
import { UserProfile } from 'src/user-profiles/models';
import { FilterParams } from 'src/utils/types';
import { UpdateUserDto } from './dto';
import {
  User,
  UserAttributes,
  UserCandidat,
  UserCandidatAttributes,
} from './models';
import { PublicUserAttributes } from './models/user.attributes';
import {
  getUserCandidatOrder,
  UserCandidatInclude,
  userPublicProfileInclude,
  userPublicProfileOrder,
} from './models/user.include';
import { MemberFilterKey, UserRole, UserRoles } from './users.types';

import {
  getCommonMembersFilterOptions,
  userSearchQuery,
  userSearchQueryRaw,
} from './users.utils';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User)
    private userModel: typeof User,
    private mailsService: MailsService,
    @Inject(forwardRef(() => AuthService))
    private authService: AuthService,
    private businessSectorsService: BusinessSectorsService
  ) {}

  async create(createUserDto: Partial<User>) {
    return this.userModel.create(createUserDto, { hooks: true });
  }

  async findOne(id: string) {
    return this.userModel.findByPk(id, {
      attributes: [...UserAttributes],
      include: UserCandidatInclude(),
      order: getUserCandidatOrder(),
    });
  }

  async findOneByMail(email: string) {
    return this.userModel.findOne({
      where: { email: email.toLowerCase() },
      attributes: [...UserAttributes],
      include: UserCandidatInclude(),
      order: getUserCandidatOrder(),
    });
  }

  async findOneComplete(id: string) {
    return this.userModel.findByPk(id, {
      include: UserCandidatInclude(),
    });
  }

  async findAllCandidateMembers(
    params: {
      limit: number;
      offset: number;
      search: string;
    } & FilterParams<MemberFilterKey>
  ): Promise<User[]> {
    const { limit, offset, search, ...restParams } = params;

    const allBusinessSectors = await this.businessSectorsService.all();
    const { filterOptions, replacements } = getCommonMembersFilterOptions(
      {
        ...restParams,
        role: [UserRoles.CANDIDATE],
      },
      allBusinessSectors
    );

    const candidatesIds: { userId: string }[] =
      await this.userModel.sequelize.query(
        `
        SELECT 
          "User"."id" as "userId"

        FROM "Users" AS "User"

        LEFT OUTER JOIN "User_Candidats" AS "candidat" 
          ON "User"."id" = "candidat"."candidatId"
        LEFT OUTER JOIN "Users" AS "candidat->coach"
          ON "candidat"."coachId" = "candidat->coach"."id" 
          AND ("candidat->coach"."deletedAt" IS NULL)
        LEFT OUTER JOIN "Organizations" AS "candidat->coach->organization"
          ON "candidat->coach"."OrganizationId" = "candidat->coach->organization"."id"
        LEFT OUTER JOIN "Organizations" AS "organization"
          ON "User"."OrganizationId" = "organization"."id"
        LEFT OUTER JOIN "UserProfiles" AS "userProfile"
          ON "User"."id" = "userProfile"."userId"
        LEFT OUTER JOIN "UserProfileSectorOccupations" AS "userProfile->sectorOccupations"
          ON "userProfile"."id" = "userProfile->sectorOccupations"."userProfileId"
        LEFT OUTER JOIN "BusinessSectors" AS "userProfile->sectorOccupations->businessSectors"
          ON "userProfile->sectorOccupations"."businessSectorId" = "userProfile->sectorOccupations->businessSectors"."id"

        WHERE 
          "User"."deletedAt" IS NULL
          AND ${filterOptions.join(' AND ')} ${
          search ? `AND ${userSearchQueryRaw(search, true)}` : ''
        }

        GROUP BY "User"."id"
        ORDER BY "User"."firstName" ASC
        LIMIT ${limit}
        OFFSET ${offset}
        `,
        {
          type: QueryTypes.SELECT,
          raw: true,
          replacements,
        }
      );

    return this.userModel.findAll({
      attributes: [...UserAttributes],
      where: {
        id: candidatesIds.map(({ userId }) => userId),
      },
      order: [['firstName', 'ASC']],
      include: [
        {
          model: UserCandidat,
          as: 'candidat',
          attributes: ['coachId', 'candidatId', ...UserCandidatAttributes],
          required: false,
          include: [
            {
              model: User,
              as: 'coach',
              required: false,
              attributes: [...UserAttributes],
              include: [
                {
                  model: Organization,
                  as: 'organization',
                  attributes: ['name', 'address', 'zone', 'id'],
                  required: false,
                },
              ],
            },
          ],
        },
        {
          model: Organization,
          as: 'organization',
          attributes: ['name', 'address', 'zone', 'id'],
          required: false,
        },
        {
          model: UserProfile,
          as: 'userProfile',
          attributes: ['id', 'hasPicture'],
          required: false,
        },
      ],
    });
  }

  async findAllCoachMembers(
    params: {
      limit: number;
      offset: number;
      search: string;
    } & FilterParams<MemberFilterKey>
  ): Promise<User[]> {
    const { limit, offset, search, ...restParams } = params;

    const allBusinessSectors = await this.businessSectorsService.all();
    const { replacements, filterOptions } = getCommonMembersFilterOptions(
      {
        ...restParams,
        role: [UserRoles.COACH],
      },
      allBusinessSectors
    );

    const coachesIds: { userId: string }[] =
      await this.userModel.sequelize.query(
        `
        SELECT 
          "User"."id" as "userId"

        FROM "Users" as "User"

        LEFT OUTER JOIN "Organizations" AS "organization" 
          ON "User"."OrganizationId" = "organization"."id"
            
        WHERE "User"."deletedAt" IS NULL
          AND ${filterOptions.join(' AND ')} ${
          search ? `AND ${userSearchQueryRaw(search, true)}` : ''
        }
        
        GROUP BY "User"."id"
        ORDER BY "User"."firstName" ASC
        LIMIT ${limit}
        OFFSET ${offset}
        `,
        {
          type: QueryTypes.SELECT,
          raw: true,
          replacements,
        }
      );

    return this.userModel.findAll({
      attributes: [...UserAttributes],
      where: {
        id: coachesIds.map(({ userId }) => userId),
      },
      order: [['firstName', 'ASC']],
      include: [
        {
          model: Organization,
          as: 'organization',
          attributes: ['name', 'address', 'zone', 'id'],
          required: false,
        },
        {
          model: UserProfile,
          as: 'userProfile',
          attributes: ['id', 'hasPicture'],
          required: false,
        },
      ],
    });
  }

  async findAllRefererMembers(
    params: {
      limit: number;
      offset: number;
      search: string;
    } & FilterParams<MemberFilterKey>
  ): Promise<User[]> {
    const { limit, offset, search, ...restParams } = params;

    const allBusinessSectors = await this.businessSectorsService.all();
    const { replacements, filterOptions } = getCommonMembersFilterOptions(
      {
        ...restParams,
        role: [UserRoles.REFERER],
      },
      allBusinessSectors
    );

    const referersIds: { userId: string }[] =
      await this.userModel.sequelize.query(
        `
        SELECT 
          "User"."id" as "userId"

        FROM "Users" as "User"
                     
        LEFT OUTER JOIN "Organizations" AS "organization" 
          ON "User"."OrganizationId" = "organization"."id"
            
        WHERE "User"."deletedAt" IS NULL
          AND ${filterOptions.join(' AND ')} ${
          search ? `AND ${userSearchQueryRaw(search, true)}` : ''
        }
        
        GROUP BY "User"."id"
        ORDER BY "User"."firstName" ASC
        LIMIT ${limit}
        OFFSET ${offset}
        `,
        {
          type: QueryTypes.SELECT,
          raw: true,
          replacements,
        }
      );

    return this.userModel.findAll({
      attributes: [...UserAttributes],
      where: {
        id: referersIds.map(({ userId }) => userId),
      },
      order: [['firstName', 'ASC']],
      include: [
        {
          model: User,
          as: 'referredCandidates',
          attributes: [...UserAttributes],
          include: [
            {
              model: UserCandidat,
              as: 'candidat',
              attributes: [...UserCandidatAttributes],
              paranoid: false,
              include: [
                {
                  model: User,
                  as: 'candidat',
                  attributes: [...UserAttributes],
                },
              ],
            },
          ],
        },
        {
          model: Organization,
          as: 'organization',
          attributes: ['name', 'address', 'zone', 'id'],
          required: false,
        },
        {
          model: UserProfile,
          as: 'userProfile',
          attributes: ['id', 'hasPicture'],
          required: false,
        },
      ],
    });
  }

  async findAllUsers(search: string, role: UserRole[], organizationId: string) {
    const options: FindOptions<User> = {
      attributes: [...UserAttributes],
      where: {
        [Op.or]: userSearchQuery(search, true),
      },
      include: [
        {
          model: Organization,
          as: 'organization',
          attributes: ['name', 'address', 'zone', 'id'],
        },
      ],
    };
    if (role) {
      options.where = {
        ...options.where,
        role: role,
      };
    }
    if (organizationId) {
      options.where = {
        ...options.where,
        OrganizationId: organizationId,
      };
    }
    return this.userModel.findAll(options);
  }

  async findAllCandidates(search: string) {
    const options = {
      attributes: [...PublicUserAttributes],
      where: {
        [Op.and]: [
          {
            [Op.or]: userSearchQuery(search),
          },
        ],
      },
    };
    return this.userModel.findAll(options);
  }

  async countOrganizationAssociatedUsers(organizationId: string) {
    const { count: candidatesCount } = await this.userModel.findAndCountAll({
      where: {
        OrganizationId: organizationId,
        role: UserRoles.CANDIDATE,
      },
    });

    const { count: referersCount } = await this.userModel.findAndCountAll({
      where: {
        OrganizationId: organizationId,
        role: UserRoles.REFERER,
      },
    });

    return {
      candidatesCount,
      referersCount,
    };
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    await this.userModel.update(updateUserDto, {
      where: { id },
      individualHooks: true,
    });

    const updatedUser = await this.findOne(id);

    if (!updatedUser) {
      return null;
    }

    return updatedUser.toJSON();
  }

  async remove(id: string) {
    return this.userModel.destroy({
      where: { id },
      individualHooks: true,
    });
  }

  async generateVerificationToken(user: User) {
    return this.authService.generateVerificationToken(user);
  }

  async sendVerificationMail(user: User, token: string) {
    return this.mailsService.sendVerificationMail(user, token);
  }

  async findAllPublicProfiles(
    query: {
      limit: number;
      offset: number;
      search: string;
    } & FilterParams<PublicProfileFilterKey>
  ) {
    const { limit, offset } = query;

    // const filtersObj = getFiltersObjectsFromQueryParams<
    //   PublicProfileFilterKey,
    //   PublicProfileConstantType
    // >(params, PublicProfileFilters);

    // const escapedQuery = escapeQuery(search);
    return this.userModel.findAll({
      limit,
      offset,
      attributes: PublicUserAttributes,
      include: UserCandidatInclude(),
      order: getUserCandidatOrder(),
      where: {
        lastConnection: { [Op.ne]: null },
        role: UserRoles.CANDIDATE,
      },
    });
  }

  async findPublicProfileByCandidateId(candidateId: string) {
    return this.userModel.findOne({
      where: { id: candidateId, role: UserRoles.CANDIDATE },
      attributes: PublicUserAttributes,
      include: userPublicProfileInclude,
      order: userPublicProfileOrder(),
    });
  }
}
