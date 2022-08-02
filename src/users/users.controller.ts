import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Order } from 'sequelize/types/model';
import validator from 'validator';
import { UserPayload } from 'src/auth';
// TODO Fix
// eslint-disable-next-line no-restricted-imports
import { Public } from 'src/auth/guards/public.decorator';
import { AdminZone, FilterParams } from 'src/utils/types';
import { Roles, RolesGuard, Self, SelfGuard } from './guards';
import { MemberFilterKey, User, UserRole, UserRoles } from './models';

import { UserCandidatsService } from './user-candidats.service';
import { UsersService } from './users.service';

// TODO change to /users
@Controller('user')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly userCandidatsService: UserCandidatsService
  ) {}

  @Roles(UserRoles.ADMIN)
  @UseGuards(RolesGuard)
  @Get('members')
  async findMembers(
    @Query()
    query: {
      limit: number;
      offset: number;
      query: string;
      role: UserRole | 'All';
    } & FilterParams<MemberFilterKey>
  ) {
    const order = [['firstName', 'ASC']] as Order;
    const { limit, offset, role, query: search, ...restParams } = query;
    return this.usersService.findAllMembers({
      limit,
      order,
      offset,
      search,
      role,
      ...restParams,
    });
  }

  @Roles(UserRoles.ADMIN)
  @UseGuards(RolesGuard)
  @Get('members/count')
  async countSubmittedCVMembers(@UserPayload('zone') zone: AdminZone) {
    return this.usersService.countSubmittedCVMembers(zone);
  }

  @Public()
  @Get('search/candidates')
  async searchCandidates(@Query('query') search: string) {
    return this.usersService.findAllCandidates(search);
  }

  @Roles(UserRoles.ADMIN)
  @UseGuards(RolesGuard)
  @Get('search')
  async searchUsers(
    @Query('query') search: string,
    @Query('role') role: UserRole
  ) {
    return this.usersService.findAllUsers(search, role);
  }

  //TODO use more explicit route name
  @Roles(UserRoles.ADMIN, UserRoles.COACH, UserRoles.CANDIDAT)
  @UseGuards(RolesGuard)
  @Self('query.candidatId', 'query.coachId')
  @UseGuards(SelfGuard)
  @Get('candidat')
  async findRelatedUser(
    @Query('candidatId') candidateId?: string,
    @Query('coachId') coachId?: string
  ) {
    return this.userCandidatsService.findOneByCandidateOrCoachId(
      candidateId,
      coachId
    );
  }

  @Roles(UserRoles.ADMIN, UserRoles.COACH, UserRoles.CANDIDAT)
  @UseGuards(RolesGuard)
  @Self('params.id')
  @UseGuards(SelfGuard)
  @Get(':id')
  async findUser(@Param('id') userId: string) {
    let user: User;
    if (validator.isEmail(userId)) {
      user = await this.usersService.findOneByMail(userId);
    } else {
      user = await this.usersService.findOne(userId);
    }

    if (!user) {
      throw new NotFoundException();
    }

    return user;
  }
}
