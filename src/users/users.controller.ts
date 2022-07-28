import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { MailsService } from '../mails';
import { Roles } from './guards/roles.decorator';
import { RolesGuard } from './guards/roles.guard';
import { MemberFilterParams, UserRole, UserRoles } from './models/user.model';
import { UserCandidatsService } from './user-candidats.service';
import { UsersService } from './users.service';

// TODO change to /users
@Controller('user')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly userCandidatsService: UserCandidatsService
  ) {}

  @Get('members')
  @Roles(UserRoles.ADMIN)
  @UseGuards(RolesGuard)
  async findMembers(
    @Param()
    params: {
      limit: number;
      offset: number;
      query: string;
      role: UserRole | 'All';
    } & MemberFilterParams
  ) {
    const order = [['firstName', 'ASC']];
    const { limit, offset, role, query: search, ...restParams } = params;
    await this.usersService.findAllMembers({
      limit,
      order,
      offset,
      search,
      role,
      ...restParams,
    });
  }
}
