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
import { Throttle } from '@nestjs/throttler';
import { encryptPassword } from 'src/auth/auth.utils';
import { Public } from 'src/auth/guards';
import { UserPermissions, UserPermissionsGuard } from 'src/users/guards';
import { User } from 'src/users/models';
import {
  ExternalUserRoles,
  NormalUserRoles,
  Permissions,
  Programs,
  SequelizeUniqueConstraintError,
  UserRoles,
} from 'src/users/users.types';
import {
  getCandidateAndCoachIdDependingOnRoles,
  isRoleIncluded,
} from 'src/users/users.utils';
import { getZoneFromDepartment, isValidPhone } from 'src/utils/misc';
import {
  CreateUserDto,
  CreateUserPipe,
  CreateUserRegistrationDto,
  CreateUserRegistrationPipe,
} from './dto';
import { UsersCreationService } from './users-creation.service';

function generateFakePassword() {
  return randomBytes(16).toString('hex');
}

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
          userCandidatesToUpdate,
          createdUser.role === UserRoles.CANDIDATE_EXTERNAL
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

  @Throttle(10, 60)
  @Public()
  @Post('registration')
  async createUserRegistration(
    @Body(new CreateUserRegistrationPipe())
    createUserRegistrationDto: CreateUserRegistrationDto
  ) {
    if (
      !isValidPhone(createUserRegistrationDto.phone) ||
      !isRoleIncluded(NormalUserRoles, createUserRegistrationDto.role)
    ) {
      throw new BadRequestException();
    }

    const { hash, salt } = encryptPassword(createUserRegistrationDto.password);

    const zone = getZoneFromDepartment(createUserRegistrationDto.department);

    const userToCreate: Partial<User> = {
      firstName: createUserRegistrationDto.firstName,
      lastName: createUserRegistrationDto.lastName,
      email: createUserRegistrationDto.email,
      role: createUserRegistrationDto.role,
      gender: createUserRegistrationDto.gender,
      phone: createUserRegistrationDto.phone,
      OrganizationId: null,
      address: null,
      adminRole: null,
      zone,
      password: hash,
      salt,
    };

    try {
      const { id: createdUserId } = await this.usersCreationService.createUser(
        userToCreate
      );

      await this.usersCreationService.updateUserProfileByUserId(createdUserId, {
        department: createUserRegistrationDto.department,
        helpNeeds: createUserRegistrationDto.helpNeeds,
      });

      const createdUser = await this.usersCreationService.findOneUser(
        createdUserId
      );

      if (createUserRegistrationDto.program === Programs.SHORT) {
        // TODO remove Campaign
      }

      // TODO send
      //  program
      //  birthDate
      //  department
      //  campaign
      //  workingRight
      //  to Salesforce

      const loggedUser = await this.usersCreationService.loginUser(createdUser);

      // TODO use new mail template
      await this.usersCreationService.sendNewAccountMail(
        {
          id: createdUser.id,
          firstName: createdUser.firstName,
          role: createdUser.role,
          zone: createdUser.zone,
          email: createdUser.email,
        },
        loggedUser.token
      );

      return loggedUser;
    } catch (err) {
      if (((err as Error).name = SequelizeUniqueConstraintError)) {
        throw new ConflictException();
      }
    }
  }
}
