import { randomBytes } from 'crypto';
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  NotFoundException,
  Post,
  UseGuards,
} from '@nestjs/common';
import { encryptPassword } from 'src/auth/auth.utils';
import { CreateUserDto } from 'src/users/dto';
import { Roles, UserPermissionsGuard } from 'src/users/guards';
import { User } from 'src/users/models';
import { UserRoles } from 'src/users/users.types';
import { isValidPhone } from 'src/utils/misc';
import { UsersCreationService } from './users-creation.service';

function generateFakePassword() {
  return randomBytes(16).toString('hex');
}

const SequelizeUniqueConstraintError = 'SequelizeUniqueConstraintError';

// TODO change to users
@Controller('user')
export class UsersCreationController {
  constructor(private readonly usersCreationService: UsersCreationService) {}

  @Roles(UserRoles.ADMIN)
  @UseGuards(UserPermissionsGuard)
  @Post()
  async createUser(@Body() createUserDto: CreateUserDto) {
    if (createUserDto.phone && !isValidPhone(createUserDto.phone)) {
      throw new BadRequestException();
    }

    const userRandomPassword = generateFakePassword();
    const { hash, salt } = encryptPassword(userRandomPassword);

    const {
      hash: hashReset,
      salt: saltReset,
      jwtToken,
    } = this.usersCreationService.generateRandomPasswordInJWT('30d');

    const userToCreate = {
      ...createUserDto,
      password: hash,
      salt,
      hashReset,
      saltReset,
    } as CreateUserDto;

    let createdUser: User;
    try {
      createdUser = await this.usersCreationService.createUser(userToCreate);
    } catch (err) {
      if (((err as Error).name = SequelizeUniqueConstraintError)) {
        throw new ConflictException();
      }
    }
    const { id, firstName, role, zone, email } = createdUser.toJSON();

    await this.usersCreationService.sendNewAccountMail(
      {
        id,
        firstName,
        role,
        zone,
        email,
      },
      jwtToken
    );

    if (userToCreate.userToCoach) {
      let candidateId: string;
      let coachId: string;

      if (createdUser.role === UserRoles.COACH) {
        candidateId = userToCreate.userToCoach;
        coachId = createdUser.id;
      }
      if (createdUser.role === UserRoles.CANDIDATE) {
        candidateId = createdUser.id;
        coachId = userToCreate.userToCoach;
      }

      const updatedUserCandidat =
        await this.usersCreationService.updateUserCandidatByCandidateId(
          candidateId,
          {
            candidatId: candidateId,
            coachId,
          }
        );

      if (!updatedUserCandidat) {
        throw new NotFoundException();
      }
      await this.usersCreationService.sendMailsAfterMatching(candidateId);
    }

    return createdUser;
  }
}
