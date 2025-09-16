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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { passwordStrength } from 'check-password-strength';
import { validate as uuidValidate } from 'uuid';
import validator from 'validator';
import { encryptPassword, validatePassword } from 'src/auth/auth.utils';
import { UserPayload } from 'src/auth/guards';
import {
  UpdateUserDto,
  UpdateUserCandidatDto,
  UpdateUserRestrictedDto,
  UpdateUserRestrictedPipe,
} from 'src/users/dto';
import { isValidPhone } from 'src/utils/misc';
import { FilterParams } from 'src/utils/types';
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
import { User } from './models';

import { UserCandidatsService } from './user-candidats.service';
import { UsersService } from './users.service';
import {
  MemberFilterKey,
  Permissions,
  SequelizeUniqueConstraintError,
  UserRole,
  UserRoles,
} from './users.types';
import { isRoleIncluded } from './users.utils';

// TODO change to /users
@ApiTags('Users')
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

    if (isRoleIncluded([UserRoles.CANDIDATE], role)) {
      return this.usersService.findAllCandidateMembers({
        ...query,
        limit,
        offset,
        search,
      });
    }

    if (isRoleIncluded([UserRoles.COACH], role)) {
      return this.usersService.findAllCoachMembers({
        ...query,
        limit,
        offset,
        search,
      });
    }

    if (isRoleIncluded([UserRoles.REFERER], role)) {
      return this.usersService.findAllRefererMembers({
        ...query,
        limit,
        offset,
        search,
      });
    }

    throw new BadRequestException();
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

    return user.toJSON();
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

    return updatedUserCandidat;
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
