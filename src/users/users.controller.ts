import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  InternalServerErrorException,
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
  UpdateUserRestrictedDto,
  UpdateUserRestrictedPipe,
} from 'src/users/dto';
import { isValidPhone } from 'src/utils/misc';
import { FilterParams } from 'src/utils/types';
import {
  Self,
  SelfGuard,
  UserPermissions,
  UserPermissionsGuard,
} from './guards';
import { AdminOverride } from './guards/admin-override.decorator';
import { User } from './models';

import { UsersService } from './users.service';
import {
  JWTUserPayload,
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
  constructor(private readonly usersService: UsersService) {}

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

  @Put('company')
  async updateUserCompany(
    @UserPayload() user: JWTUserPayload,
    @Body('companyName')
    companyName: string | null
  ) {
    if (user.role !== UserRoles.COACH) {
      throw new ForbiddenException();
    }
    try {
      await this.usersService.linkCompany(user, companyName);
    } catch (err) {
      throw new InternalServerErrorException('Could not link user to company');
    }
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

  @AdminOverride()
  @Self('params.id')
  @UseGuards(SelfGuard)
  @Put(':id')
  async updateUser(
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
