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
import {
  COMPANY_USER_ROLE_CAN_BE_ADMIN,
  CompanyUserRole,
} from 'src/companies/company-user.utils';
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
import { isRoleIncluded } from 'src/users/users.utils';
import { getZoneNameFromDepartment, isValidPhone } from 'src/utils/misc';
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

    const zone = getZoneNameFromDepartment(
      createUserRegistrationDto.department
    );

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

      if (createUserRegistrationDto.invitationId) {
        // Link the invitation to the user
        await this.usersCreationService.linkInvitationToUser(
          createdUserId,
          createUserRegistrationDto.invitationId
        );

        try {
          // Send email to the company admin that the invitation has been used
          await this.usersCreationService.sendEmailCollaboratorInvitationUsed(
            createUserRegistrationDto.invitationId,
            createdUser
          );
        } catch (error) {
          console.error(
            'Failed to send collaborator invitation used email:',
            error
          );
        }
      }

      // Link the company if provided
      let companyId: string | null = null;
      let isCompanyAdmin = false;
      if (createUserRegistrationDto.companyName) {
        const company =
          await this.usersCreationService.findOrCreateCompanyByName(
            createUserRegistrationDto.companyName,
            createdUser,
            false // Do not create in external DB yet, will be done with the user creation
          );
        if (!company) {
          throw new NotFoundException('Company was not created properly');
        }
        companyId = company.id;
        // Check if a user is already linked to the company
        const existingCompanyUser =
          await this.usersCreationService.findOneCompanyUser(company.id);

        // If no user is linked, we can set the role as admin if applicable
        isCompanyAdmin =
          !existingCompanyUser &&
          COMPANY_USER_ROLE_CAN_BE_ADMIN.includes(
            createUserRegistrationDto.companyRole as CompanyUserRole
          );
        // Create the company user
        await this.usersCreationService.linkUserToCompany(
          createdUserId,
          company.id,
          createUserRegistrationDto.companyRole || CompanyUserRole.EMPLOYEE,
          isCompanyAdmin
        );
        // If user is set as company admin - update the user to make it not available to the rest of the community
        // This is to prevent the user from being displayed in the community list
        if (isCompanyAdmin) {
          await this.usersCreationService.updateUserProfileByUserId(
            createdUserId,
            {
              isAvailable: false,
            }
          );
        }
      }

      await this.usersCreationService.createExternalDBUser(createdUserId, {
        companyRole:
          createUserRegistrationDto.companyRole || CompanyUserRole.EMPLOYEE,
        birthDate: createUserRegistrationDto.birthDate,
        workingRight: createUserRegistrationDto.workingRight,
        gender: createUserRegistrationDto.gender,
        structure:
          createdUser.role === UserRoles.REFERER
            ? createdUser.organization.name
            : undefined,
        companyId,
        isCompanyAdmin,
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
    @UserPayload('id')
    refererId: string
  ) {
    if (!isValidPhone(createUserReferingDto.phone)) {
      throw new BadRequestException();
    }
    const referer = await this.usersCreationService.findOneUser(refererId);

    const userRandomPassword = generateFakePassword();
    const { hash, salt } = encryptPassword(userRandomPassword);

    const zone = getZoneNameFromDepartment(createUserReferingDto.department);

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
