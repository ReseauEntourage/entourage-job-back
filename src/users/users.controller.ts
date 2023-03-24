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
import _ from 'lodash';
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
import { UpdateUserCandidatPipe } from './dto/update-user-candidat.pipe';
import {
  LinkedUser,
  LinkedUserGuard,
  Roles,
  Self,
  SelfGuard,
  UserPermissionsGuard,
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
  @UseGuards(UserPermissionsGuard)
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
  @UseGuards(UserPermissionsGuard)
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
  @UseGuards(UserPermissionsGuard)
  @Get('search')
  async findUsers(
    @Query('query') search: string,
    @Query('role') role: UserRole
  ) {
    return this.usersService.findAllUsers(search, role);
  }

  @Roles(UserRoles.CANDIDATE, UserRoles.COACH)
  @UseGuards(UserPermissionsGuard)
  @Get('candidate')
  async findRelatedUser(
    @UserPayload('id') userId: string,
    @UserPayload('role') role: UserRole
  ) {
    const ids = {
      candidateId: role === UserRoles.CANDIDATE ? userId : undefined,
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

  @Roles(UserRoles.CANDIDATE, UserRoles.COACH)
  @UseGuards(UserPermissionsGuard)
  @Get('candidate/checkUpdate')
  async checkNoteHasBeenModified(
    @UserPayload('role') role: UserRole,
    @UserPayload('id', new ParseUUIDPipe()) userId: string
  ) {
    const ids = {
      candidateId: role === UserRoles.CANDIDATE ? userId : undefined,
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

  @Put('changePwd')
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

  @Roles(UserRoles.ADMIN)
  @UseGuards(UserPermissionsGuard)
  @Put('candidate/bulk')
  async updateAll(
    @Body('attributes', UpdateUserRestrictedPipe)
    updateUserCandidatDto: UpdateUserCandidatDto,
    @Body('ids') usersIds: string[]
  ) {
    const { nbUpdated, updatedUserCandidats } =
      await this.userCandidatsService.updateAll(
        usersIds,
        updateUserCandidatDto
      );
    if (updateUserCandidatDto.hidden) {
      for (const candidate of updatedUserCandidats) {
        await this.usersService.uncacheCandidateCV(candidate.url);
      }
    }
    await this.usersService.cacheAllCVs();

    return {
      nbUpdated,
      updatedIds: updatedUserCandidats.map((user) => {
        return user.candidatId;
      }),
    };
  }

  @LinkedUser('params.candidateId')
  @UseGuards(LinkedUserGuard)
  @Put('candidate/:candidateId')
  async updateUserCandidat(
    @UserPayload('id', new ParseUUIDPipe()) userId: string,
    @Param('candidateId', new ParseUUIDPipe()) candidateId: string,
    @Body(new UpdateUserCandidatPipe())
    updateUserCandidatDto: UpdateUserCandidatDto
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

    if (
      updatedUserCandidat.coach &&
      updatedUserCandidat.coach.id !== userCandidat.coach?.id
    ) {
      await this.usersService.sendMailsAfterMatching(
        updatedUserCandidat.candidat.id
      );
    }

    if (updatedUserCandidat.hidden) {
      await this.usersService.uncacheCandidateCV(updatedUserCandidat.url);
    } else {
      await this.usersService.cacheCandidateCV(updatedUserCandidat.candidat.id);
    }

    await this.usersService.cacheAllCVs();

    return updatedUserCandidat;
  }

  @Roles(UserRoles.ADMIN)
  @UseGuards(UserPermissionsGuard)
  @Put('linkedUser/:userId')
  async linkUser(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Body('userToLinkId') userToLinkId: string /* | string[]*/
  ) {
    if (
      Array.isArray(userToLinkId)
        ? !userToLinkId.every((id) => uuidValidate(id))
        : !uuidValidate(userId)
    ) {
      throw new BadRequestException();
    }

    const user = await this.usersService.findOne(userId);

    /*  if (user.role === UserRoles.COACH_EXTERNAL) {
        if (!Array.isArray(userToLinkId)) {
          throw new BadRequestException();
        }
      }
      else  if (Array.isArray(userToCreate.linkedUser)) {
        throw new BadRequestException();
      }*/

    const userToLink = await this.usersService.findOne(userToLinkId);

    if (!user || !userToLink) {
      throw new NotFoundException();
    }

    const normalRoles = [UserRoles.CANDIDATE, UserRoles.COACH];
    const externalRoles = [
      UserRoles.CANDIDATE_EXTERNAL,
      UserRoles.COACH_EXTERNAL,
    ];

    let candidateId;
    let coachId;

    if (
      _.difference([user.role, userToLink.role], normalRoles).length === 0 &&
      user.role !== userToLink.role
    ) {
      candidateId = user.role === UserRoles.CANDIDATE ? user.id : userToLink.id;
      coachId = user.role === UserRoles.COACH ? user.id : userToLink.id;
    } else if (
      _.difference([user.role, userToLink.role], externalRoles).length === 0 &&
      user.role !== userToLink.role
    ) {
      candidateId =
        user.role === UserRoles.CANDIDATE_EXTERNAL ? user.id : userToLink.id;
      coachId =
        user.role === UserRoles.COACH_EXTERNAL ? user.id : userToLink.id;
    } else {
      throw new BadRequestException();
    }

    const userCandidate = await this.userCandidatsService.findOneByCandidateId(
      candidateId
    );

    if (!userCandidate) {
      throw new NotFoundException();
    }

    const updatedUserCandidat =
      await this.userCandidatsService.updateByCandidateId(candidateId, {
        candidatId: candidateId,
        coachId: coachId,
      });

    if (
      updatedUserCandidat.coach &&
      updatedUserCandidat.coach.id !== userCandidate.coach?.id
    ) {
      await this.usersService.sendMailsAfterMatching(
        updatedUserCandidat.candidat.id
      );
    }

    return updatedUserCandidat;
  }

  @LinkedUser('params.candidateId')
  @UseGuards(LinkedUserGuard)
  @Roles(UserRoles.CANDIDATE, UserRoles.COACH)
  @UseGuards(UserPermissionsGuard)
  @Put('candidate/read/:candidateId')
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
    // Do not instantiante UpdateUserRestrictedPipe so that Request can be injected
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
