import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Redirect,
  Request,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { passwordStrength } from 'check-password-strength';
import { MailsService } from 'src/mails/mails.service';
import { UsersService } from 'src/users/users.service';
import { RequestWithUser } from 'src/utils/types';
import { AuthService } from './auth.service';
import { LocalAuthGuard, Public } from './guards';

@Throttle(10, 60)
@Controller('auth')
export class AuthController {
  // Controller calls only his service ?
  // Or only the controller call other services ?
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly mailsService: MailsService
  ) {}

  @Public()
  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Request() req: RequestWithUser) {
    return this.authService.login(req.user);
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

    const user = await this.usersService.findOneByMail(email);

    if (!user) {
      throw new NotFoundException();
    }

    const { updatedUser, token } = await this.authService.generateResetToken(
      user
    );

    const { id, firstName, role, zone } = updatedUser;

    await this.mailsService.sendPasswordResetLinkMail(
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
    @Param('userId') userId: string,
    @Param('token') token: string
  ) {
    const user = await this.usersService.findOneComplete(userId);

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
    @Param('userId') userId: string,
    @Param('token') token: string,
    @Body('newPassword') newPassword: string,
    @Body('confirmPassword') confirmPassword: string
  ) {
    const user = await this.usersService.findOneComplete(userId);
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

    const { hash, salt } = this.authService.encryptPassword(newPassword);

    const userUpdated = await this.usersService.update(user.id, {
      password: hash,
      salt,
      hashReset: null,
      saltReset: null,
    });

    if (!userUpdated) {
      throw new UnauthorizedException();
    }

    return userUpdated;
  }

  @Throttle(100, 60)
  @Get('current')
  async getCurrent(@Request() req: RequestWithUser) {
    const { user } = req;
    const updatedUser = await this.usersService.update(user.id, {
      lastConnection: new Date(),
    });
    if (!updatedUser) {
      throw new UnauthorizedException();
    }

    return updatedUser;
  }
}
