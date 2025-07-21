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
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { encryptPassword } from 'src/auth/auth.utils';
import { Public, UserPayload } from 'src/auth/guards';
import { getContactStatusFromUserRole } from 'src/external-services/mailjet/mailjet.utils';
import { UserPermissions, UserPermissionsGuard } from 'src/users/guards';
import { User } from 'src/users/models';
import {
  NormalUserRoles,
  Permissions,
  RegistrableUserRoles,
  RolesWithOrganization,
  SequelizeUniqueConstraintError,
  UserRoles,
} from 'src/users/users.types';
import {
  getCandidateAndCoachIdDependingOnRoles,
  isRoleIncluded,
} from 'src/users/users.utils';
import { getZoneFromDepartment, isValidPhone } from 'src/utils/misc';
import { convertYesNoToBoolean } from 'src/utils/yesNo';
import { Utm } from 'src/utm/models';
import {
  CreateUserDto,
  CreateUserPipe,
  CreateUserRegistrationDto,
  CreateUserRegistrationPipe,
} from './dto';
import { CreateUserReferingDto } from './dto/create-user-refering.dto';
import { CreateUserReferingPipe } from './dto/create-user-refering.pipe';
import { UsersCreationService } from './users-creation.service';

function generateFakePassword() {
  return randomBytes(16).toString('hex');
}

// TODO change to users
@ApiTags('Users')
@Controller('user')
export class UsersCreationController {
  constructor(private readonly usersCreationService: UsersCreationService) {}

  @UserPermissions(Permissions.ADMIN)
  @UseGuards(UserPermissionsGuard)
  @Post()
  async createUser(@Body(new CreateUserPipe()) createUserDto: CreateUserDto) {
    if (
      (createUserDto.OrganizationId &&
        !isRoleIncluded(RolesWithOrganization, createUserDto.role)) ||
      (!createUserDto.OrganizationId &&
        isRoleIncluded(RolesWithOrganization, createUserDto.role))
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
      const usersToLinkIds = [userToCreate.userToLinkId];

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
      !isRoleIncluded(RegistrableUserRoles, createUserRegistrationDto.role)
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
      OrganizationId: createUserRegistrationDto.organizationId,
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
        nudges: createUserRegistrationDto.nudges,
        sectorOccupations: createUserRegistrationDto.sectorOccupations,
        optInNewsletter: createUserRegistrationDto.optInNewsletter ?? false,
      });

      const createdUser = await this.usersCreationService.findOneUser(
        createdUserId
      );
      await this.usersCreationService.createExternalDBUser(createdUserId, {
        birthDate: createUserRegistrationDto.birthDate,
        workingRight: createUserRegistrationDto.workingRight,
        gender: createUserRegistrationDto.gender,
        structure:
          createdUser.role === UserRoles.REFERER
            ? createdUser.organization.name
            : undefined,
      });

      await this.usersCreationService.updateUserSocialSituationByUserId(
        createdUserId,
        {
          materialInsecurity: convertYesNoToBoolean(
            createUserRegistrationDto.materialInsecurity
          ),
          networkInsecurity: convertYesNoToBoolean(
            createUserRegistrationDto.networkInsecurity
          ),
        }
      );

      // Link the company if provided
      if (createUserRegistrationDto.companyId) {
        const company = await this.usersCreationService.findOneCompany(
          createUserRegistrationDto.companyId
        );
        if (!company) {
          throw new NotFoundException('Company not found');
        }
        // If an other user is already linked to the company, we change the role to 'employee'
        const existingCompanyUser =
          await this.usersCreationService.findOneCompanyUser(
            createUserRegistrationDto.companyId
          );
        const role = existingCompanyUser
          ? 'employee'
          : createUserRegistrationDto.companyRole;
        await this.usersCreationService.linkUserToCompany(
          createdUserId,
          createUserRegistrationDto.companyId,
          role
        );
      }

      // UTM
      const utmToCreate: Partial<Utm> = {
        userId: createdUserId,
        utmSource: createUserRegistrationDto.utmSource,
        utmMedium: createUserRegistrationDto.utmMedium,
        utmCampaign: createUserRegistrationDto.utmCampaign,
        utmTerm: createUserRegistrationDto.utmTerm,
        utmContent: createUserRegistrationDto.utmContent,
      };

      await this.usersCreationService.createUtm(utmToCreate);

      // Newsletter subscription
      if (createUserRegistrationDto.optInNewsletter) {
        await this.usersCreationService.sendContactToMailjet({
          email: createUserRegistrationDto.email,
          zone: createdUser.zone,
          status: getContactStatusFromUserRole(createdUser.role),
        });
      }

      // Referer
      if (createUserRegistrationDto.role === UserRoles.REFERER) {
        await this.usersCreationService.sendAdminNewRefererNotificationMail(
          createdUser
        );
      }

      // Coach or Candidate
      if (isRoleIncluded(NormalUserRoles, createUserRegistrationDto.role)) {
        await this.usersCreationService.sendOnboardingJ1BAOMail(createdUser);
        await this.usersCreationService.sendOnboardingJ3WebinarMail(
          createdUser
        );
        await this.usersCreationService.sendOnboardingJ4ContactAdviceMail(
          createdUser
        );
      }

      await this.usersCreationService.sendVerificationMail(createdUser);

      return createdUser;
    } catch (err) {
      if (((err as Error).name = SequelizeUniqueConstraintError)) {
        console.error('Duplicate email error:', err);
        throw new ConflictException();
      }
      console.error('Error during user registration creation:', err);
    }
  }

  @UserPermissions(Permissions.REFERER)
  @UseGuards(UserPermissionsGuard)
  @Throttle(10, 60)
  @Post('refering')
  async createUserRefering(
    @Body(new CreateUserReferingPipe())
    createUserReferingDto: CreateUserReferingDto,
    @UserPayload()
    referer: User
  ) {
    if (!isValidPhone(createUserReferingDto.phone)) {
      throw new BadRequestException();
    }

    const userRandomPassword = generateFakePassword();
    const { hash, salt } = encryptPassword(userRandomPassword);

    const zone = getZoneFromDepartment(createUserReferingDto.department);

    const userToCreate: Partial<User> = {
      refererId: referer.id,
      OrganizationId: referer.OrganizationId,
      firstName: createUserReferingDto.firstName,
      lastName: createUserReferingDto.lastName,
      email: createUserReferingDto.email,
      role: UserRoles.CANDIDATE,
      gender: createUserReferingDto.gender,
      phone: createUserReferingDto.phone,
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
        department: createUserReferingDto.department,
        nudges: createUserReferingDto.nudges,
        sectorOccupations: createUserReferingDto.sectorOccupations,
      });

      const createdUser = await this.usersCreationService.findOneUser(
        createdUserId
      );

      await this.usersCreationService.createExternalDBUser(createdUserId, {
        birthDate: createUserReferingDto.birthDate,
        workingRight: createUserReferingDto.workingRight,
        gender: createUserReferingDto.gender,
        refererEmail: referer.email,
      });

      await this.usersCreationService.updateUserSocialSituationByUserId(
        createdUserId,
        {
          materialInsecurity: convertYesNoToBoolean(
            createUserReferingDto.materialInsecurity
          ),
          networkInsecurity: convertYesNoToBoolean(
            createUserReferingDto.networkInsecurity
          ),
        }
      );

      await this.usersCreationService.sendFinalizeAccountReferedUser(
        createdUser,
        referer
      );

      return createdUser;
    } catch (err) {
      if (((err as Error).name = SequelizeUniqueConstraintError)) {
        throw new ConflictException();
      }
    }
  }
}
