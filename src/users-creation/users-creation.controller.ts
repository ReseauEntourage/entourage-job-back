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
import { CreateUserPipe } from '../users/dto/create-user.pipe';
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
  async createUser(@Body(new CreateUserPipe()) createUserDto: CreateUserDto) {
    if (
      createUserDto.OrganizationId &&
      createUserDto.role !== UserRoles.CANDIDATE_EXTERNAL &&
      createUserDto.role !== UserRoles.COACH_EXTERNAL
    ) {
      throw new BadRequestException();
    }

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

    if (userToCreate.linkedUser) {
      if (createdUser.role === UserRoles.COACH_EXTERNAL) {
        if (!Array.isArray(userToCreate.linkedUser)) {
          throw new BadRequestException();
        }
        const candidatesIds = userToCreate.linkedUser;

        const candidates = await Promise.all(
          candidatesIds.map((singleCandidateId) => {
            return this.usersCreationService.findOneUser(singleCandidateId);
          })
        );
        if (candidates.some(({ role }) => role !== UserRoles.CANDIDATE)) {
          throw new BadRequestException();
        }

        await Promise.all(
          candidatesIds.map(async (candidateId) => {
            const updatedUserCandidat =
              await this.usersCreationService.updateUserCandidatByCandidateId(
                candidateId,
                {
                  candidatId: candidateId,
                  coachId: createdUser.id,
                }
              );

            if (!updatedUserCandidat) {
              throw new NotFoundException();
            }
            await this.usersCreationService.sendMailsAfterMatching(candidateId);
          })
        );
      } else {
        if (Array.isArray(userToCreate.linkedUser)) {
          throw new BadRequestException();
        }

        let candidateId: string;
        let coachId: string;

        if (createdUser.role === UserRoles.COACH) {
          candidateId = userToCreate.linkedUser;
          coachId = createdUser.id;

          const candidate = await this.usersCreationService.findOneUser(
            candidateId
          );

          if (candidate.role !== UserRoles.CANDIDATE) {
            throw new BadRequestException();
          }
        } else if (
          createdUser.role === UserRoles.CANDIDATE ||
          createdUser.role === UserRoles.CANDIDATE_EXTERNAL
        ) {
          coachId = userToCreate.linkedUser;
          candidateId = createdUser.id;

          const coach = await this.usersCreationService.findOneUser(coachId);
          if (coach.role !== UserRoles.COACH) {
            throw new BadRequestException();
          }
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
    }

    return this.usersCreationService.findOneUser(createdUser.id);
  }
}
