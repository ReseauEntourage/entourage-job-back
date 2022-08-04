import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Order } from 'sequelize/types/model';
import { validate as uuidValidate } from 'uuid';
import validator from 'validator';
// TODO Fix
// eslint-disable-next-line no-restricted-imports
import { Public } from 'src/auth/guards/public.decorator';
// eslint-disable-next-line no-restricted-imports
import { UserPayload } from 'src/auth/guards/user-payload.decorator';
import { isValidPhone } from 'src/utils/misc';
import { AdminZone, FilterParams } from 'src/utils/types';
import {
  UpdateUserCandidatDto,
  UpdateUserRestrictedDto,
  UserRestrictedPipe,
} from './dto';
import {
  LinkedUser,
  LinkedUserGuard,
  Roles,
  RolesGuard,
  Self,
  SelfGuard,
} from './guards';
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

  // TODO divide service
  @Roles(UserRoles.ADMIN)
  @UseGuards(RolesGuard)
  @Get('members/count')
  async countSubmittedCVMembers(@UserPayload('zone') zone: AdminZone) {
    return this.usersService.countSubmittedCVMembers(zone);
  }

  // TODO divide service
  @Public()
  @Get('search/candidates')
  async searchCandidates(@Query('query') search: string) {
    return this.usersService.findAllCandidates(search);
  }

  // TODO divide service
  @Roles(UserRoles.ADMIN)
  @UseGuards(RolesGuard)
  @Get('search')
  async searchUsers(
    @Query('query') search: string,
    @Query('role') role: UserRole
  ) {
    return this.usersService.findAllUsers(search, role);
  }

  // TODO use more explicit route name
  @Self('query.candidatId', 'query.coachId')
  @UseGuards(SelfGuard)
  @Get('candidat')
  async findRelatedUser(
    @Query('candidatId') candidateId?: string,
    @Query('coachId') coachId?: string
  ) {
    if (!uuidValidate(candidateId) && !uuidValidate(coachId)) {
      throw new BadRequestException();
    }

    const userCandidat =
      await this.userCandidatsService.findOneByCandidateOrCoachId(
        candidateId,
        coachId
      );

    if (!userCandidat) {
      throw new NotFoundException();
    }

    return userCandidat;
  }

  @Self('params.id')
  @UseGuards(SelfGuard)
  @Get(':id')
  async findUser(@Param('id') userId: string) {
    let user: User;
    if (validator.isEmail(userId)) {
      user = await this.usersService.findOneByMail(userId);
    } else if (uuidValidate(userId)) {
      user = await this.usersService.findOne(userId);
    } else {
      throw new BadRequestException();
    }

    if (!user) {
      throw new NotFoundException();
    }

    return user;
  }

  @LinkedUser('params.id')
  @UseGuards(LinkedUserGuard)
  @Put('candidat/:id')
  async updateUserCandidat(
    @UserPayload('id', new ParseUUIDPipe()) userId: string,
    @Param('id', new ParseUUIDPipe()) candidateId: string,
    @Body() updateUserCandidatDto: UpdateUserCandidatDto
  ) {
    const prevUserCandidat =
      await this.userCandidatsService.findOneByCandidateId(candidateId);

    if (!prevUserCandidat) {
      throw new NotFoundException();
    }

    const updatedUserCandidat =
      await this.userCandidatsService.updateByCandidateId(candidateId, {
        ...updateUserCandidatDto,
        lastModifiedBy: userId,
      });

    if (!updatedUserCandidat) {
      throw new NotFoundException();
    }

    if (updatedUserCandidat.coachId !== prevUserCandidat.coachId) {
      await this.usersService.sendMailsAfterMatching(
        updatedUserCandidat.candidatId
      );
    }

    if (updatedUserCandidat.hidden) {
      await this.usersService.uncacheUserCV(updatedUserCandidat.url);
    } else {
      await this.usersService.cacheUserCV(updatedUserCandidat.candidatId);
    }

    await this.usersService.cacheAllCVs();

    return updatedUserCandidat;
  }

  @Self('params.id')
  @UseGuards(SelfGuard)
  @Put(':id')
  async updateUser(
    @UserPayload('role') role: UserRole,
    @Param('id', new ParseUUIDPipe()) userId: string,
    // Do not instantiante UserRestrictedPipe so that Request can be injected
    @Body(UserRestrictedPipe) updateUserDto: UpdateUserRestrictedDto
  ) {
    if (updateUserDto.phone && !isValidPhone(updateUserDto.phone)) {
      throw new BadRequestException();
    }

    const updatedUser = await this.usersService.update(userId, updateUserDto);

    if (!updatedUser) {
      throw new NotFoundException();
    }

    return updatedUser;
  }

  @Roles(UserRoles.CANDIDAT, UserRoles.COACH)
  @UseGuards(RolesGuard)
  @Get('candidat/checkUpdate')
  async checkNoteHasBeenModified(
    @UserPayload('role') role: UserRole,
    @UserPayload('id', new ParseUUIDPipe()) userId: string
  ) {
    const ids = {
      candidateId: role === UserRoles.CANDIDAT ? userId : undefined,
      coachId: role === UserRoles.COACH ? userId : undefined,
    };

    const userCandidat =
      await this.userCandidatsService.findOneByCandidateOrCoachId(
        ids.candidateId,
        ids.coachId
      );

    if (!userCandidat) {
      throw new NotFoundException();
    }

    const { lastModifiedBy } = userCandidat.toJSON();

    return {
      noteHasBeenModified: !!lastModifiedBy && lastModifiedBy !== userId,
    };
  }

  @LinkedUser('params.id')
  @Roles(UserRoles.CANDIDAT, UserRoles.COACH)
  @UseGuards(RolesGuard)
  @Put('candidat/read/:id')
  async setNoteHasBeenRead(
    @Param('id', new ParseUUIDPipe()) candidateId: string,
    @UserPayload('id', new ParseUUIDPipe()) userId: string
  ) {
    const userCandidat = await this.userCandidatsService.findOneByCandidateId(
      candidateId
    );

    if (!userCandidat) {
      throw new NotFoundException();
    }

    const { lastModifiedBy } = userCandidat.toJSON();

    const updatedUserCandidat =
      await this.userCandidatsService.updateByCandidateId(candidateId, {
        lastModifiedBy: lastModifiedBy !== userId ? null : lastModifiedBy,
      });

    if (!updatedUserCandidat) {
      throw new NotFoundException();
    }

    return updatedUserCandidat;
  }
}
