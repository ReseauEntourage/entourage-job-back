import { BadRequestException, Injectable } from '@nestjs/common';

import { randomBytes, pbkdf2Sync } from 'crypto';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { User } from '../users/models/user.model';
import { UserAttribute } from '../users/models/user.attributes';

function getPartialUserForPayload(
  user: User,
): Pick<User, UserAttribute | 'candidat' | 'coach'> {
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

  encryptPassword(password) {
    const salt = randomBytes(16).toString('hex');
    const hash = pbkdf2Sync(password, salt, 10000, 512, 'sha512').toString(
      'hex',
    );

    return {
      salt,
      hash,
    };
  }

  validatePassword(password, hash, salt) {
    const passwordHash = pbkdf2Sync(
      password,
      salt,
      10000,
      512,
      'sha512',
    ).toString('hex');

    return passwordHash === hash;
  }

  async login(user: User, expiresIn: string | number = '30d') {
    const payloadUser = getPartialUserForPayload(user);

    const { id, ...restPayloadUser } = payloadUser;

    const payload = {
      sub: id,
      ...restPayloadUser,
    };
    return {
      user: {
        ...payloadUser,
      },
      token: this.jwtService.sign(payload, { expiresIn: expiresIn }),
    };
  }

  /*
  isTokenValid(token) {
    try {
      jwt.verify(token, process.env.JWT_SECRET);
      return true;
    } catch (err) {
      console.log('Token invalid : ', err);
      return false;
    }
  }*/
}
