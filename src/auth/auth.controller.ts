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
import { ApiBody, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { passwordStrength } from 'check-password-strength';
import { SessionsService } from 'src/sessions/sessions.service';
import { User } from 'src/users/models';
import { AuthService } from './auth.service';
import { encryptPassword, isAccountFinalized } from './auth.utils';
import {
  AllowWithoutPassword,
  LocalAuthGuard,
  Public,
  UserPayload,
} from './guards';

@ApiTags('Auth')
@Throttle({ default: { limit: 10, ttl: 60000 } })
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly sessionService: SessionsService
  ) {}

  @Public()
  @UseGuards(LocalAuthGuard)
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: {
          type: 'string',
          example: 'user@example.com',
        },
        password: {
          type: 'string',
          example: 'password123',
        },
      },
    },
  })
  @Post('login')
  async login(@UserPayload('id') userId: string) {
    const loggedInUser = await this.authService.login(userId);
    await this.sessionService.createOrUpdateSession(userId);
    return loggedInUser;
  }

  @AllowWithoutPassword()
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

    await this.authService.sendPasswordResetLinkMail(updatedUser, token);

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

    // If it's the first time the user verify his email, we send him a welcome mail
    if (!user.lastConnection) {
      await this.authService.sendWelcomeMail(updatedUser);
    }

    return;
  }

  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @Public()
  @Post('send-verify-email')
  async sendVerifyEmail(
    @Body('token') token?: string,
    @Body('email') email?: string
  ): Promise<void> {
    if (!token && !email) {
      throw new BadRequestException();
    }

    let user: User;

    if (token) {
      // Need to ignore expiration date to extract the user
      const decodedToken = this.authService.decodeJWT(token, true);
      const { sub: userId } = decodedToken;

      if (!decodedToken || !userId) {
        throw new BadRequestException();
      }
      user = await this.authService.findOneUserComplete(userId);
      if (!user) {
        throw new NotFoundException();
      }
    } else if (email) {
      user = await this.authService.findOneUserByMail(email);
      if (!user) {
        throw new NotFoundException();
      }
    }

    await this.authService.generateAndSendVerificationWithOtp(user);

    return;
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Public()
  @Post('verify-otp')
  async verifyOtp(
    @Body('email') email: string,
    @Body('code') code: string
  ): Promise<{ token: string }> {
    if (!email || !code) {
      throw new BadRequestException();
    }
    return this.authService.verifyOtp(email, code);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Public()
  @Post('autologin')
  async autologin(@Body('token') token: string): Promise<{ token: string }> {
    if (!token) {
      throw new BadRequestException();
    }
    return this.authService.consumeAutologinToken(token);
  }

  /**
   * The single way to set the first password of an account that has none.
   * Identity is proven either by the activation token sent by email, or by
   * the (restricted) session of an account without a password, e.g. after an
   * autologin link. The token wins when both are present, so that an
   * activation link behaves the same whoever is logged in on the browser.
   */
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @Public()
  @Post('finalize-account')
  async finalizeAccount(
    @Body('token') token?: string,
    @Body('password') password?: string,
    @UserPayload('id') sessionUserId?: string
  ): Promise<string> {
    if (!password) {
      throw new BadRequestException();
    }

    const user = token
      ? await this.findUserFromActivationToken(token)
      : await this.findUserFromSession(sessionUserId);

    const { hash, salt } = encryptPassword(password);

    const updatedUser = await this.authService.updateUser(user.id, {
      isEmailVerified: true,
      password: hash,
      salt,
      hashReset: null,
      saltReset: null,
    });

    if (!updatedUser) {
      throw new NotFoundException();
    }

    // Same rule as `verify-email` and `verify-otp`: the welcome mail goes out
    // on the first email verification. An account whose email was already
    // verified (by OTP, or the J+1 relaunch link) has already received it.
    if (!user.isEmailVerified) {
      await this.authService.sendWelcomeMail(updatedUser);
    }
    // Any account without a password can be finalized, not only refered ones.
    if (updatedUser.refererId) {
      await this.authService.sendRefererCandidateHasVerifiedAccountMail(
        updatedUser
      );
    }

    return updatedUser.email;
  }

  private async findUserFromActivationToken(token: string): Promise<User> {
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
    if (isAccountFinalized(user)) {
      throw new BadRequestException('EMAIL_ALREADY_VERIFIED');
    }
    if (expirationDate.getTime() < currentDate.getTime()) {
      throw new BadRequestException('TOKEN_EXPIRED');
    }
    return user;
  }

  private async findUserFromSession(sessionUserId?: string): Promise<User> {
    if (!sessionUserId) {
      throw new BadRequestException('INVALID_TOKEN');
    }
    const user = await this.authService.findOneUserComplete(sessionUserId);
    if (!user) {
      throw new NotFoundException();
    }
    // Same rule as the token path: a session on an account that already has
    // a password implies a verified email, so it is always refused here and
    // this route never stands in for `changePwd`.
    if (isAccountFinalized(user)) {
      throw new BadRequestException('EMAIL_ALREADY_VERIFIED');
    }
    return user;
  }

  /**
   * Sends a refered candidate a new activation link, typically once the one
   * triggered by their referer has expired. The previously issued token is the
   * only authorization factor: its signature is checked, its expiration is
   * ignored, and no email address is accepted — so this can neither send mails
   * to arbitrary addresses nor reveal which addresses have an account. The
   * referer is not notified here; they are when the candidate finalizes.
   */
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Public()
  @Post('send-finalize-refered-user')
  async sendFinalizeReferedUser(@Body('token') token?: string): Promise<void> {
    if (!token) {
      throw new BadRequestException();
    }

    const decodedToken = this.authService.decodeJWT(token, true);
    const userId = decodedToken ? decodedToken.sub : undefined;
    if (!userId) {
      throw new BadRequestException('INVALID_TOKEN');
    }

    const candidate = await this.authService.findOneUserComplete(userId);
    if (!candidate || !candidate.refererId) {
      throw new BadRequestException('INVALID_TOKEN');
    }
    if (isAccountFinalized(candidate)) {
      throw new BadRequestException('EMAIL_ALREADY_VERIFIED');
    }

    // Loaded as a root user so that `referer.organization` is included.
    const referer = await this.authService.findOneUserById(candidate.refererId);
    if (!referer) {
      throw new NotFoundException();
    }

    await this.authService.sendReferedCandidateFinalizeAccountMail(
      candidate,
      referer
    );
  }
}
