import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, WhereOptions } from 'sequelize';
import { FindOptions, Order } from 'sequelize/types/model';
import { BusinessLine } from '../businessLines';
import { getFiltersObjectsFromQueryParams } from '../utils/misc';
import { AdminZone, FilterParams } from '../utils/types';
import { CV, CVStatuses } from 'src/cvs';
import { UpdateUserDto } from './dto';
import {
  UserAttributes,
  User,
  UserRole,
  UserRoles,
  UserCandidat,
  UserCandidatAttributes,
  MemberFilters,
  MemberFilterKey,
} from './models';
import { UserCandidatInclude } from './models/user.include';

import {
  filterMembersByAssociatedUser,
  filterMembersByBusinessLines,
  filterMembersByCVStatus,
  getMemberOptions,
  userSearchQuery,
} from './models/user.utils';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User)
    private userModel: typeof User
  ) {}

  async create(createUserDto: Partial<User>) {
    return this.userModel.create(createUserDto, { hooks: true });
  }

  async findAllMembers(
    params: {
      limit: number;
      offset: number;
      search: string;
      order: Order;
      role: UserRole | 'All';
    } & FilterParams<MemberFilterKey>
  ) {
    const { limit, offset, role, search, order, ...restParams } = params;

    const filtersObj = getFiltersObjectsFromQueryParams<MemberFilterKey>(
      restParams,
      MemberFilters
    );

    const { businessLines, cvStatus, associatedUser, ...restFilters } =
      filtersObj;

    // The associatedUser options don't work that's why we take it out of the filters
    const filterOptions = getMemberOptions(restFilters);

    const options: FindOptions = {
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
        const sortedCvs = user.candidat.cvs.sort((cv1: CV, cv2: CV) => {
          return cv2.version - cv1.version;
        });
        return {
          ...user,
          candidat: {
            ...user.candidat,
            cvs: [sortedCvs[0]],
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

  async countSubmittedCVMembers(zone: AdminZone) {
    const whereOptions: WhereOptions<CV> = zone
      ? ({ zone } as WhereOptions<CV>)
      : {};

    const options: FindOptions = {
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
        const sortedCvs = user.candidat.cvs.sort((cv1: CV, cv2: CV) => {
          return cv2.version - cv1.version;
        });
        return {
          ...user,
          candidat: {
            ...user.candidat,
            cvs: [sortedCvs[0]],
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

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const [updateCount] = await this.userModel.update(updateUserDto, {
      where: { id },
      individualHooks: true,
    });

    if (updateCount === 0) {
      return null;
    }

    const updatedUser = await this.findOne(id);

    return updatedUser.toJSON();
  }
}
