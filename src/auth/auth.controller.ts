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
import { MailsService } from 'src/mails/mails.service';
import { UsersService } from 'src/users/users.service';
import { RequestWithUser } from 'src/utils/types/utils';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { Public } from './guards/public.decorator';

@Throttle(10, 60)
@Controller('auth')
export class AuthController {
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

    const {
      password,
      salt: unusedSalt,
      revision,
      hashReset,
      saltReset,
      ...restProps
    } = updatedUser.toJSON();

    await this.mailsService.sendPasswordResetLinkMail(restProps, token);

    return;
  }

  @Public()
  @Get('/reset/:userId/:token')
  async checkReset(
    @Param('userId') userId: string,
    @Param('token') token: string
  ) {
    const user = await this.usersService.findOneComplete(userId);

    if (!user) {
      throw new UnauthorizedException();
    }

    const validPassword = this.authService.validatePassword(
      token,
      user.hashReset,
      user.saltReset
    );

    const validToken = this.authService.isTokenValid(token);

    if (!validPassword || !validToken) {
      throw new UnauthorizedException();
    }
    return;
  }

  @Public()
  @Post('/reset/:userId/:token')
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

    if (
      !(
        user.hashReset &&
        user.saltReset &&
        this.authService.validatePassword(
          token,
          user.hashReset,
          user.saltReset
        ) &&
        this.authService.isTokenValid(token)
      )
    ) {
      throw new UnauthorizedException();
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
