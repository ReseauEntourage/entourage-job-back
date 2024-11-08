import { CACHE_MANAGER, forwardRef, Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Cache } from 'cache-manager';
import { Op, QueryTypes, WhereOptions } from 'sequelize';
import { FindOptions } from 'sequelize/types/model';
import { AuthService } from 'src/auth/auth.service';
import { BusinessLine } from 'src/common/business-lines/models';
import { Department } from 'src/common/locations/locations.types';
import { getPublishedCVQuery } from 'src/cvs/cvs.utils';
import { CV } from 'src/cvs/models';
import { MailsService } from 'src/mails/mails.service';
import { Organization } from 'src/organizations/models';
import { QueuesService } from 'src/queues/producers/queues.service';
import { Jobs } from 'src/queues/queues.types';
import { AdminZone, FilterParams, RedisKeys } from 'src/utils/types';
import { UpdateUserDto } from './dto';
import {
  PublicUserAttributes,
  User,
  UserAttributes,
  UserCandidat,
  UserCandidatAttributes,
} from './models';
import { UserCandidatInclude } from './models/user.include';
import {
  CVStatuses,
  MemberFilterKey,
  UserRole,
  UserRoles,
} from './users.types';

import {
  getCommonMembersFilterOptions,
  lastCVVersionWhereOptions,
  userSearchQuery,
  userSearchQueryRaw,
} from './users.utils';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User)
    private userModel: typeof User,
    private queuesService: QueuesService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private mailsService: MailsService,
    @Inject(forwardRef(() => AuthService))
    private authService: AuthService
  ) {}

  async create(createUserDto: Partial<User>) {
    return this.userModel.create(createUserDto, { hooks: true });
  }

  async findOne(id: string) {
    return this.userModel.findByPk(id, {
      attributes: [...UserAttributes],
      include: UserCandidatInclude,
    });
  }

  async findOneByMail(email: string) {
    return this.userModel.findOne({
      where: { email: email.toLowerCase() },
      attributes: [...UserAttributes],
      include: UserCandidatInclude,
    });
  }

  async findOneComplete(id: string) {
    return this.userModel.findByPk(id, {
      include: UserCandidatInclude,
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

    const { filterOptions, replacements } = getCommonMembersFilterOptions({
      ...restParams,
      role: [UserRoles.CANDIDATE],
    });

    const candidatesIds: { userId: string }[] =
      await this.userModel.sequelize.query(
        `
        SELECT 
          "User"."id" as "userId"

        FROM "Users" AS "User"

        LEFT OUTER JOIN "User_Candidats" AS "candidat" 
          ON "User"."id" = "candidat"."candidatId"
        LEFT OUTER JOIN "CVs" AS "candidat->cvs" 
          ON "candidat"."candidatId" = "candidat->cvs"."UserId" 
          AND "candidat->cvs"."deletedAt" IS NULL 
          AND ("UserId", "version") IN (
            SELECT
              "CVs"."UserId" AS "candidateId", MAX("CVs"."version") AS "maxVersion" 
            FROM "CVs"
            GROUP BY
              "CVs"."UserId"
          )
        LEFT OUTER JOIN "CV_BusinessLines" AS "candidat->cvs->businessLines->CVBusinessLine"
          ON "candidat->cvs"."id" = "candidat->cvs->businessLines->CVBusinessLine"."CVId"
        LEFT OUTER JOIN "BusinessLines" AS "candidat->cvs->businessLines" 
          ON "candidat->cvs->businessLines"."id" = "candidat->cvs->businessLines->CVBusinessLine"."BusinessLineId"
        LEFT OUTER JOIN "Users" AS "candidat->coach"
          ON "candidat"."coachId" = "candidat->coach"."id" 
          AND ("candidat->coach"."deletedAt" IS NULL)
        LEFT OUTER JOIN "Organizations" AS "candidat->coach->organization"
          ON "candidat->coach"."OrganizationId" = "candidat->coach->organization"."id"
        LEFT OUTER JOIN "Organizations" AS "organization" 
          ON "User"."OrganizationId" = "organization"."id"

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
          /* eslint-disable no-console */
          logging: console.log,
          benchmark: true,
          /* eslint-enable no-console */
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
              model: CV,
              as: 'cvs',
              attributes: ['version', 'status', 'urlImg'],
              where: {
                ...lastCVVersionWhereOptions,
              },
              required: false,
              include: [
                {
                  model: BusinessLine,
                  as: 'businessLines',
                  attributes: ['name', 'order'],
                  required: false,
                },
              ],
            },
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
      ],
      /* eslint-disable no-console */
      logging: console.log,
      benchmark: true,
      /* eslint-enable no-console */
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

    const { replacements, filterOptions } = getCommonMembersFilterOptions({
      ...restParams,
      role: [UserRoles.COACH],
    });

    const coachesIds: { userId: string }[] =
      await this.userModel.sequelize.query(
        `
        SELECT 
          "User"."id" as "userId"

        FROM "Users" as "User"
                     
        LEFT OUTER JOIN "User_Candidats" AS "coaches" 
          ON "User"."id" = "coaches"."coachId"
        LEFT OUTER JOIN "Users" AS "coaches->candidat"
          ON "coaches"."candidatId" = "coaches->candidat"."id" 
          AND ("coaches->candidat"."deletedAt" IS NULL)
        LEFT OUTER JOIN "Organizations" AS "coaches->candidat->organization"
          ON "coaches->candidat"."OrganizationId" = "coaches->candidat->organization"."id"
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
          model: UserCandidat,
          as: 'coaches',
          attributes: ['coachId', 'candidatId', ...UserCandidatAttributes],
          required: false,
          include: [
            {
              model: User,
              as: 'candidat',
              attributes: [...UserAttributes],
              required: false,
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
    const publishedCVs: CV[] = await this.userModel.sequelize.query(
      getPublishedCVQuery({ [Op.or]: [false] }),
      {
        type: QueryTypes.SELECT,
      }
    );
    const options = {
      attributes: [...PublicUserAttributes],
      where: {
        [Op.and]: [
          {
            id: publishedCVs.map((publishedCV) => {
              return publishedCV.UserId;
            }),
          },
          {
            [Op.or]: userSearchQuery(search),
          },
        ],
      },
    };
    return this.userModel.findAll(options);
  }

  async findAllPublishedCandidatesByDepartmentAndBusinessLines(
    department: Department,
    businessLines: BusinessLine[]
  ) {
    const publishedCVs: CV[] = await this.userModel.sequelize.query(
      getPublishedCVQuery(
        { [Op.or]: [false] },
        { [Op.or]: [department] },
        {
          [Op.or]: businessLines.map(({ name }) => {
            return name;
          }),
        }
      ),
      {
        type: QueryTypes.SELECT,
      }
    );

    const options = {
      attributes: [...UserAttributes],
      where: {
        [Op.and]: [
          {
            id: publishedCVs.map((publishedCV) => {
              return publishedCV.UserId;
            }),
          },
        ],
      },
      include: UserCandidatInclude,
    };

    return this.userModel.findAll(options);
  }

  async countSubmittedCVMembers(zone: AdminZone) {
    const whereOptions: WhereOptions<CV> = zone
      ? ({ zone } as WhereOptions<CV>)
      : {};

    const options: FindOptions<User> = {
      where: {
        ...whereOptions,
        role: UserRoles.CANDIDATE,
      } as WhereOptions<User>,
      attributes: [],
      include: [
        {
          model: UserCandidat,
          as: 'candidat',
          attributes: [],
          required: true,
          include: [
            {
              model: CV,
              as: 'cvs',
              attributes: [],
              where: {
                ...lastCVVersionWhereOptions,
                status: CVStatuses.PENDING.value,
              },
            },
          ],
        },
      ],
    };

    const { count: pendingCVs } = await this.userModel.findAndCountAll(options);

    return {
      pendingCVs,
    };
  }

  async countOrganizationAssociatedUsers(organizationId: string) {
    const { count: candidatesCount } = await this.userModel.findAndCountAll({
      where: {
        OrganizationId: organizationId,
        role: UserRoles.CANDIDATE,
      },
    });

    const { count: coachesCount } = await this.userModel.findAndCountAll({
      where: {
        OrganizationId: organizationId,
        role: UserRoles.COACH,
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
      coachesCount,
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

  async sendMailsAfterMatching(candidateId: string) {
    const candidate = await this.findOne(candidateId);

    await this.mailsService.sendCVPreparationMail(candidate.toJSON());

    await this.queuesService.addToWorkQueue(
      Jobs.REMINDER_CV_10,
      {
        candidateId,
      },
      {
        delay:
          // delay depending on environment to make it faster in local
          (process.env.CV_10_REMINDER_DELAY
            ? parseFloat(process.env.CV_10_REMINDER_DELAY)
            : 10) *
          3600000 *
          24,
      }
    );
    await this.queuesService.addToWorkQueue(
      Jobs.REMINDER_CV_20,
      {
        candidateId,
      },
      {
        delay:
          (process.env.CV_20_REMINDER_DELAY
            ? // delay depending on environment to make it faster in local
              parseFloat(process.env.CV_20_REMINDER_DELAY)
            : 20) *
          3600000 *
          24,
      }
    );
  }

  // TODO fix duplicate
  async uncacheCandidateCV(url: string) {
    await this.cacheManager.del(RedisKeys.CV_PREFIX + url);
  }

  // TODO fix duplicate
  async cacheCandidateCV(candidateId: string) {
    await this.queuesService.addToWorkQueue(Jobs.CACHE_CV, {
      candidateId,
    });
  }

  // TODO fix duplicate
  async cacheAllCVs() {
    await this.queuesService.addToWorkQueue(Jobs.CACHE_ALL_CVS, {});
  }

  async generateVerificationToken(user: User) {
    return this.authService.generateVerificationToken(user);
  }

  async sendVerificationMail(user: User, token: string) {
    return this.mailsService.sendVerificationMail(user, token);
  }
}
