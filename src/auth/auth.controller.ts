import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Redirect,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { passwordStrength } from 'check-password-strength';
import { User } from 'src/users/models';
import { AuthService } from './auth.service';
import { encryptPassword } from './auth.utils';
import { LocalAuthGuard, Public, UserPayload } from './guards';

@Throttle(10, 60)
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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
      user.id
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

  @Throttle(60, 60)
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

  @Public()
  @Post('verify-email')
  async verifyEmail(@Body('token') token: string): Promise<void> {
    // Need to ignore expiration date here when verifying the token to be able to check if the user emailis already verified
    const decodedToken = this.authService.decodeJWT(token, true);
    const { sub: userId, exp } = decodedToken;

    const expirationDate = new Date(exp * 1000);
    const currentDate = new Date();

    if (!decodedToken || !exp || !userId) {
      throw new BadRequestException('INVALID_TOKEN');
    }
    const user = await this.authService.findOneUserComplete(userId);
    if (!user) {
      throw new NotFoundException();
    }
    if (user.isEmailVerified) {
      throw new BadRequestException('EMAIL_ALREADY_VERIFIED');
    }
    if (expirationDate.getTime() < currentDate.getTime()) {
      throw new BadRequestException('TOKEN_EXPIRED');
    }

    const updatedUser = await this.authService.updateUser(userId, {
      isEmailVerified: true,
    });

    if (!updatedUser) {
      throw new NotFoundException();
    }

    return;
  }

  @Throttle(60, 60)
  @Public()
  @Post('send-verify-email')
  async sendVerifyEmail(@Body('token') token: string): Promise<void> {
    // Need to ignore expiration date to extract the user
    const decodedToken = this.authService.decodeJWT(token, true);
    const { sub: userId } = decodedToken;

    if (!decodedToken || !userId) {
      throw new BadRequestException();
    }
    const user = await this.authService.findOneUserComplete(userId);
    if (!user) {
      throw new NotFoundException();
    }

    const tokenToSend = await this.authService.generateVerificationToken(
      userId
    );

    await this.authService.sendVerificationMail(user, tokenToSend);

    return;
  }
}
