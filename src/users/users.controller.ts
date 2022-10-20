import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Put,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { passwordStrength } from 'check-password-strength';
import { Order } from 'sequelize/types/model';
import { validate as uuidValidate } from 'uuid';
import validator from 'validator';

import { encryptPassword, validatePassword } from 'src/auth/auth.utils';
import { Public, UserPayload } from 'src/auth/guards';
import { isValidPhone } from 'src/utils/misc';
import { AdminZone, FilterParams } from 'src/utils/types';
import {
  UpdateUserCandidatDto,
  UpdateUserRestrictedDto,
  UpdateUserRestrictedPipe,
} from './dto';
import {
  LinkedUser,
  LinkedUserGuard,
  Roles,
  RolesGuard,
  Self,
  SelfGuard,
} from './guards';
import { User } from './models';

import { UserCandidatsService } from './user-candidats.service';
import { UsersService } from './users.service';
import { MemberFilterKey, UserRole, UserRoles } from './users.types';

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
    @Query('limit', new ParseIntPipe())
    limit: number,
    @Query('offset', new ParseIntPipe())
    offset: number,
    @Query()
    query: {
      query: string;
      role: UserRole | 'All';
    } & FilterParams<MemberFilterKey>
  ) {
    const order = [['firstName', 'ASC']] as Order;
    const { role, query: search, ...restParams } = query;
    return this.usersService.findAllMembers({
      ...restParams,
      limit,
      order,
      offset,
      search,
      role,
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
  async findCandidates(@Query('query') search: string) {
    return this.usersService.findAllCandidates(search);
  }

  // TODO divide service
  @Roles(UserRoles.ADMIN)
  @UseGuards(RolesGuard)
  @Get('search')
  async findUsers(
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

  // TODO change to changePwd
  @Put('change-pwd')
  async updatePassword(
    @UserPayload('email') email: string,
    @Body('oldPassword') oldPassword: string,
    @Body('newPassword') newPassword: string
  ) {
    const user = await this.usersService.findOneByMail(email);
    if (!user) {
      throw new UnauthorizedException();
    }

    const { salt: oldSalt, password } = user;

    const validated = validatePassword(oldPassword, password, oldSalt);

    if (!validated) {
      throw new UnauthorizedException();
    }

    if (passwordStrength(newPassword).id < 2) {
      throw new BadRequestException();
    }

    const { hash, salt } = encryptPassword(newPassword);
    const updatedUser = await this.usersService.update(user.id, {
      password: hash,
      salt,
    });

    if (!updatedUser) {
      throw new NotFoundException();
    }

    return updatedUser;
  }

  @LinkedUser('params.candidateId')
  @UseGuards(LinkedUserGuard)
  @Put('candidat/:candidateId')
  async updateUserCandidat(
    @UserPayload('id', new ParseUUIDPipe()) userId: string,
    @Param('candidateId', new ParseUUIDPipe()) candidateId: string,
    @Body() updateUserCandidatDto: UpdateUserCandidatDto
  ) {
    const userCandidat = await this.userCandidatsService.findOneByCandidateId(
      candidateId
    );

    if (!userCandidat) {
      throw new NotFoundException();
    }

    const updatedUserCandidat =
      await this.userCandidatsService.updateByCandidateId(candidateId, {
        ...updateUserCandidatDto,
        lastModifiedBy: userId,
      });

    if (updatedUserCandidat.coachId !== userCandidat.coachId) {
      await this.usersService.sendMailsAfterMatching(
        updatedUserCandidat.candidatId
      );
    }

    if (updatedUserCandidat.hidden) {
      await this.usersService.uncacheCandidateCV(updatedUserCandidat.url);
    } else {
      await this.usersService.cacheCandidateCV(updatedUserCandidat.candidatId);
    }

    await this.usersService.cacheAllCVs();

    return updatedUserCandidat;
  }

  @LinkedUser('params.candidateId')
  @UseGuards(LinkedUserGuard)
  @Roles(UserRoles.CANDIDAT, UserRoles.COACH)
  @UseGuards(RolesGuard)
  @Put('candidat/read/:candidateId')
  async setNoteHasBeenRead(
    @Param('candidateId', new ParseUUIDPipe()) candidateId: string,
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

  @Self('params.id')
  @UseGuards(SelfGuard)
  @Put(':id')
  async updateUser(
    @UserPayload('role') role: UserRole,
    @Param('id', new ParseUUIDPipe()) userId: string,
    // Do not instantiante ContactUsFormPipe so that Request can be injected
    @Body(UpdateUserRestrictedPipe) updateUserDto: UpdateUserRestrictedDto
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
}
