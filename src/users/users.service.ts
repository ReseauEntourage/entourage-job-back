import { CACHE_MANAGER, Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Cache } from 'cache-manager';
import _ from 'lodash';
import { Includeable, Op, QueryTypes, WhereOptions } from 'sequelize';
import { FindOptions, Order } from 'sequelize/types/model';
import { getPublishedCVQuery } from '../cvs/cvs.utils';
import { BusinessLine } from 'src/common/business-lines/models';
import { Department } from 'src/common/locations/locations.types';
import { CV } from 'src/cvs/models';
import { MailsService } from 'src/mails/mails.service';
import { Organization } from 'src/organizations/models';
import { QueuesService } from 'src/queues/producers/queues.service';
import { Jobs } from 'src/queues/queues.types';
import { getFiltersObjectsFromQueryParams } from 'src/utils/misc';
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
  CandidateUserRoles,
  CoachUserRoles,
  CVStatuses,
  MemberConstantType,
  MemberFilterKey,
  MemberFilters,
  UserRole,
  UserRoles,
} from './users.types';

import {
  getCommonMembersFilterOptions,
  getMemberOptions,
  lastCVVersionWhereOptions,
  userSearchQuery,
} from './users.utils';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User)
    private userModel: typeof User,
    private queuesService: QueuesService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private mailsService: MailsService
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
      attributes: [...UserAttributes, 'salt', 'password'],
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
      order: Order;
      role: typeof CandidateUserRoles;
    } & FilterParams<MemberFilterKey>
  ): Promise<User[]> {
    const { options, filterOptions } = getCommonMembersFilterOptions(params);

    const userCandidatOptions: FindOptions<UserCandidat> = {};

    if (filterOptions.associatedUser) {
      userCandidatOptions.where = {
        candidat: filterOptions.associatedUser.candidate,
      };
    }

    if (filterOptions.hidden || filterOptions.employed) {
      if (filterOptions.hidden) {
        userCandidatOptions.where = {
          ...userCandidatOptions.where,
          hidden: filterOptions.hidden,
        };
      }
      if (filterOptions.employed) {
        userCandidatOptions.where = {
          ...userCandidatOptions.where,
          employed: filterOptions.employed,
        };
      }
    }

    return this.userModel.findAll({
      ...options,
      include: [
        {
          model: UserCandidat,
          as: 'candidat',
          attributes: ['coachId', 'candidatId', ...UserCandidatAttributes],
          ...userCandidatOptions,
          include: [
            {
              model: CV,
              as: 'cvs',
              attributes: ['version', 'status', 'urlImg'],
              required:
                !!filterOptions.cvStatus || !!filterOptions.businessLines,
              where: {
                ...lastCVVersionWhereOptions,
                ...(filterOptions.cvStatus
                  ? { status: filterOptions.cvStatus }
                  : {}),
              },
              include: [
                {
                  model: BusinessLine,
                  as: 'businessLines',
                  attributes: ['name', 'order'],
                  required: !!filterOptions.businessLines,
                  where: filterOptions.businessLines
                    ? {
                        name: filterOptions.businessLines,
                      }
                    : {},
                },
              ],
            },
            {
              model: User,
              as: 'coach',
              attributes: [...UserAttributes],
              include: [
                {
                  model: Organization,
                  as: 'organization',
                  attributes: ['name', 'address', 'zone', 'id'],
                },
              ],
            },
          ],
        },
        {
          model: Organization,
          as: 'organization',
          attributes: ['name', 'address', 'zone', 'id'],
        },
      ],
    });
  }

  async findAllCoachMembers(
    params: {
      limit: number;
      offset: number;
      search: string;
      order: Order;
      role: typeof CoachUserRoles;
    } & FilterParams<MemberFilterKey>
  ): Promise<User[]> {
    const { options, filterOptions } = getCommonMembersFilterOptions(params);

    const userCandidatOptions: FindOptions<UserCandidat> = {};

    if (filterOptions.associatedUser) {
      userCandidatOptions.where = {
        coach: filterOptions.associatedUser.coach,
      };
    }

    return this.userModel.findAll({
      ...options,
      include: [
        {
          model: UserCandidat,
          as: 'coaches',
          ...userCandidatOptions,
          required: !_.isEmpty(filterOptions.associatedUser),
          attributes: ['coachId', 'candidatId', ...UserCandidatAttributes],
          include: [
            {
              model: User,
              as: 'candidat',
              attributes: [...UserAttributes],
              include: [
                {
                  model: Organization,
                  as: 'organization',
                  attributes: ['name', 'address', 'zone', 'id'],
                },
              ],
            },
          ],
        },
        {
          model: Organization,
          as: 'organization',
          attributes: ['name', 'address', 'zone', 'id'],
        },
      ],
    });
  }

  async findAllUsers(
    search: string,
    role: UserRole | UserRole[],
    organizationId: string
  ) {
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
        role: CandidateUserRoles,
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
        role: UserRoles.CANDIDATE_EXTERNAL,
      },
    });

    const { count: coachesCount } = await this.userModel.findAndCountAll({
      where: {
        OrganizationId: organizationId,
        role: UserRoles.COACH_EXTERNAL,
      },
    });

    return {
      candidatesCount,
      coachesCount,
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
            ? parseFloat(process.env.CV_20_REMINDER_DELAY)
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
}
