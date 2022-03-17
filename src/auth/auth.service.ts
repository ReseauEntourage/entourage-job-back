import { Injectable, NotFoundException } from '@nestjs/common';

import { randomBytes, pbkdf2Sync } from 'crypto';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { User } from '../users/models/user.model';
import { UserAttribute } from '../users/models/user.attribute';

export type PayloadUser = Pick<User, UserAttribute | 'candidat' | 'coach'>;

export function getPartialUserForPayload(user: User): PayloadUser {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    gender: user.gender,
    phone: user.phone,
    address: user.address,
    zone: user.zone,
    role: user.role,
    adminRole: user.adminRole,
    candidat: user.candidat,
    coach: user.coach,
    lastConnection: user.lastConnection,
  };
}

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.usersService.findOneByMail(email);
    if (user && this.validatePassword(password, user.password, user.salt)) {
      return user;
    }
    return null;
  }

  async login(user: User, expiresIn: string | number = '30d') {
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
        expiresIn: expiresIn,
      }),
    };
  }

  async generateResetToken(user: User) {
    const { token } = await this.login(user, '1d');

    const { hash, salt } = this.encryptPassword(token);

    const updatedUser = await this.usersService.update(user.id, {
      hashReset: hash,
      saltReset: salt,
    });

    if (!updatedUser) {
      throw new NotFoundException();
    }

    return {
      updatedUser,
      token,
    };
  }

  encryptPassword(password: string) {
    const salt = randomBytes(16).toString('hex');
    const hash = pbkdf2Sync(password, salt, 10000, 512, 'sha512').toString(
      'hex',
    );

    return {
      salt,
      hash,
    };
  }

  validatePassword(password: string, hash: string, salt: string) {
    const passwordHash = pbkdf2Sync(
      password,
      salt,
      10000,
      512,
      'sha512',
    ).toString('hex');

    return passwordHash === hash;
  }

  isTokenValid(token: string) {
    try {
      this.jwtService.verify(token, {
        secret: `${process.env.JWT_SECRET}`,
      });
      return true;
    } catch (err) {
      return false;
    }
  }
}
