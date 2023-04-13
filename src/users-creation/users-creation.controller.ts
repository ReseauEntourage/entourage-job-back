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
import { CreateUserPipe } from 'src/users/dto/create-user.pipe';
import { UserPermissions, UserPermissionsGuard } from 'src/users/guards';
import { User } from 'src/users/models';
import {
  ExternalUserRoles,
  Permissions,
  UserRoles,
} from 'src/users/users.types';
import {
  getCandidateAndCoachIdDependingOnRoles,
  isRoleIncluded,
} from 'src/users/users.utils';
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

  @UserPermissions(Permissions.ADMIN)
  @UseGuards(UserPermissionsGuard)
  @Post()
  async createUser(@Body(new CreateUserPipe()) createUserDto: CreateUserDto) {
    if (
      (createUserDto.OrganizationId &&
        !isRoleIncluded(ExternalUserRoles, createUserDto.role)) ||
      (!createUserDto.OrganizationId &&
        isRoleIncluded(ExternalUserRoles, createUserDto.role))
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

    if (userToCreate.userToLinkId) {
      if (
        (createdUser.role !== UserRoles.COACH_EXTERNAL &&
          Array.isArray(userToCreate.userToLinkId)) ||
        (createdUser.role === UserRoles.COACH_EXTERNAL &&
          !Array.isArray(userToCreate.userToLinkId))
      ) {
        throw new BadRequestException();
      }

      const usersToLinkIds = Array.isArray(userToCreate.userToLinkId)
        ? userToCreate.userToLinkId
        : [userToCreate.userToLinkId];

      const userCandidatesToUpdate = await Promise.all(
        usersToLinkIds.map(async (userToLinkId) => {
          const userToLink = await this.usersCreationService.findOneUser(
            userToLinkId
          );

          if (!userToLink) {
            throw new NotFoundException();
          }

          const { candidateId, coachId } =
            getCandidateAndCoachIdDependingOnRoles(createdUser, userToLink);

          const userCandidate =
            await this.usersCreationService.findOneUserCandidatByCandidateId(
              candidateId
            );

          if (!userCandidate) {
            throw new NotFoundException();
          }

          return { candidateId: candidateId, coachId: coachId };
        })
      );

      const updatedUserCandidates =
        await this.usersCreationService.updateAllUserCandidatLinkedUserByCandidateId(
          userCandidatesToUpdate
        );

      if (!updatedUserCandidates) {
        throw new NotFoundException();
      }

      await Promise.all(
        updatedUserCandidates.map(async (updatedUserCandidate) => {
          const previousCoach = updatedUserCandidate.previous('coach');
          if (
            updatedUserCandidate.coach &&
            updatedUserCandidate.coach.id !== previousCoach?.id
          ) {
            await this.usersCreationService.sendMailsAfterMatching(
              updatedUserCandidate.candidat.id
            );
          }
          return updatedUserCandidate.toJSON();
        })
      );
    }

    return this.usersCreationService.findOneUser(createdUser.id);
  }
}
