import { InjectQueue } from '@nestjs/bull';
import { CACHE_MANAGER, Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Queue } from 'bull';
import { Cache } from 'cache-manager';
import { Op, QueryTypes, WhereOptions } from 'sequelize';
import { FindOptions, Order } from 'sequelize/types/model';
import { getPublishedCVQuery } from '../cvs/cvs.utils';
import { BusinessLine } from 'src/businessLines/models';
import { CV } from 'src/cvs/models';
import { MailsService } from 'src/mails/mails.service';
import { Jobs, Queues } from 'src/queues/queues.types';
import { getFiltersObjectsFromQueryParams } from 'src/utils/misc';
import { AdminZone, FilterParams, RedisKeys } from 'src/utils/types';
import { UpdateUserDto } from './dto';
import {
  UserAttributes,
  User,
  UserCandidat,
  UserCandidatAttributes,
  PublicUserAttributes,
} from './models';
import { UserCandidatInclude } from './models/user.include';
import {
  CVStatuses,
  UserRole,
  UserRoles,
  MemberFilters,
  MemberFilterKey,
  MemberConstantType,
} from './users.types';

import {
  filterMembersByAssociatedUser,
  filterMembersByBusinessLines,
  filterMembersByCVStatus,
  getMemberOptions,
  userSearchQuery,
} from './users.utils';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User)
    private userModel: typeof User,
    @InjectQueue(Queues.WORK)
    private workQueue: Queue,
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

  async findAllMembers(
    params: {
      limit: number;
      offset: number;
      search: string;
      order: Order;
      role: UserRole | 'All';
    } & FilterParams<MemberFilterKey>
  ): Promise<User[]> {
    const { limit, offset, role, search, order, ...restParams } = params;

    const filtersObj = getFiltersObjectsFromQueryParams<
      MemberFilterKey,
      MemberConstantType
    >(restParams, MemberFilters);

    const { businessLines, cvStatus, associatedUser, ...restFilters } =
      filtersObj;

    // The associatedUser options don't work that's why we take it out of the filters
    const filterOptions = getMemberOptions(restFilters);

    const options: FindOptions<User> = {
      order,
      where: {
        role: { [Op.not]: UserRoles.ADMIN },
      },
      attributes: [...UserAttributes],
      include: UserCandidatInclude,
    };

    const hasFilterOptions = Object.keys(filtersObj).length > 0;

    if (!hasFilterOptions) {
      options.offset = offset;
      options.limit = limit;
    }
    // recherche de l'utilisateur
    if (search) {
      options.where = {
        ...options.where,
        [Op.or]: userSearchQuery(search),
      };
    }
    if (filterOptions.zone) {
      options.where = {
        ...options.where,
        zone: filterOptions.zone,
      };
    }

    // filtre par role
    if (role === UserRoles.CANDIDAT || role === UserRoles.COACH) {
      options.where = {
        ...options.where,
        role,
      };
    }

    const userCandidatOptions: FindOptions<UserCandidat> = {};
    if (
      (role === UserRoles.CANDIDAT || role === 'All') &&
      (filterOptions.hidden || filterOptions.employed)
    ) {
      userCandidatOptions.where = {};
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

    // TODO filter associated users in query
    /*
      if (filterOptions.associatedUser) {
        userCandidatOptions.where = {
          ...(userCandidatOptions.where || {}),
          ...filterOptions.associatedUser.candidat,
        };
      }
    */

    // recuperer la derniere version de cv
    options.include = [
      {
        model: UserCandidat,
        as: 'candidat',
        attributes: ['coachId', ...UserCandidatAttributes],
        ...userCandidatOptions,
        include: [
          {
            model: CV,
            as: 'cvs',
            attributes: ['version', 'status', 'urlImg'],
            include: [
              {
                model: BusinessLine,
                as: 'businessLines',
                attributes: ['name', 'order'],
                through: { attributes: [] },
              },
            ],
          },
          {
            model: User,
            as: 'coach',
            attributes: [...UserAttributes],
          },
        ],
        order: [['cvs.version', 'DESC']],
      },
      {
        model: UserCandidat,
        as: 'coach',
        attributes: ['candidatId', ...UserCandidatAttributes],
        include: [
          {
            model: User,
            as: 'candidat',
            attributes: [...UserAttributes],
          },
        ],
      },
    ];

    const members = await this.userModel.findAll(options);

    const filteredMembersByAssociatedUser = filterMembersByAssociatedUser(
      members,
      associatedUser
    );

    const membersWithLastCV = filteredMembersByAssociatedUser.map((member) => {
      const user = member.toJSON();
      if (user.candidat && user.candidat.cvs && user.candidat.cvs.length > 0) {
        const sortedCVs = user.candidat.cvs.sort((cv1: CV, cv2: CV) => {
          return cv2.version - cv1.version;
        });
        return {
          ...user,
          candidat: {
            ...user.candidat,
            cvs: [sortedCVs[0]],
          },
        };
      }
      return user;
    });

    let finalFilteredMembers = membersWithLastCV;

    if (role === UserRoles.CANDIDAT || role === 'All') {
      const filteredMembersByCVStatus = filterMembersByCVStatus(
        membersWithLastCV,
        cvStatus
      );
      finalFilteredMembers = filterMembersByBusinessLines(
        filteredMembersByCVStatus,
        businessLines
      );
    }

    if (hasFilterOptions && (offset || limit)) {
      if (offset && limit) {
        return finalFilteredMembers.slice(offset, limit + limit);
      }
      if (offset) {
        return finalFilteredMembers.slice(offset);
      }
      if (limit) {
        return finalFilteredMembers.slice(0, limit);
      }
    }
    return finalFilteredMembers;
  }

  async findAllUsers(search: string, role: UserRole) {
    const options: FindOptions<User> = {
      attributes: [...UserAttributes],
      where: {
        [Op.or]: userSearchQuery(search),
      },
    };
    if (role) {
      options.where = { ...options.where, role };
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
    return User.findAll(options);
  }

  async countSubmittedCVMembers(zone: AdminZone) {
    const whereOptions: WhereOptions<CV> = zone
      ? ({ zone } as WhereOptions<CV>)
      : {};

    const options: FindOptions<User> = {
      where: {
        ...whereOptions,
        role: UserRoles.CANDIDAT,
      },
      attributes: [...UserAttributes],
      include: UserCandidatInclude,
    };

    // recuperer la derniere version de cv
    options.include = [
      {
        model: UserCandidat,
        as: 'candidat',
        attributes: ['coachId', ...UserCandidatAttributes],
        include: [
          {
            model: CV,
            as: 'cvs',
            attributes: ['version', 'status', 'urlImg'],
          },
          {
            model: User,
            as: 'coach',
            attributes: [...UserAttributes],
          },
        ],
        order: [['cvs.version', 'DESC']],
      },
    ];

    const members = await this.userModel.findAll(options);

    const membersWithLastCV = members.map((member) => {
      const user = member.toJSON();
      if (user.candidat && user.candidat.cvs && user.candidat.cvs.length > 0) {
        const sortedCVs = user.candidat.cvs.sort((cv1: CV, cv2: CV) => {
          return cv2.version - cv1.version;
        });
        return {
          ...user,
          candidat: {
            ...user.candidat,
            cvs: [sortedCVs[0]],
          },
        };
      }
      return user;
    });

    return {
      pendingCVs: filterMembersByCVStatus(membersWithLastCV, [
        CVStatuses.Pending,
      ]).length,
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

    await this.workQueue.add(
      Jobs.REMINDER_CV_10,
      {
        candidatId: candidateId,
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
    await this.workQueue.add(
      Jobs.REMINDER_CV_20,
      {
        candidatId: candidateId,
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
    await this.workQueue.add(Jobs.CACHE_CV, {
      candidatId: candidateId,
    });
  }

  // TODO fix duplicate
  async cacheAllCVs() {
    await this.workQueue.add(Jobs.CACHE_ALL_CVS);
  }
}
