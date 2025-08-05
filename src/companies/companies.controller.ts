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
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { isEmail } from 'validator';
import { Public, UserPayload } from 'src/auth/guards';
import { IsCompanyAdminGuard } from 'src/users/guards/is-company-admin.guard';
import { User } from 'src/users/models';
import { CompaniesService } from './companies.service';
import { CompanyInvitationsService } from './company-invitations.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { CreateCompanyPipe } from './dto/create-company.pipe';
import { InviteCollaboratorsDto } from './dto/invite-collaborators.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@ApiTags('Companies')
@Throttle(20, 60)
@Controller('companies')
export class CompaniesController {
  constructor(
    private readonly companiesService: CompaniesService,
    private readonly companyInvitationsService: CompanyInvitationsService
  ) {}

  @Public()
  @Get()
  async findAll(
    @Query('limit', new ParseIntPipe()) limit: number,
    @Query('offset', new ParseIntPipe()) offset: number,
    @Query('search') search?: string
  ) {
    return await this.companiesService.findAll(limit, offset, search);
  }

  @Public()
  @Throttle(5, 60)
  @Post()
  async create(
    @Body(new CreateCompanyPipe())
    createCompanyDto: CreateCompanyDto
  ) {
    const createdCompany = await this.companiesService.create(createCompanyDto);

    return createdCompany;
  }

  @Throttle(5, 60)
  @Put()
  async update(
    @Body() updateCompanyDto: UpdateCompanyDto,
    @UserPayload() user: User
  ) {
    try {
      // TODO: user can only have one company
      const companyId = user.companies?.[0]?.id;
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
      const companyId = user.companies?.[0]?.id;
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
