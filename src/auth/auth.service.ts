import { randomBytes } from 'crypto';
import {
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { MailsService } from 'src/mails/mails.service';
import { UpdateUserDto } from 'src/users/dto';
import { User } from 'src/users/models';
import { UsersService } from 'src/users/users.service';
import { UsersStatsService } from 'src/users-stats/users-stats.service';
import { LoggedUser } from './auth.types';
import { encryptPassword, validatePassword } from './auth.utils';

@Injectable()
export class AuthService {
  constructor(
    private mailsService: MailsService,
    private jwtService: JwtService,
    private usersStatsService: UsersStatsService,
    @Inject(forwardRef(() => UsersService))
    private usersService: UsersService
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.usersService.findOneByMail(email);
    if (user) {
      const { password: userPassword, salt: userSalt } =
        await this.usersService.findOneComplete(user.id);

      if (validatePassword(password, userPassword, userSalt)) {
        return user;
      }
    }

    return null;
  }

  async login(
    user: User,
    expiration: string | number = '30d'
  ): Promise<LoggedUser> {
    const { id } = user;

    const payload = {
      sub: id,
    };

    return {
      user: user,
      token: this.jwtService.sign(payload, {
        secret: `${process.env.JWT_SECRET}`,
        expiresIn: expiration,
      }),
    };
  }

  decodeJWT(token: string, ignoreExpiration?: boolean) {
    try {
      return this.jwtService.verify(token, {
        secret: `${process.env.JWT_SECRET}`,
        ignoreExpiration: ignoreExpiration,
      });
    } catch (err) {
      return false;
    }
  }

  isValidResetToken(hashReset: string, saltReset: string, token: string) {
    if (hashReset && saltReset) {
      const { password } = this.decodeJWT(token);

      if (password) {
        return validatePassword(password, hashReset, saltReset);
      }
    }
    return false;
  }

  generateRandomPasswordInJWT(expiration: string | number = '1d') {
    const randomToken = randomBytes(128).toString('hex');
    const { salt, hash } = encryptPassword(randomToken);

    return {
      salt,
      hash,
      jwtToken: this.jwtService.sign(
        {
          password: randomToken,
        },
        {
          secret: process.env.JWT_SECRET,
          expiresIn: expiration || '1d',
        }
      ),
    };
  }

  async generateResetToken(userId: string) {
    const { hash, salt, jwtToken } = this.generateRandomPasswordInJWT('1d');

    const updatedUser = await this.usersService.update(userId, {
      hashReset: hash,
      saltReset: salt,
    });

    if (!updatedUser) {
      throw new NotFoundException();
    }

    return {
      updatedUser,
      token: jwtToken,
    };
  }

  async updateUser(id: string, updateUserDto: UpdateUserDto) {
    return this.usersService.update(id, updateUserDto);
  }

  async findOneUserComplete(id: string) {
    return this.usersService.findOneComplete(id);
  }

  async findOneUserByMail(email: string, complete = false) {
    return this.usersService.findOneByMail(email, complete);
  }

  async findOneUserById(id: string, complete = false) {
    return this.usersService.findOne(id, complete);
  }

  async findOneUserById(id: string) {
    return this.usersService.findOne(id);
  }

  async sendPasswordResetLinkMail(
    user: Pick<User, 'id' | 'firstName' | 'role' | 'zone' | 'email'>,
    token: string
  ) {
    return this.mailsService.sendPasswordResetLinkMail(user, token);
  }

  async sendVerificationMail(user: User, token: string) {
    return this.mailsService.sendVerificationMail(user, token);
  }

  async sendRefererCandidateHasVerifiedAccountMail(candidate: User) {
    return this.mailsService.sendRefererCandidateHasVerifiedAccountMail(
      candidate
    );
  }

  async generateVerificationToken(user: User) {
    return this.jwtService.sign(
      { sub: user.id },
      {
        secret: process.env.JWT_SECRET,
        expiresIn: '7d',
      }
    );
  }

  async sendWelcomeMail(
    user: Pick<User, 'id' | 'firstName' | 'role' | 'zone' | 'email'>
  ) {
    return this.mailsService.sendWelcomeMail(user);
  }

  async sendOnboardingJ1BAOMail(user: User) {
    return this.mailsService.sendOnboardingJ1BAOMail(user);
  }

  async sendOnboardingJ3WebinarMail(user: User) {
    return this.mailsService.sendOnboardingJ3WebinarMail(user);
  }

  async getUsersStats(userId: string) {
    return {
      averageDelayResponse:
        await this.usersStatsService.getAverageDelayResponse(userId),
      responseRate: await this.usersStatsService.getResponseRate(userId),
    };
  }
}
