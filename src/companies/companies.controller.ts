import {
  BadRequestException,
  Body,
  Controller,
  Get,
  InternalServerErrorException,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  forwardRef,
  Inject,
  ParseBoolPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { validate as uuidValidate } from 'uuid';
import { isEmail } from 'validator';
import { Public, UserPayload } from 'src/auth/guards';
import { Department } from 'src/common/locations/locations.types';
import { IsCompanyAdminGuard } from 'src/users/guards/is-company-admin.guard';
import { User } from 'src/users/models';
import { UsersService } from 'src/users/users.service';
import { CompaniesService } from './companies.service';
import { CompanyInvitationsService } from './company-invitations.service';
import { InviteCollaboratorsDto } from './dto/invite-collaborators.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@ApiTags('Companies')
@Throttle(20, 60)
@Controller('companies')
export class CompaniesController {
  constructor(
    private readonly companiesService: CompaniesService,
    private readonly companyInvitationsService: CompanyInvitationsService,
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService
  ) {}

  @Throttle(60, 60)
  @Public()
  @Get()
  async findAll(
    @Query('limit', new ParseIntPipe()) limit: number,
    @Query('offset', new ParseIntPipe()) offset: number,
    @Query('businessSectorIds')
    businessSectorIds: string[],
    @Query('departments')
    departments: Department[],
    @Query('search') search?: string,
    @Query('onlyWithReferent', new ParseBoolPipe()) onlyWithReferent = false
  ) {
    if (departments) {
      for (const dept of departments) {
        if (!uuidValidate(dept)) {
          throw new BadRequestException('departmentId must be a UUID or null');
        }
      }
    }
    try {
      return await this.companiesService.findAll({
        limit,
        offset,
        search,
        businessSectorIds,
        departments,
        onlyWithReferent,
      });
    } catch (error) {
      console.error('Error in findAll:', error);
      throw new InternalServerErrorException();
    }
  }

  @Get(':companyId')
  async findOne(@Param('companyId') companyId: string) {
    return await this.companiesService.findOne(companyId);
  }

  @Get(':companyId/collaborators')
  async findCompanyCollaborators(
    @Param('companyId') companyId: string,
    @UserPayload() user: User
  ) {
    const userWithCompanyUsers =
      await this.usersService.findOneWithCompanyUsers(user.id);
    // Ensure the user has the right to view collaborators
    const companyUser = userWithCompanyUsers.companyUsers.find(
      (cu) => cu.companyId === companyId
    );

    const isCompanyAdmin = companyUser?.isAdmin === true;
    return await this.companiesService.findOneWithCompanyUsersAndPendingInvitations(
      companyId,
      isCompanyAdmin
    );
  }

  @Throttle(5, 60)
  @Put()
  async update(
    @Body() updateCompanyDto: UpdateCompanyDto,
    @UserPayload() user: User
  ) {
    try {
      const companyId = user.company?.id;
      if (!companyId) {
        throw new NotFoundException(`Company not found`);
      }

      if (updateCompanyDto.businessSectorIds) {
        await this.companiesService.updateBusinessSectors(
          companyId,
          updateCompanyDto.businessSectorIds
        );
      }

      const updatedCompany = await this.companiesService.update(
        companyId,
        updateCompanyDto
      );

      return updatedCompany;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  @UseInterceptors(FileInterceptor('file', { dest: 'uploads/' }))
  @Post('logo')
  async uploadCompanyLogo(
    @UploadedFile() file: Express.Multer.File,
    @UserPayload() user: User
  ) {
    if (!file) {
      throw new BadRequestException();
    }
    try {
      const companyId = user.company?.id;
      if (!companyId) {
        throw new NotFoundException('Company not found for the user.');
      }
      await this.companiesService.uploadLogo(companyId, file);
    } catch (error) {
      throw new InternalServerErrorException();
    }
  }

  @Throttle(5, 60)
  @UseGuards(IsCompanyAdminGuard)
  @Post(':companyId/invite-collaborators')
  async inviteCollaborators(
    @Param('companyId') companyId: string,
    @Body() inviteCollaboratorsDto: InviteCollaboratorsDto,
    @UserPayload() user: User
  ) {
    // Validate the provided emails
    if (inviteCollaboratorsDto.emails.length === 0) {
      throw new BadRequestException('No emails provided for invitation');
    }
    // Check if the number of emails exceeds the limit
    if (inviteCollaboratorsDto.emails.length > 100) {
      throw new BadRequestException('Too many emails provided for invitation');
    }

    // Validate each email format
    inviteCollaboratorsDto.emails.forEach((email) => {
      if (!isEmail(email)) {
        throw new BadRequestException(`Invalid email format: ${email}`);
      }
    });

    // Proceed with inviting collaborators
    return await this.companyInvitationsService.inviteCollaborators(
      user,
      companyId,
      inviteCollaboratorsDto.emails
    );
  }
}
