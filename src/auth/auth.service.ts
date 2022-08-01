import { randomBytes, pbkdf2Sync } from 'crypto';
import { InjectQueue } from '@nestjs/bull';
import { Injectable, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Queue } from 'bull';
import { CustomMailParams, MailsService } from 'src/mails';
import { Jobs, Queues } from 'src/queues';
import {
  CreateUserDto,
  getRelatedUser,
  UpdateUserCandidatDto,
  UpdateUserDto,
  User,
  UserAttribute,
  UsersService,
  UserCandidatsService,
} from 'src/users';

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
    private mailsService: MailsService,
    private jwtService: JwtService,
    private usersService: UsersService,
    private userCandidatsService: UserCandidatsService,
    @InjectQueue(Queues.WORK)
    private workQueue: Queue
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

  encryptPassword(password: string) {
    const salt = randomBytes(16).toString('hex');
    const hash = pbkdf2Sync(password, salt, 10000, 512, 'sha512').toString(
      'hex'
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
      'sha512'
    ).toString('hex');

    return passwordHash === hash;
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
        return this.validatePassword(password, hashReset, saltReset);
      }
    }
    return false;
  }

  generateRandomPasswordInJWT(expiration: string | number = '1d') {
    const randomToken = randomBytes(128).toString('hex');
    const { salt, hash } = this.encryptPassword(randomToken);

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

  async createUser(createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
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

  async sendNewAccountMail(
    user: Pick<User, 'id' | 'firstName' | 'role' | 'zone' | 'email'>,
    token: string
  ) {
    return this.mailsService.sendNewAccountMail(user, token);
  }

  async sendPasswordResetLinkMail(
    user: Pick<User, 'id' | 'firstName' | 'role' | 'zone' | 'email'>,
    token: string
  ) {
    return this.mailsService.sendPasswordResetLinkMail(user, token);
  }

  async sendMailsAfterMatching(candidateId: string) {
    const finalCandidate = await this.usersService.findOne(candidateId);

    const toEmail: CustomMailParams['toEmail'] = { to: finalCandidate.email };

    const coach = getRelatedUser(finalCandidate);
    if (coach) {
      toEmail.cc = coach.email;
    }
    await this.mailsService.sendCvPreparationMail(
      finalCandidate.toJSON(),
      toEmail
    );

    await this.workQueue.add(
      Jobs.REMINDER_CV_10,
      {
        candidatId: candidateId,
      },
      {
        delay:
          (process.env.CV_10_REMINDER_DELAY
            ? parseFloat(process.env.CV_10_REMINDER_DELAY)
            : 10) *
          3600000 *
          24,
      }
    );
    await this.workQueue.add(
      Jobs.REMINDER_CV_20,
      {
        candidatId: candidateId,
      },
      {
        delay:
          (process.env.CV_20_REMINDER_DELAY
            ? parseFloat(process.env.CV_20_REMINDER_DELAY)
            : 20) *
          3600000 *
          24,
      }
    );
  }

  async updateUserCandidatByCandidateId(
    candidateId: string,
    updateUserCandidatDto: UpdateUserCandidatDto
  ) {
    return this.userCandidatsService.updateByCandidateId(
      candidateId,
      updateUserCandidatDto
    );
  }
}
