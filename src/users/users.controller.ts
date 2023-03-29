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

import { assertCondition } from '../utils/misc/asserts';
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
  UserPermissions,
  Self,
  SelfGuard,
  UserPermissionsGuard,
} from './guards';
import { User, UserCandidat } from './models';

import { UserCandidatsService } from './user-candidats.service';
import { UsersService } from './users.service';
import {
  CandidateUserRoles,
  CoachUserRoles,
  MemberFilterKey,
  UserRole,
  UserRoles,
  Permissions,
  ExternalUserRoles,
} from './users.types';
import {
  areRolesIncluded,
  getCandidateAndCoachIdDependingOnRoles,
} from './users.utils';

// TODO change to /users
@Controller('user')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly userCandidatsService: UserCandidatsService
  ) {}

  @UserPermissions(Permissions.ADMIN)
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
  @UserPermissions(Permissions.ADMIN)
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
  @UserPermissions(Permissions.ADMIN)
  @UseGuards(UserPermissionsGuard)
  @Get('search')
  async findUsers(
    @Query('query') search: string,
    @Query('role') role: UserRole,
    @Query('organizationId') organizationId?: string
  ) {
    if (organizationId && !uuidValidate(organizationId)) {
      throw new BadRequestException();
    }

    if (areRolesIncluded(ExternalUserRoles, [role]) && !organizationId) {
      throw new BadRequestException();
    }
    return this.usersService.findAllUsers(search, role, organizationId);
  }

  @UserPermissions(Permissions.CANDIDATE, Permissions.COACH)
  @UseGuards(UserPermissionsGuard)
  @Get('candidate')
  async findRelatedUser(
    @UserPayload('id') userId: string,
    @UserPayload('role') role: UserRole
  ) {
    const ids = {
      candidateId: areRolesIncluded(CandidateUserRoles, [role])
        ? userId
        : undefined,
      coachId: areRolesIncluded(CoachUserRoles, [role]) ? userId : undefined,
    };

    if (role === UserRoles.COACH_EXTERNAL) {
      const userCandidates = await this.userCandidatsService.findAllByCoachId(
        ids.coachId
      );

      if (!userCandidates || userCandidates.length === 0) {
        throw new NotFoundException();
      }

      return userCandidates.map((userCandidate) => {
        return userCandidate.toJSON() as UserCandidat;
      });
    }

    const userCandidate =
      await this.userCandidatsService.findOneByCandidateOrCoachId(
        ids.candidateId,
        ids.coachId
      );

    if (!userCandidate) {
      throw new NotFoundException();
    }

    return userCandidate;
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

  @UserPermissions(Permissions.CANDIDATE, Permissions.COACH)
  @UseGuards(UserPermissionsGuard)
  @Get('candidate/checkUpdate')
  async checkNoteHasBeenModified(
    @UserPayload('role') role: UserRole,
    @UserPayload('id', new ParseUUIDPipe()) userId: string
  ) {
    const ids = {
      candidateId: areRolesIncluded(CandidateUserRoles, [role])
        ? userId
        : undefined,
      coachId: areRolesIncluded(CoachUserRoles, [role]) ? userId : undefined,
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

  @UserPermissions(Permissions.ADMIN)
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

  @UserPermissions(Permissions.ADMIN)
  @UseGuards(UserPermissionsGuard)
  @Put('linkedUser/:userId')
  async linkUser(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Body('userToLinkId') userToLinkId: string | string[]
  ) {
    if (
      Array.isArray(userToLinkId)
        ? !userToLinkId.every((id) => uuidValidate(id))
        : !uuidValidate(userId)
    ) {
      throw new BadRequestException();
    }

    const user = await this.usersService.findOne(userId);

    if (!user) {
      throw new NotFoundException();
    }

    if (
      (user.role !== UserRoles.COACH_EXTERNAL && Array.isArray(userToLinkId)) ||
      (user.role === UserRoles.COACH_EXTERNAL && !Array.isArray(userToLinkId))
    ) {
      throw new BadRequestException();
    }

    const usersToLinkIds = Array.isArray(userToLinkId)
      ? userToLinkId
      : [userToLinkId];

    const userCandidatesToUpdate = await Promise.all(
      usersToLinkIds.map(async (userToLinkId) => {
        const userToLink = await this.usersService.findOne(userToLinkId);

        if (!userToLink) {
          throw new NotFoundException();
        }

        const { candidateId, coachId } = getCandidateAndCoachIdDependingOnRoles(
          user,
          userToLink
        );

        const userCandidate =
          await this.userCandidatsService.findOneByCandidateId(candidateId);

        if (!userCandidate) {
          throw new NotFoundException();
        }

        return { candidateId: candidateId, coachId: coachId };
      })
    );

    const updatedUserCandidates =
      await this.userCandidatsService.updateAllLinkedUserByCandidateId(
        userCandidatesToUpdate
      );

    if (!updatedUserCandidates) {
      throw new NotFoundException();
    }

    const finalUpdatedUserCandidates = await Promise.all(
      updatedUserCandidates.map(async (updatedUserCandidate) => {
        const previousCoach = updatedUserCandidate.previous('coach');
        if (
          updatedUserCandidate.coach &&
          updatedUserCandidate.coach.id !== previousCoach?.id
        ) {
          await this.usersService.sendMailsAfterMatching(
            updatedUserCandidate.candidat.id
          );
        }
        return updatedUserCandidate.toJSON() as UserCandidat;
      })
    );

    if (user.role !== UserRoles.COACH_EXTERNAL) {
      assertCondition(finalUpdatedUserCandidates.length === 1);
      return finalUpdatedUserCandidates[0];
    }
    return finalUpdatedUserCandidates;
  }

  @LinkedUser('params.candidateId')
  @UseGuards(LinkedUserGuard)
  @UserPermissions(Permissions.CANDIDATE, Permissions.COACH)
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
