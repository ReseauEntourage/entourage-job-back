import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Redirect,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { passwordStrength } from 'check-password-strength';
import { ExternalCvsService } from 'src/external-cvs/external-cvs.service';
import { SessionsService } from 'src/sessions/sessions.service';
import { User } from 'src/users/models';
import { AuthService } from './auth.service';
import { encryptPassword } from './auth.utils';
import { generateCurrentUserDto } from './dto/current-user.dto';
import { LocalAuthGuard, Public, UserPayload } from './guards';

@ApiTags('Auth')
@Throttle(10, 60)
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly sessionService: SessionsService,
    private readonly externalCvsService: ExternalCvsService
  ) {}

  @Public()
  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@UserPayload() user: User) {
    const loggedInUser = await this.authService.login(user);
    await this.sessionService.createOrUpdateSession(user.id);
    return loggedInUser;
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

  /*
    This route is used to get logged user data + verify if the user is still logged in
  */
  @Throttle(60, 60)
  @ApiBearerAuth()
  @Get('current')
  async getCurrent(
    @UserPayload('id', new ParseUUIDPipe()) id: string,
    @Query('complete') complete = 'false'
  ) {
    // Updating current user last connection date
    const updatedUser = await this.authService.updateUser(id, {
      lastConnection: new Date(),
    });
    if (!updatedUser) {
      throw new NotFoundException();
    }

    const usersStats =
      complete === 'true'
        ? await this.authService.getUsersStats(updatedUser.id)
        : undefined;

    const currentUser = await this.authService.findOneUserById(updatedUser.id);
    const currentUserProfile = await this.authService.findOneUserProfileById(
      updatedUser.id,
      complete === 'true'
    );
    const hasExtractedCvData =
      complete === 'true'
        ? await this.externalCvsService.hasExtractedCVData(
            currentUser.userProfile.id
          )
        : undefined;

    await this.sessionService.createOrUpdateSession(currentUser.id);

    return generateCurrentUserDto(
      currentUser,
      currentUserProfile,
      usersStats,
      hasExtractedCvData,
      complete === 'true'
    );
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

    await this.authService.sendWelcomeMail(updatedUser);

    return;
  }

  @Throttle(60, 60)
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

    const tokenToSend = await this.authService.generateVerificationToken(user);

    await this.authService.sendVerificationMail(user, tokenToSend);

    return;
  }

  @Throttle(60, 60)
  @Public()
  @Post('finalize-refered-user')
  async finalizeReferedUser(
    @Body('token') token?: string,
    @Body('password') password?: string
  ): Promise<string> {
    if (!token || !password) {
      throw new BadRequestException();
    }

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
    if (user.isEmailVerified && user.password) {
      throw new BadRequestException('EMAIL_ALREADY_VERIFIED');
    }
    if (expirationDate.getTime() < currentDate.getTime()) {
      throw new BadRequestException('TOKEN_EXPIRED');
    }

    const { hash, salt } = encryptPassword(password);

    const updatedUser = await this.authService.updateUser(userId, {
      isEmailVerified: true,
      password: hash,
      salt,
      hashReset: null,
      saltReset: null,
    });

    if (!updatedUser) {
      throw new NotFoundException();
    }

    await this.authService.sendWelcomeMail(updatedUser);
    await this.authService.sendOnboardingJ1BAOMail(updatedUser);
    await this.authService.sendOnboardingJ3WebinarMail(updatedUser);
    await this.authService.sendRefererCandidateHasVerifiedAccountMail(
      updatedUser
    );

    return updatedUser.email;
  }
}
