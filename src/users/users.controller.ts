import {
  BadRequestException,
  Body,
  ConflictException,
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
import { ApiBearerAuth } from '@nestjs/swagger';
import { passwordStrength } from 'check-password-strength';
import { validate as uuidValidate } from 'uuid';
import validator from 'validator';
import { encryptPassword, validatePassword } from 'src/auth/auth.utils';
import { Public, UserPayload } from 'src/auth/guards';
import {
  UpdateUserDto,
  UpdateUserCandidatDto,
  UpdateUserRestrictedDto,
  UpdateUserRestrictedPipe,
} from 'src/users/dto';
import { isValidPhone } from 'src/utils/misc';
import { AdminZone, FilterParams } from 'src/utils/types';
import { UpdateUserCandidatPipe } from './dto/update-user-candidat.pipe';
import {
  LinkedUser,
  LinkedUserGuard,
  Self,
  SelfGuard,
  UserPermissions,
  UserPermissionsGuard,
} from './guards';
import { AdminOverride } from './guards/admin-override.decorator';
import { User, UserCandidat } from './models';

import { UserCandidatsService } from './user-candidats.service';
import { UsersService } from './users.service';
import {
  CandidateUserRoles,
  CoachUserRoles,
  MemberFilterKey,
  Permissions,
  SequelizeUniqueConstraintError,
  UserRole,
  UserRoles,
} from './users.types';
import {
  getCandidateAndCoachIdDependingOnRoles,
  getRelatedUser,
  isRoleIncluded,
} from './users.utils';

// TODO change to /users
@ApiBearerAuth()
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
    @Query('query')
    search: string,
    @Query('role')
    role: UserRole[],
    @Query()
    query: FilterParams<MemberFilterKey>
  ) {
    if (!role) {
      throw new BadRequestException();
    }

    if (isRoleIncluded(CandidateUserRoles, role)) {
      return this.usersService.findAllCandidateMembers({
        ...query,
        role: role as typeof CandidateUserRoles,
        limit,
        offset,
        search,
      });
    }

    if (isRoleIncluded(CoachUserRoles, role)) {
      return this.usersService.findAllCoachMembers({
        ...query,
        role: role as typeof CoachUserRoles,
        limit,
        offset,
        search,
      });
    }

    throw new BadRequestException();
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
    @Query('role') role: UserRole[],
    @Query('organizationId') organizationId?: string
  ) {
    if (organizationId && !uuidValidate(organizationId)) {
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
      candidateId: isRoleIncluded(CandidateUserRoles, role)
        ? userId
        : undefined,
      coachId: isRoleIncluded(CoachUserRoles, role) ? userId : undefined,
    };

    if (role === UserRoles.REFERRER) {
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

  @AdminOverride()
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
  @Get('candidate/checkUpdate/:candidateId')
  async checkNoteHasBeenModified(
    @UserPayload('role') role: UserRole,
    @UserPayload('id', new ParseUUIDPipe()) userId: string,
    @Param('candidateId', new ParseUUIDPipe()) candidateId: string
  ) {
    const userCandidat = await this.userCandidatsService.findOneByCandidateId(
      candidateId
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

    const { salt: oldSalt, password } = await this.usersService.findOneComplete(
      user.id
    );

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

  // for admin to modify multiple users at the same time
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

    if (updatedUserCandidat.hidden) {
      await this.usersService.uncacheCandidateCV(updatedUserCandidat.url);
    } else {
      await this.usersService.cacheCandidateCV(updatedUserCandidat.candidat.id);
    }

    await this.usersService.cacheAllCVs();

    return updatedUserCandidat;
  }

  // match coach and candidate
  @UserPermissions(Permissions.ADMIN)
  @UseGuards(UserPermissionsGuard)
  @Put('linkUser/:userId')
  async linkUser(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Body('userToLinkId') userToLinkId: string
  ) {
    // check if users are already linked and remove existing link if needed
    const shouldRemoveLinkedUser =
      (Array.isArray(userToLinkId) && userToLinkId.length === 0) ||
      (!Array.isArray(userToLinkId) && userToLinkId === null);

    if (
      !shouldRemoveLinkedUser &&
      (Array.isArray(userToLinkId) // external coach has possibly multiple candidates
        ? !userToLinkId.every((id) => uuidValidate(id))
        : !uuidValidate(userId))
    ) {
      throw new BadRequestException();
    }

    const user = await this.usersService.findOne(userId);

    if (!user) {
      throw new NotFoundException();
    }

    const usersToLinkIds = Array.isArray(userToLinkId)
      ? userToLinkId
      : [userToLinkId];

    const usersToLinkOrToRemoveIds = shouldRemoveLinkedUser
      ? getRelatedUser(user)?.map(({ id }) => id)
      : usersToLinkIds;

    if (usersToLinkOrToRemoveIds) {
      const userCandidatesToUpdate = await Promise.all(
        usersToLinkOrToRemoveIds.map(async (userToLinkOrToRemoveId) => {
          const userToLink = await this.usersService.findOne(
            userToLinkOrToRemoveId
          );

          if (!userToLink) {
            throw new NotFoundException();
          }

          const { candidateId, coachId } =
            getCandidateAndCoachIdDependingOnRoles(
              user,
              userToLink,
              shouldRemoveLinkedUser
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
        await this.userCandidatsService.updateAllLinkedCoachesByCandidatesIds(
          userCandidatesToUpdate,
          shouldRemoveLinkedUser
        );

      if (!updatedUserCandidates) {
        throw new NotFoundException();
      }

      await Promise.all(
        updatedUserCandidates.map((updatedUserCandidate) => {
          const previousCoach = updatedUserCandidate.previous('coach');
          if (
            updatedUserCandidate.coach &&
            updatedUserCandidate.coach.id !== previousCoach?.id
          ) {
            return this.usersService.sendMailsAfterMatching(
              updatedUserCandidate.candidat.id
            );
          }
        })
      );
    }

    return this.usersService.findOne(userId);
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

  @AdminOverride()
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

    const oldUser = await this.usersService.findOne(userId);

    let updatedUser: User;
    try {
      updatedUser = await this.usersService.update(userId, updateUserDto);
    } catch (err) {
      if (((err as Error).name = SequelizeUniqueConstraintError)) {
        throw new ConflictException();
      }
    }

    if (!updatedUser) {
      throw new NotFoundException();
    }

    // if the email is updated, we need to send a verification email
    if (updateUserDto.email && updateUserDto.email !== oldUser.email) {
      const updateUserIsEmailVerified: UpdateUserDto = {
        isEmailVerified: false,
      };
      const updatedUser = await this.usersService.update(
        userId,
        updateUserIsEmailVerified
      );
      if (!updatedUser) {
        throw new NotFoundException();
      }

      const token = await this.usersService.generateVerificationToken(
        updatedUser
      );
      this.usersService.sendVerificationMail(updatedUser, token);
    }

    return updatedUser;
  }
}
