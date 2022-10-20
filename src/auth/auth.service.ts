import { randomBytes } from 'crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { MailsService } from 'src/mails/mails.service';
import { UpdateUserDto } from 'src/users/dto';
import { User } from 'src/users/models';
import { UsersService } from 'src/users/users.service';
import { LoggedUser } from './auth.types';
import {
  encryptPassword,
  getPartialUserForPayload,
  validatePassword,
} from './auth.utils';

@Injectable()
export class AuthService {
  constructor(
    private mailsService: MailsService,
    private jwtService: JwtService,
    private usersService: UsersService
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.usersService.findOneByMail(email);
    if (user && validatePassword(password, user.password, user.salt)) {
      return user;
    }
    return null;
  }

  async login(
    user: User,
    expiration: string | number = '30d'
  ): Promise<LoggedUser> {
    const payloadUser = getPartialUserForPayload(user);

    const { id, ...restPayloadUser } = payloadUser;

    const payload = {
      sub: id,
      ...restPayloadUser,
    };
    return {
      user: payloadUser,
      token: this.jwtService.sign(payload, {
        secret: `${process.env.JWT_SECRET}`,
        expiresIn: expiration,
      }),
    };
  }

  decodeJWT(token: string) {
    try {
      return this.jwtService.verify(token, {
        secret: `${process.env.JWT_SECRET}`,
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

  async generateResetToken(user: User) {
    const { hash, salt, jwtToken } = this.generateRandomPasswordInJWT('1d');

    const updatedUser = await this.usersService.update(user.id, {
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

  async findOneUserByMail(email: string) {
    return this.usersService.findOneByMail(email);
  }

  async sendPasswordResetLinkMail(
    user: Pick<User, 'id' | 'firstName' | 'role' | 'zone' | 'email'>,
    token: string
  ) {
    return this.mailsService.sendPasswordResetLinkMail(user, token);
  }
}
