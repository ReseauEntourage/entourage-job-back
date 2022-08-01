import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { Order } from 'sequelize/types/model';
import { FilterParams, RequestWithUser } from 'src/utils/types';
import { Roles, RolesGuard } from './guards';
import { MemberFilterKey, UserRole, UserRoles } from './models';
import { UsersService } from './users.service';

// TODO change to /users
@Controller('user')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('members')
  @Roles(UserRoles.ADMIN)
  @UseGuards(RolesGuard)
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

  @Get('members/count')
  @Roles(UserRoles.ADMIN)
  @UseGuards(RolesGuard)
  async countSubmittedCVMembers(@Request() req: RequestWithUser) {
    return this.usersService.countSubmittedCVMembers(req.user.zone);
  }
}
