import { randomBytes } from 'crypto';
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Redirect,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { passwordStrength } from 'check-password-strength';
import { CreateUserDto, Roles, RolesGuard, User, UserRoles } from '../users';
import { isValidPhone } from 'src/utils/misc';
import { AuthService, encryptPassword, validatePassword } from './auth.service';
import { LocalAuthGuard, Public, UserPayload } from './guards';

function generateFakePassword() {
  return randomBytes(16).toString('hex');
}

const SequelizeUniqueConstraintError = 'SequelizeUniqueConstraintError';

@Throttle(10, 60)
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Roles(UserRoles.ADMIN)
  @UseGuards(RolesGuard)
  @Post('createUser')
  async createUser(@Body() createUserDto: CreateUserDto) {
    if (createUserDto.phone && !isValidPhone(createUserDto.phone)) {
      throw new BadRequestException();
    }

    const userRandomPassword = generateFakePassword();
    const { hash, salt } = encryptPassword(userRandomPassword);

    const {
      hash: hashReset,
      salt: saltReset,
      jwtToken,
    } = this.authService.generateRandomPasswordInJWT('30d');

    const userToCreate = {
      ...createUserDto,
      password: hash,
      salt,
      hashReset,
      saltReset,
    } as CreateUserDto;

    let createdUser: User;
    try {
      createdUser = await this.authService.createUser(userToCreate);
    } catch (err) {
      if (((err as Error).name = SequelizeUniqueConstraintError)) {
        throw new ConflictException();
      }
    }
    const { id, firstName, role, zone, email } = createdUser.toJSON();

    await this.authService.sendNewAccountMail(
      {
        id,
        firstName,
        role,
        zone,
        email,
      },
      jwtToken
    );

    if (userToCreate.userToCoach) {
      let candidatId: string;
      let coachId: string;

      if (createdUser.role === UserRoles.COACH) {
        candidatId = userToCreate.userToCoach;
        coachId = createdUser.id;
      }
      if (createdUser.role === UserRoles.CANDIDAT) {
        candidatId = createdUser.id;
        coachId = userToCreate.userToCoach;
      }

      const updatedUserCandidat =
        await this.authService.updateUserCandidatByCandidateId(candidatId, {
          candidatId,
          coachId,
        });

      if (!updatedUserCandidat) {
        throw new NotFoundException();
      }
      await this.authService.sendMailsAfterMatching(candidatId);
    }

    return createdUser;
  }

  @Public()
  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@UserPayload() user: User) {
    return this.authService.login(user);
  }

  @Redirect(`${process.env.FRONT_URL}`, 302)
  @Post('logout')
  async logout() {
    return;
  }

  @Public()
  @Post('forgot')
  async forgot(@Body('email') email: string) {
    if (!email) {
      throw new BadRequestException();
    }

    const user = await this.authService.findOneUserByMail(email);

    if (!user) {
      throw new NotFoundException();
    }

    const { updatedUser, token } = await this.authService.generateResetToken(
      user
    );

    const { id, firstName, role, zone } = updatedUser;

    await this.authService.sendPasswordResetLinkMail(
      {
        id,
        firstName,
        role,
        zone,
        email,
      },
      token
    );

    return;
  }

  @Public()
  @Get('reset/:userId/:token')
  async checkReset(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Param('token') token: string
  ) {
    const user = await this.authService.findOneUserComplete(userId);

    if (!user) {
      throw new UnauthorizedException();
    }

    const { hashReset, saltReset } = user;

    const isValidResetToken = this.authService.isValidResetToken(
      hashReset,
      saltReset,
      token
    );
    if (!isValidResetToken) {
      throw new UnauthorizedException();
    }
    return;
  }

  @Public()
  @Post('reset/:userId/:token')
  async resetPassword(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Param('token') token: string,
    @Body('newPassword') newPassword: string,
    @Body('confirmPassword') confirmPassword: string
  ) {
    const user = await this.authService.findOneUserComplete(userId);
    if (!user) {
      throw new UnauthorizedException();
    }

    const { hashReset, saltReset } = user;

    const isValidResetToken = this.authService.isValidResetToken(
      hashReset,
      saltReset,
      token
    );

    if (!isValidResetToken) {
      throw new UnauthorizedException();
    }

    if (passwordStrength(newPassword).id < 2) {
      throw new BadRequestException();
    }

    if (newPassword !== confirmPassword) {
      throw new BadRequestException();
    }

    const { hash, salt } = encryptPassword(newPassword);

    const updatedUser = await this.authService.updateUser(user.id, {
      password: hash,
      salt,
      hashReset: null,
      saltReset: null,
    });

    if (!updatedUser) {
      throw new NotFoundException();
    }

    return updatedUser;
  }

  @Put('changeUserPwd')
  async changePassword(
    @UserPayload('email') email: string,
    @Body('oldPassword') oldPassword: string,
    @Body('newPassword') newPassword: string
  ) {
    const user = await this.authService.findOneUserByMail(email);
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

    const updatedUser = await this.authService.updateUser(user.id, {
      password: hash,
      salt,
    });

    if (!updatedUser) {
      throw new NotFoundException();
    }

    return updatedUser;
  }

  @Throttle(100, 60)
  @Get('current')
  async getCurrent(@UserPayload('id', new ParseUUIDPipe()) id: string) {
    const updatedUser = await this.authService.updateUser(id, {
      lastConnection: new Date(),
    });
    if (!updatedUser) {
      throw new NotFoundException();
    }

    return updatedUser;
  }
}
